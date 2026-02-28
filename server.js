import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables (mostly for local dev; Docker injects them automatically)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Need increased limit for image uploads/parsing
app.use(express.json({ limit: '10mb' }));

// --- API ROUTES ---

// 1. Gemini Insight Generation
app.post('/api/gemini/insights', async (req, res) => {
  try {
    const { date, reportData } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
    You are an expert inventory analyst for "Pakaja", a premium momo brand.
    We have consumption data for date: ${date} across multiple branches.
    
    Data: ${JSON.stringify(reportData)}
    
    Please provide a concise 3-4 bullet point summary analyzing inventory movement.
    Focus on:
    1. Which Product Category (Steam vs Kurkure vs Rolls) had higher consumption?
    2. Any SKU with a high return rate?
    3. Any significant wastage reported? If so, highlight the items.
    4. A brief operational tip for restocking or waste reduction tomorrow.
    
    Keep the tone professional yet encouraging.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    res.json({ text: response.text || "No insights available." });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: 'Unable to generate insights', details: error.message });
  }
});

// 2. Gemini Parse Image
app.post('/api/gemini/parse-image', async (req, res) => {
  try {
    const { base64Image, availableSkus } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const skuListString = availableSkus.map(s => `${s.id}: ${s.name}`).join(', ');

    const prompt = `
      I am uploading a screenshot of a daily sales report from a food delivery app (like Zomato or Swiggy) or a POS system.
      
      Your task is to:
      1. Identify the food items listed in the image and their total quantities sold.
      2. Map these items to my Internal SKU List provided below.
      3. Return a JSON object where the key is the Internal SKU ID and the value is the quantity sold.
      
      Internal SKU List:
      [ ${skuListString} ]

      Rules:
      - If the image item is "Veg Steam Momos" and my SKU is "Veg Steam", map it to "sku-1" (or whatever the ID is).
      - If an item in the image doesn't match any of my SKUs (e.g. "Water Bottle"), ignore it.
      - Return ONLY the JSON object. Do not include markdown formatting like \`\`\`json.
      - If multiple image items map to one SKU, sum their quantities.
    `;

    // Safely extract base64 data if it contains the data:image prefix
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: prompt }
        ]
      }
    });

    const text = response.text?.trim() || "{}";
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '');
    res.json(JSON.parse(jsonString));
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    res.status(500).json({ error: 'Failed to parse sales report image', details: error.message });
  }
});

// 3. BunnyCDN Upload
app.post('/api/bunny/upload', async (req, res) => {
  try {
    const { base64Data, folder = 'uploads' } = req.body;
    
    const STORAGE_KEY = process.env.VITE_BUNNY_STORAGE_KEY || process.env.BUNNY_STORAGE_KEY;
    const STORAGE_ZONE = process.env.VITE_BUNNY_STORAGE_ZONE || process.env.BUNNY_STORAGE_ZONE || 'pakaja';
    const STORAGE_HOST = process.env.VITE_BUNNY_STORAGE_HOST || process.env.BUNNY_STORAGE_HOST || 'sg.storage.bunnycdn.com';
    let PULL_ZONE = process.env.VITE_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;

    if (!STORAGE_KEY || !PULL_ZONE) {
      console.warn("BunnyCDN credentials missing. Falling back to base64.");
      return res.json({ url: base64Data }); // Fallback to base64
    }

    if (!PULL_ZONE.startsWith('http')) {
      PULL_ZONE = `https://${PULL_ZONE}`;
    }

    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    
    // BunnyCDN expects raw binary, not base64 data URL
    const b64Data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(b64Data, 'base64');

    const uploadUrl = `https://${STORAGE_HOST}/${STORAGE_ZONE}/${folder}/${filename}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': STORAGE_KEY,
        'Content-Type': 'application/octet-stream',
        'accept': 'application/json'
      },
      body: buffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`BunnyCDN API responded with ${uploadResponse.status}`);
    }

    const cleanBaseUrl = PULL_ZONE.replace(/\/$/, '');
    res.json({ url: `${cleanBaseUrl}/${folder}/${filename}` });
  } catch (error) {
    console.error("BunnyCDN Upload Error:", error);
    // If it fails, fallback to base64
    res.json({ url: req.body.base64Data, error: error.message });
  }
});

// 4. BunnyCDN Delete
app.delete('/api/bunny/delete', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl || imageUrl.startsWith('data:')) {
      return res.json({ success: true });
    }

    const STORAGE_KEY = process.env.VITE_BUNNY_STORAGE_KEY || process.env.BUNNY_STORAGE_KEY;
    const STORAGE_ZONE = process.env.VITE_BUNNY_STORAGE_ZONE || process.env.BUNNY_STORAGE_ZONE || 'pakaja';
    const STORAGE_HOST = process.env.VITE_BUNNY_STORAGE_HOST || process.env.BUNNY_STORAGE_HOST || 'sg.storage.bunnycdn.com';
    const PULL_ZONE = process.env.VITE_BUNNY_PULL_ZONE || process.env.BUNNY_PULL_ZONE;

    if (!STORAGE_KEY || !PULL_ZONE) {
      return res.json({ success: false, message: 'Missing credentials' });
    }

    const imageObjUrl = new URL(imageUrl);
    const relativePath = imageObjUrl.pathname;
    const deleteUrl = `https://${STORAGE_HOST}/${STORAGE_ZONE}${relativePath}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'AccessKey': STORAGE_KEY }
    });

    if (response.ok) {
      res.json({ success: true });
    } else {
      res.status(response.status).json({ success: false, error: await response.text() });
    }
  } catch (error) {
    console.error("BunnyCDN Delete Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- STATIC ASSETS & SPA ROUTING ---

// Serve React static files
const staticPath = join(__dirname, 'dist');
if (fs.existsSync(staticPath)) {
  // Apply Cache-Control headers for specific static files exactly like serve.json did
  app.use(express.static(staticPath, {
    setHeaders: (res, path) => {
      if (path.endsWith('index.html') || path.endsWith('sw.js') || path.endsWith('version.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // Catch-all route for SPA routing
  app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(staticPath, 'index.html'));
  });
} else {
  console.warn(`Static directory ${staticPath} not found. Run 'npm run build' first.`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening at http://0.0.0.0:${PORT}`);
});

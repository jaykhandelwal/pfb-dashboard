import { GoogleGenAI } from "@google/genai";
import { DailyReportItem, SKU } from "../types";

export const generateDailyInsights = async (
  date: string,
  reportData: DailyReportItem[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights. Please check your API configuration.";
  }
};

/**
 * Uses Gemini Vision to parse a Sales Report (Zomato/Swiggy/POS screenshot)
 * and map the items to the provided internal SKU list.
 */
export const parseSalesReportImage = async (
  base64Image: string,
  availableSkus: SKU[]
): Promise<Record<string, number>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: prompt }
        ]
      }
    });

    const text = response.text?.trim() || "{}";
    // Clean up potential markdown code blocks if the model adds them despite instructions
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '');
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to parse sales report image.");
  }
};
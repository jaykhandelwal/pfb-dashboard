
// Helper to safely access env vars
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_${key}`]) {
    // @ts-ignore
    return import.meta.env[`VITE_${key}`];
  }
  return '';
};

const STORAGE_KEY = getEnv('BUNNY_STORAGE_KEY');
const STORAGE_ZONE = getEnv('BUNNY_STORAGE_ZONE') || 'pakaja'; 
// Default to the host in your screenshot (Singapore), but allow override
const STORAGE_HOST = getEnv('BUNNY_STORAGE_HOST') || 'sg.storage.bunnycdn.com'; 
let PULL_ZONE = getEnv('BUNNY_PULL_ZONE');

export const uploadImageToBunny = async (base64Data: string): Promise<string> => {
  // Fallback to Base64 if credentials are not set
  if (!STORAGE_KEY || !PULL_ZONE) {
    console.warn("BunnyCDN credentials missing (VITE_BUNNY_STORAGE_KEY, VITE_BUNNY_PULL_ZONE). Saving as Base64.");
    return base64Data;
  }

  // Robust check: Ensure PULL_ZONE starts with https://
  if (PULL_ZONE && !PULL_ZONE.startsWith('http')) {
      PULL_ZONE = `https://${PULL_ZONE}`;
  }

  try {
    // Generate a unique filename: wastage_{timestamp}_{random}.jpg
    const filename = `wastage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    
    // Convert Base64 Data URL to Blob
    const response = await fetch(base64Data);
    const blob = await response.blob();

    // BunnyCDN Storage Endpoint
    // Format: https://{Region}.storage.bunnycdn.com/{StorageZoneName}/{path}/{fileName}
    // Using the host from your screenshot: sg.storage.bunnycdn.com
    const uploadUrl = `https://${STORAGE_HOST}/${STORAGE_ZONE}/wastage/${filename}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': STORAGE_KEY,
        'Content-Type': 'application/octet-stream',
        'accept': 'application/json'
      },
      body: blob
    });

    if (!uploadResponse.ok) {
       console.error(`BunnyCDN Upload Failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
       return base64Data; // Fallback
    }

    // Construct the public URL using the Pull Zone
    // Ensure PULL_ZONE has no trailing slash
    const cleanBaseUrl = PULL_ZONE.replace(/\/$/, '');
    return `${cleanBaseUrl}/wastage/${filename}`;

  } catch (error) {
    console.error("Image Upload Error:", error);
    // Return original base64 so we don't lose the data if upload fails
    return base64Data; 
  }
};

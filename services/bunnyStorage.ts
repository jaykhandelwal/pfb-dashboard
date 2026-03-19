export const uploadImageToBunny = async (base64Data: string, folder: string = 'uploads'): Promise<string> => {
  try {
    const res = await fetch('/api/bunny/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, folder })
    });

    const data = await res.json();
    return data.url; // Contains the remote CDN URL or falls back to base64 if it failed
  } catch (error) {
    console.error("Image Upload Error:", error);
    return base64Data; // fallback
  }
};

export const deleteImageFromBunny = async (imageUrl: string): Promise<boolean> => {
  if (!imageUrl || imageUrl.startsWith('data:')) return true;

  try {
    const res = await fetch('/api/bunny/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });

    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error("Image Delete Error:", error);
    return false;
  }
};

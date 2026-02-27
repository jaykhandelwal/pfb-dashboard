import { DailyReportItem, SKU } from "../types";

export const generateDailyInsights = async (
  date: string,
  reportData: DailyReportItem[]
): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, reportData })
    });

    if (!res.ok) throw new Error('Failed to generate insights');
    const data = await res.json();
    return data.text || "No insights available.";
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
    const res = await fetch('/api/gemini/parse-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, availableSkus })
    });

    if (!res.ok) throw new Error('Failed to parse image');

    return await res.json();
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to parse sales report image.");
  }
};

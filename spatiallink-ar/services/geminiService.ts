import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const identifyAppliance = async (base64Image: string): Promise<string> => {
  try {
    // Remove data URL prefix if present for the API call
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Identify the main household appliance or furniture in the center of this image. Return ONLY the name (e.g., 'Fan', 'Light', 'TV', 'Speaker'). If unsure, return 'Device'."
          }
        ]
      },
      config: {
        maxOutputTokens: 10,
        temperature: 0.2,
      }
    });

    return response.text?.trim() || "Device";
  } catch (error) {
    console.error("Gemini recognition failed:", error);
    return "Device";
  }
};


import { GoogleGenAI, Type } from "@google/genai";

// O process.env.API_KEY é injetado pelo ambiente de execução.
const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });

export const getSearchKeywords = async (query: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract search keywords and semantic related terms for a Roblox asset search: "${query}". Return only a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const generatedText = response.text;
    
    if (typeof generatedText === 'string' && generatedText.trim().length > 0) {
      try {
        return JSON.parse(generatedText.trim());
      } catch (parseError) {
        console.warn("Failed to parse Gemini JSON, falling back to query.", parseError);
        return [query.toLowerCase()];
      }
    }

    return [query.toLowerCase()];
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [query.toLowerCase()];
  }
};

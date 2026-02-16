
import { GoogleGenAI, Type } from "@google/genai";

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

    const textResult = response.text;
    
    // Verificação explícita para o TypeScript (Fix TS18048)
    if (textResult && typeof textResult === 'string') {
      try {
        return JSON.parse(textResult.trim());
      } catch (parseError) {
        console.warn("Falha ao processar JSON do Gemini:", parseError);
        return [query.toLowerCase()];
      }
    }

    return [query.toLowerCase()];
  } catch (error) {
    console.error("Erro na busca Gemini:", error);
    return [query.toLowerCase()];
  }
};

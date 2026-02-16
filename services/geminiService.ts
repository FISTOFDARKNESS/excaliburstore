
import { GoogleGenAI, Type } from "@google/genai";

export const getSearchKeywords = async (query: string): Promise<string[]> => {
  // Use process.env.API_KEY directly as per the @google/genai coding guidelines.
  // We assume the API_KEY environment variable is pre-configured and accessible.
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Dada a pesquisa de um asset no Roblox: "${query}", retorne uma lista de termos semanticamente relacionados (ex: se pesquisar 'carro', inclua 'veículo', 'drive', 'transporte'). Retorne APENAS um array JSON de strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    // Access the .text property directly from the response.
    const result = response.text;
    return result ? JSON.parse(result) : [query.toLowerCase()];
  } catch (error) {
    console.error("Erro na busca semântica:", error);
    return [query.toLowerCase()];
  }
};

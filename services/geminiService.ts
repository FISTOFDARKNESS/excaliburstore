
import { GoogleGenAI, Type } from "@google/genai";

export const generateKeywords = async (title: string, description: string): Promise<string[]> => {
  try {
    // Inicialização dentro da função para garantir que process.env.API_KEY esteja disponível
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analisando o seguinte asset do Roblox: Título "${title}", Descrição "${description}". Gere 10 palavras-chave (tags) relevantes para busca semântica em português e inglês. Retorne APENAS um array JSON de strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const result = response.text;
    return result ? JSON.parse(result) : [];
  } catch (error) {
    console.error("Keyword generation failed:", error);
    return [];
  }
};

export const semanticSearch = async (query: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Expanda a seguinte pesquisa de asset Roblox: "${query}". Forneça sinônimos e termos técnicos relacionados (ex: se pesquisar 'carro', inclua 'veículo', 'chassis', 'A-Chassis'). Retorne APENAS um array JSON de strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const result = response.text;
    return result ? JSON.parse(result) : [query.toLowerCase()];
  } catch (error) {
    console.error("Semantic search expansion failed:", error);
    return [query.toLowerCase()];
  }
};

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// ==========================================
// 1. Google Gemini AI Integration (GCP)
// ==========================================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
});

/**
 * Генерує опис товару та SEO-теги за допомогою Google Gemini API
 */
export async function generateProductDetails(productName, category = "General") {
  try {
    const prompt = `Ти помічник інтернет-магазину CloudMart. 
Згенеруй короткий привабливий опис українською мовою для товару "${productName}" у категорії "${category}", а також 5 тегів.
Поверни результат ТІЛЬКИ у форматі JSON:
{
  "description": "текст опису",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate product AI details: ${error.message}`);
  }
}

/**
 * Чат підтримки клієнтів (Customer Support) на базі Google Gemini
 */
export async function sendGeminiChatMessage(message) {
  try {
    const prompt = `Ти ввічливий та корисний асистент підтримки клієнтів інтернет-магазину CloudMart.
Дай коротку, чітку та привітну відповідь українською мовою на запитання клієнта:
"${message}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Customer Support Chat Error:", error);
    throw new Error(`Customer Support AI Error: ${error.message}`);
  }
}

// Заглушки для сумісності з існуючим API
export const createOpenAIConversation = async () => {
  return `gemini-thread-${Date.now()}`;
};

export const createBedrockConversation = async () => {
  return `gemini-thread-${Date.now()}`;
};

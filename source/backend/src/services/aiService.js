import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Ініціалізація офіційного SDK Google AI Studio
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key");

/**
 * Генерує опис товару та SEO-теги
 */
export async function generateProductDetails(productName, category = "General") {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Ти помічник інтернет-магазину CloudMart. 
Згенеруй короткий привабливий опис українською мовою для товару "${productName}" у категорії "${category}", а також 5 тегів.
Поверни результат ТІЛЬКИ у форматі JSON:
{
  "description": "текст опису",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate product AI details: ${error.message}`);
  }
}

/**
 * Чат підтримки клієнтів (Customer Support)
 */
export async function sendGeminiChatMessage(message) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Ти ввічливий та корисний асистент підтримки клієнтів інтернет-магазину CloudMart.
Дай коротку, чітку та привітну відповідь українською мовою на запитання клієнта:
"${message}"`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Customer Support Chat Error:", error);
    throw new Error(`Customer Support AI Error: ${error.message}`);
  }
}

// Заглушки для сумісності
export const createOpenAIConversation = async () => `gemini-thread-${Date.now()}`;
export const createBedrockConversation = async () => `gemini-thread-${Date.now()}`;

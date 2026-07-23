import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function generateProductDetails(productName, category = "General") {
  try {
    const prompt = `Ти помічник інтернет-магазину CloudMart. 
Згенеруй короткий привабливий опис українською мовою для товару "${productName}" у категорії "${category}", а також 5 тегів.
Поверни результат ТІЛЬКИ у форматі JSON:
{
  "description": "текст опису",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"]
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const textResponse = data.candidates[0].content.parts[0].text;
    return JSON.parse(textResponse);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate product AI details: ${error.message}`);
  }
}

export async function sendGeminiChatMessage(message) {
  try {
    const prompt = `Ти ввічливий та корисний асистент підтримки клієнтів інтернет-магазину CloudMart.
Дай коротку, чітку та привітну відповідь українською мовою на запитання клієнта:
"${message}"`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini Customer Support Chat Error:", error);
    throw new Error(`Customer Support AI Error: ${error.message}`);
  }
}

export const createOpenAIConversation = async () => `gemini-thread-${Date.now()}`;
export const createBedrockConversation = async () => `gemini-thread-${Date.now()}`;

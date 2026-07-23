import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Список моделей у порядку пріоритету (AVR / Fallback chain)
const ENDPOINTS = [
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
];

/**
 * Універсальний запит із підтримкою Автоматичного Введення Резерву (AVR)
 */
async function callGeminiWithFallback(bodyPayload) {
  let lastError = null;

  for (const url of ENDPOINTS) {
    try {
      const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const data = await response.json();

      if (response.ok && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      
      console.warn(`[AVR Notice] Endpoint ${url} failed with status ${response.status}. Trying next fallback...`);
      lastError = data;
    } catch (err) {
      console.warn(`[AVR Notice] Network failed for ${url}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini endpoints failed. Last response: ${JSON.stringify(lastError)}`);
}

/**
 * Генерація опису товару
 */
export async function generateProductDetails(productName, category = "General") {
  const prompt = `Ти помічник інтернет-магазину CloudMart. 
Згенеруй короткий привабливий опис українською мовою для товару "${productName}" у категорії "${category}", а також 5 тегів.
Поверни результат ТІЛЬКИ у форматі JSON:
{
  "description": "текст опису",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"]
}`;

  try {
    const textResponse = await callGeminiWithFallback({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    return JSON.parse(textResponse);
  } catch (error) {
    console.error("Gemini API Emergency Fallback Triggered:", error);
    // AVR Захист: повертаємо базовий дефолтний JSON, щоб додаток НЕ впав
    return {
      description: `Якісний товар "${productName}" у категорії ${category}. Опис тимчасово згенеровано в аварійному режимі.`,
      tags: ["cloudmart", "товар", "новинка", "акція", "якість"]
    };
  }
}

/**
 * Чат підтримки клієнтів (Customer Support)
 */
export async function sendGeminiChatMessage(message) {
  const prompt = `Ти ввічливий та корисний асистент підтримки клієнтів інтернет-магазину CloudMart.
Дай коротку, чітку та привітну відповідь українською мовою на запитання клієнта:
"${message}"`;

  try {
    return await callGeminiWithFallback({
      contents: [{ parts: [{ text: prompt }] }]
    });
  } catch (error) {
    console.error("Gemini Chat Emergency Fallback Triggered:", error);
    // AVR Захист: повертаємо аварійну відповідь клієнту замість 500 Internal Server Error
    return "Вітаю! Наразі наш онлайн-асистент перебуває на плановому обслуговуванні. Ваш запит прийнято, наш оператор зв'яжеться з вами найближчим часом!";
  }
}

export const createOpenAIConversation = async () => `gemini-thread-${Date.now()}`;
export const createBedrockConversation = async () => `gemini-thread-${Date.now()}`;

import fetch from "node-fetch";
import { buildStoreContextPrompt } from "./contextService.js";

// AI_PROVIDER може бути: "ollama", "gemini", "bedrock", "azure"
const AI_PROVIDER = process.env.AI_PROVIDER || "ollama";

// Конфігурація ендпоінтів
const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama-service.cloudmart.svc.cluster.local:11434/api/generate";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * ЧАТ-АСИСТЕНТ (з прив'язкою до даних магазину)
 */
export async function sendGeminiChatMessage(message) {
  const fullPrompt = await buildStoreContextPrompt(message);

  switch (AI_PROVIDER.toLowerCase()) {
    case "gemini":
      return await callGeminiAPI(fullPrompt);

    case "bedrock":
      return await callAWSBedrock(fullPrompt);

    case "azure":
      return await callAzureOpenAI(fullPrompt);

    case "ollama":
    default:
      return await callOllamaAPI(fullPrompt);
  }
}

/**
 * ГЕНЕРАЦІЯ ОПИСУ ТОВАРУ ДЛЯ АДМІНКИ
 */
export async function generateProductDetails(productName, category = "General") {
  const prompt = `Згенеруй короткий опис та 5 тегів для товару "${productName}" у категорії "${category}". Відповідь надай строго у форматі JSON з полями "description" та "tags" (масив рядків).`;

  try {
    let rawResponse = "";
    if (AI_PROVIDER === "gemini") {
      rawResponse = await callGeminiAPI(prompt);
    } else {
      rawResponse = await callOllamaAPI(prompt);
    }

    const parsed = JSON.parse(rawResponse);
    return {
      description: parsed.description || `Якісний товар ${productName}`,
      tags: parsed.tags || ["cloudmart", category.toLowerCase()]
    };
  } catch (error) {
    console.error(`[AIService] Помилка генерації опису (${AI_PROVIDER}):`, error.message);
    return {
      description: `Товар "${productName}" у категорії ${category}.`,
      tags: ["cloudmart", "новинка"]
    };
  }
}

// ============================================================================
// ПРОВАЙДЕРИ (ІМПЛЕМЕНТАЦІЯ ДЛЯ РІЗНИХ СЕРВІСІВ)
// ============================================================================

// 1. Локальна Ollama (K3s)
async function callOllamaAPI(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral",
      prompt: prompt,
      stream: false
    })
  });
  if (!response.ok) throw new Error(`Ollama Error HTTP ${response.status}`);
  const data = await response.json();
  return data.response;
}

// 2. Google Gemini API
async function callGeminiAPI(prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  if (!response.ok) throw new Error(`Gemini Error HTTP ${response.status}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// 3. AWS Bedrock (Заготовка під SDK/HTTP)
async function callAWSBedrock(prompt) {
  // Тут буде виклик AWS Bedrock Runtime Client
  throw new Error("AWS Bedrock Provider ще не налаштовано.");
}

// 4. Azure OpenAI (Заготовка)
async function callAzureOpenAI(prompt) {
  // Тут буде виклик Azure OpenAI Services
  throw new Error("Azure OpenAI Provider ще не налаштовано.");
}

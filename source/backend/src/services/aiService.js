import fetch from "node-fetch";
import { buildStoreContextPrompt } from "./contextService.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama-service.cloudmart.svc.cluster.local:11434/api/generate";
const TIMEOUT_MS = 4000; // 4 second timeout before falling back to Ollama

/**
 * Creates a new chat session thread for the frontend
 */
export async function createOpenAIConversation() {
  const threadId = `thread_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return threadId;
}

/**
 * Chat Assistant handler with Gemini -> Ollama Fallback
 */
export async function sendGeminiChatMessage(message) {
  const fullPrompt = await buildStoreContextPrompt(message);

  // Attempt #1: Google Gemini API
  try {
    return await callWithTimeout(callGeminiAPI(fullPrompt), TIMEOUT_MS);
  } catch (geminiError) {
    console.warn(`[AI Hybrid Notice] Gemini unavailable (${geminiError.message}). Falling back to local Ollama...`);
    
    // Attempt #2: Local Ollama Fallback
    try {
      return await callOllamaAPI(fullPrompt);
    } catch (ollamaError) {
      console.error("[AI Critical Error] Both AI providers failed:", ollamaError.message);
      return "Вибачте, сервіс штучного інтелекту тимчасово недоступний.";
    }
  }
}

/**
 * Admin Product Details Generator
 */
export async function generateProductDetails(productName, category = "General") {
  const prompt = `Згенеруй короткий опис та 5 тегів для товару "${productName}" у категорії "${category}". Відповідь надай строго у форматі JSON з полями "description" та "tags" (масив рядків).`;

  let rawResponse = "";
  try {
    rawResponse = await callWithTimeout(callGeminiAPI(prompt), TIMEOUT_MS);
  } catch (error) {
    console.warn(`[AI Hybrid Notice] Gemini fallback for product generation: ${error.message}`);
    try {
      rawResponse = await callOllamaAPI(prompt);
    } catch (ollamaErr) {
      return {
        description: `Якісний товар "${productName}" у категорії ${category}.`,
        tags: ["cloudmart", "новинка"]
      };
    }
  }

  try {
    const parsed = JSON.parse(rawResponse);
    return {
      description: parsed.description || `Товар ${productName}`,
      tags: parsed.tags || ["cloudmart", category.toLowerCase()]
    };
  } catch (parseError) {
    return {
      description: rawResponse,
      tags: ["cloudmart", category.toLowerCase()]
    };
  }
}

// ----------------------------------------------------------------------------
// Helper Provider Functions
// ----------------------------------------------------------------------------

function callWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function callGeminiAPI(prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
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

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

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

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

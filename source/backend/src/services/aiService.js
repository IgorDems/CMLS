import fetch from "node-fetch";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama-service.cloudmart.svc.cluster.local:11434/api/generate";

// Єдине доповнення: генеруємо dummy-ID для сесії фронтенду, щоб /api/ai/start віддавав 200 OK
export async function createOpenAIConversation() {
  return `thread_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export async function generateProductDetails(productName, category = "General") {
  try {
    const prompt = `Згенеруй короткий опис та 5 тегів для товару "${productName}" у категорії "${category}". Відповідь надай строго у форматі JSON: {"description": "...", "tags": ["tag1", "tag2"]}`;
    
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Ollama status ${response.status}`);

    const data = await response.json();
    let parsed;
    try {
      parsed = JSON.parse(data.response);
    } catch {
      parsed = { description: data.response, tags: ["cloudmart", category.toLowerCase()] };
    }

    return {
      description: parsed.description || `Якісний товар ${productName}`,
      tags: parsed.tags || ["cloudmart", "новинка"]
    };
  } catch (error) {
    console.error("Ollama AI Error:", error.message);
    return {
      description: `Товар "${productName}" у категорії ${category}. (Створено локально)`,
      tags: ["cloudmart", "новинка", "акція"]
    };
  }
}

export async function sendGeminiChatMessage(message) {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: message,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Ollama status ${response.status}`);

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama Chat Error:", error.message);
    return "Запит оброблено в резервному режимі.";
  }
}

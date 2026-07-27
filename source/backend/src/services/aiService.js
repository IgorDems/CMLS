import fetch from "node-fetch";
import { getAllProducts } from "./productService.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama-service.cloudmart.svc.cluster.local:11434/api/generate";

/**
 * Створення сесії для фронтенду (усуває помилку 500 на /api/ai/start)
 */
export async function createOpenAIConversation() {
  return `thread_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Чат-асистент із прив'язкою до товарів у DynamoDB
 */
export async function sendGeminiChatMessage(message) {
  try {
    let catalogContext = "Каталог порожній.";
    try {
      const products = await getAllProducts();
      if (products && products.length > 0) {
        catalogContext = products.map(p => 
          `- Назва: ${p.name} | Категорія: ${p.category || 'Загальна'} | Ціна: $${p.price} | Опис: ${p.description || 'Немає'}`
        ).join("\n");
      }
    } catch (dbErr) {
      console.error("[Ollama] DB Fetch Error:", dbErr.message);
    }

    const fullPrompt = `Ти — офіційний AI-консультант інтернет-магазину CloudMart.
Твоє завдання — відповідати покупцям СТРОГО на основі наведеного нижче каталогу товарів CloudMart.

КАТАЛОГ ТОВАРІВ CLOUDMART:
${catalogContext}

ПРАВИЛА ВІДПОВІДІ:
1. Відповідай ТІЛЬКИ про товари з каталогу.
2. Якщо товару немає в каталозі, ввічливо повідоми про це.
3. Відповідай дружньо, стисло та українською мовою.

Запитання покупця: ${message}`;

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: fullPrompt,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Ollama status ${response.status}`);
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama Chat Error:", error.message);
    return "Вибачте, виникла помилка під час обробки вашого запиту.";
  }
}

/**
 * Генерація описів товарів для адмінки
 */
export async function generateProductDetails(productName, category = "General") {
  try {
    const prompt = `Згенеруй короткий опис та 5 тегів для товару "${productName}" у категорії "${category}". Відповідь надай строго у форматі JSON з полями "description" та "tags" (масив рядків).`;
    
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
      description: `Товар "${productName}" у категорії ${category}.`,
      tags: ["cloudmart", "новинка"]
    };
  }
}

import fetch from "node-fetch";
import { getAllProducts } from "./productService.js"; // Імпортуємо вибірку з DynamoDB

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama-service.cloudmart.svc.cluster.local:11434/api/generate";

// Функція для обробки POST /api/ai/start (ініціалізація чату на фронтенді)
export async function createOpenAIConversation() {
  return `thread_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export async function sendGeminiChatMessage(message) {
  try {
    // 1. Отримуємо всі актуальні товари з DynamoDB
    const products = await getAllProducts();

    // 2. Формуємо компактний список товарів для AI
    const catalogContext = products.map(p =>
      `- Назва: ${p.name}, Категорія: ${p.category || 'Загальна'}, Ціна: $${p.price}, Опис: ${p.description || 'Немає опису'}, В наявності: ${p.stock ?? 'Так'}`
    ).join("\n");

    // 3. Формуємо жорсткий системний промпт
    const fullPrompt = `Ти — офіційний консультант інтернет-магазину CloudMart.
Твоє завдання — відповідати покупцям ВИКЛЮЧНО на основі нашого каталогу товарів.

КАТАЛОГ ТОВАРІВ CLOUDMART:
${catalogContext.length > 0 ? catalogContext : "Каталог порожній."}

ПРАВИЛА ВІДПОВІДІ:
1. Відповідай ТІЛЬКИ на основі наведеного вище каталогу товарів.
2. Якщо товару немає в каталозі або запитання не стосується товарів CloudMart, ввічливо дай зрозуміти, що такого товару немає в нашому магазині.
3. НІКОЛИ не вигадуй товари, ціни чи характеристики, яких немає в каталозі.
4. Відповідай дружньо, стисло та українською мовою.

Питання покупця: ${message}`;

    // 4. Відправляємо збагачений запит в AI
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
    console.error("Chat AI Error:", error.message);
    return "Вибачте, виникла помилка під час звернення до бази товарів CloudMart.";
  }
}

// Функція для генерації описів товарів в адмін-панелі
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

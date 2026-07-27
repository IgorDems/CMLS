import { getAllProducts } from "./productService.js";

/**
 * Builds system prompt dynamically using active DynamoDB products
 */
export async function buildStoreContextPrompt(userMessage) {
  let catalogContext = "Каталог порожній.";
  
  try {
    const products = await getAllProducts();
    if (products && products.length > 0) {
      catalogContext = products.map(p => 
        `- Назва: ${p.name} | Категорія: ${p.category || 'Загальна'} | Ціна: $${p.price} | Опис: ${p.description || 'Немає'} | В наявності: ${p.stock ?? 'Так'}`
      ).join("\n");
    }
  } catch (error) {
    console.error("[ContextService] Error fetching products from DynamoDB:", error.message);
  }

  return `Ти — офіційний AI-консультант інтернет-магазину CloudMart.
Твоє завдання — відповідати покупцям СТРОГО на основі наведеного нижче каталогу товарів CloudMart.

КАТАЛОГ ТОВАРІВ CLOUDMART:
${catalogContext}

ПРАВИЛА ВІДПОВІДІ:
1. Відповідай ТІЛЬКИ про товари, які присутні у наведеному вище каталозі.
2. Якщо товару немає в каталозі, ввічливо повідом, що такий товар відсутній у CloudMart.
3. Не вигадуй ціни, товари чи характеристики, яких немає в наданому списку.
4. Відповідай дружньо, стисло та українською мовою.

Запитання покупця: ${userMessage}`;
}

import { getAllProducts } from "./productService.js";

/**
 * Формує системний промпт із актуальними даними з DynamoDB
 */
export async function buildStoreContextPrompt(userMessage) {
  let catalogContext = "Каталог порожній.";
  
  try {
    const products = await getAllProducts();
    if (products && products.length > 0) {
      catalogContext = products.map(p => 
        `- [ID: ${p.id}] Назва: ${p.name} | Категорія: ${p.category || 'Загальна'} | Ціна: $${p.price} | Опис: ${p.description || 'Немає'} | В наявності: ${p.stock ?? 'Так'}`
      ).join("\n");
    }
  } catch (error) {
    console.error("[ContextService] Помилка завантаження товарів з DynamoDB:", error.message);
  }

  return `Ти — офіційний AI-консультант інтернет-магазину CloudMart.
Твоє завдання — відповідати покупцям СТРОГО на основі каталогу товарів CloudMart.

АКТУАЛЬНИЙ КАТАЛОГ ТОВАРІВ МАЗИНУ:
${catalogContext}

ПРАВИЛА ВІДПОВІДІ:
1. Відповідай ТІЛЬКИ про товари, які є у наведеному вище каталозі.
2. Якщо товару немає в каталозі, ввічливо повідом, що такий товар відсутній у CloudMart.
3. Не вигадуй ціни, товари чи характеристики, яких немає в наданому списку.
4. Відповідай дружньо, стисло та українською мовою.

Запитання покупця: ${userMessage}`;
}

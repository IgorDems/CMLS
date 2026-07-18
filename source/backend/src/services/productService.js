import pkg from 'aws-sdk';
const { DynamoDB } = pkg;
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const dynamoDb = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const TABLE_NAME = 'cloudmart_products';

// 1. Створення продукту
export async function createProduct(productData) {
  const productId = uuidv4();
  const item = {
    pk: 'PRODUCT',
    sk: `PRODUCT#${productId}`,
    id: productId,
    name: productData.name,
    description: productData.description,
    price: productData.price,
    image: productData.image
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  await dynamoDb.put(params).promise();
  return item;
}

// 2. Видалення продукту (ОЧИЩЕНО ВІД ДУБЛІВ)
export const deleteProduct = async (id) => {
  const fullId = id.startsWith('PRODUCT#') ? id : `PRODUCT#${id}`;
  const params = {
    TableName: TABLE_NAME,
    Key: {
      pk: 'PRODUCT',
      sk: fullId
    }
  };
  await dynamoDb.delete(params).promise();
  return { id };
};

// 3. Отримання продукту за ID
export const getProductById = async (id) => {
  const fullId = id.startsWith('PRODUCT#') ? id : `PRODUCT#${id}`;
  const params = {
    TableName: TABLE_NAME,
    Key: {
      pk: 'PRODUCT',
      sk: fullId
    }
  };
  const result = await dynamoDb.get(params).promise();
  return result.Item;
};

// 4. Отримання всіх продуктів
export const getAllProducts = async () => {
  const params = {
    TableName: TABLE_NAME
  };
  const result = await dynamoDb.scan(params).promise();
  return result.Items || [];
};

// 5. Оновлення продукту
export const updateProduct = async (id, updates) => {
  const fullId = id.startsWith('PRODUCT#') ? id : `PRODUCT#${id}`;
  const params = {
    TableName: TABLE_NAME,
    Key: {
      pk: 'PRODUCT',
      sk: fullId
    },
    UpdateExpression: 'set #name = :name, description = :description, price = :price, image = :image',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':name': updates.name,
      ':description': updates.description,
      ':price': updates.price,
      ':image': updates.image
    },
    ReturnValues: 'ALL_NEW'
  };
  const result = await dynamoDb.update(params).promise();
  return result.Attributes;
};

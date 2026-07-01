// services/productService.js
import pkg from 'aws-sdk';
const { DynamoDB } = pkg;
import dotenv from 'dotenv';
dotenv.config();

console.log("AWS_ENDPOINT_URL =", process.env.AWS_ENDPOINT_URL);
console.log("AWS_ACCESS_KEY_ID =", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_REGION =", process.env.AWS_REGION);


import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

console.log("DocumentClient endpoint:", dynamoDb.service.endpoint.href);

const TABLE_NAME = 'cloudmart_products';

export const createProduct = async (product) => {
  const generatedId = uuidv4().split('-')[0];
  
  const params = {
    TableName: TABLE_NAME,
    Item: {
      pk: `PRODUCT#${generatedId}`, // Перевірте, чи потрібен префікс "PRODUCT#" відповідно до логів вашої бази
      id: generatedId,
      name: product.name,
      price: Number(product.price), // Явно приводимо до числа, щоб уникнути ValidationException
      description: product.description || "",
      image: product.image || "",
      createdAt: new Date().toISOString()
    }
  };

  await dynamoDb.put(params).promise();
  return params.Item;
};

//export const getAllProducts = async () => {
//  const params = {
//    TableName: TABLE_NAME
//  }; 

//  const result = await dynamoDb.scan(params).promise();

//  return result.Items;
//};

export const getAllProducts = async () => {
  const params = {
    TableName: TABLE_NAME
  };

  const result = await dynamoDb.scan(params).promise();

  return result.Items.map(item => ({
  id: item.pk,
  name: item.name,
  price: Number(item.price),
  description: item.description || "",
  image: item.image || ""
}));
};

export const getProductById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {pk: id }
  };

  const result = await dynamoDb.get(params).promise();
  return result.Item;
};

export const updateProduct = async (id, updates) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {pk: id },
    UpdateExpression: 'set #n = :n, price = :p, image = :i, description = :d',
    ExpressionAttributeNames: {
      '#n': 'name'
    },
    ExpressionAttributeValues: {
      ':n': updates.name,
      ':p': updates.price,
      ':i': updates.image,
      ':d': updates.description
    },
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamoDb.update(params).promise();
  return result.Attributes;
};

export const deleteProduct = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {pk: id }
  };

  await dynamoDb.delete(params).promise();
};

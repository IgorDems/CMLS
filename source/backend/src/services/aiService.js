import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { Readable } from "stream";
import dotenv from "dotenv";
import { deleteOrder, getOrderById, cancelOrder } from "./orderService.js";

dotenv.config();

// ==========================================
// 1. Google Gemini AI Integration (GCP)
// ==========================================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
});

/**
 * Генерує опис товару та SEO-теги за допомогою Google Gemini API
 */
export async function generateProductDetails(productName, category = "General") {
  try {
    const prompt = `Ти помічник інтернет-магазину CloudMart. 
Згенеруй короткий привабливий опис українською мовою для товару "${productName}" у категорії "${category}", а також 5 тегів.
Поверни результат ТІЛЬКИ у форматі JSON:
{
  "description": "текст опису",
  "tags": ["тег1", "тег2", "тег3", "тег4", "тег5"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate product AI details: ${error.message}`);
  }
}

// ==========================================
// 2. Local LLM / OpenAI Integration (Ollama)
// ==========================================
const bedrockAgentClient = new BedrockAgentRuntimeClient({
  region: "us-east-1",
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "ollama",
  baseURL: process.env.OPENAI_BASE_URL || "http://localhost:11434/v1",
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
const AGENT_ID = process.env.BEDROCK_AGENT_ID;
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID;

const deleteOrderFunction = {
  name: "delete_order",
  description: "Delete an order by order ID",
  parameters: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "The ID of the order to be deleted",
      },
    },
    required: ["orderId"],
  },
};

const cancelOrderFunction = {
  name: "cancel_order",
  description: "Cancel an order by changing its status to 'canceled'",
  parameters: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "The ID of the order to be canceled",
      },
    },
    required: ["orderId"],
  },
};

export const createOpenAIConversation = async () => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};

export const sendOpenAIMessage = async (threadId, message) => {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || "llama3",
      messages: [{ role: "user", content: message }],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("AI Service Error:", error);
    throw new Error("Не вдалося отримати відповідь від локальної моделі.");
  }
};

// ==========================================
// 3. AWS Bedrock Agent Functions
// ==========================================
export const createBedrockConversation = async () => {
  return Date.now().toString();
};

export const sendBedrockMessage = async (sessionId, message) => {
  const params = {
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    sessionId: sessionId,
    inputText: message,
  };

  try {
    console.log(
      "Sending request to Bedrock Agent:",
      JSON.stringify(params, null, 2)
    );
    const command = new InvokeAgentCommand(params);
    const response = await bedrockAgentClient.send(command);

    console.log(
      "Raw response from Bedrock Agent:",
      JSON.stringify(response, null, 2)
    );

    if (
      !response.completion ||
      !response.completion.options ||
      !response.completion.options.messageStream
    ) {
      console.warn("Received empty or unexpected response from Bedrock Agent");
      return "I'm sorry, but I couldn't generate a response at the moment. Please try again later.";
    }

    const messageStream = response.completion.options.messageStream;
    const stream = Readable.from(messageStream);

    let fullMessage = "";
    for await (const chunk of stream) {
      console.log("Raw chunk:", JSON.stringify(chunk, null, 2));

      if (chunk && typeof chunk === "object" && chunk.body) {
        const bodyBuffer = Buffer.from(Object.values(chunk.body));
        const bodyString = bodyBuffer.toString("utf-8");

        try {
          const bodyJson = JSON.parse(bodyString);
          if (bodyJson.bytes) {
            const decodedText = Buffer.from(bodyJson.bytes, "base64").toString(
              "utf-8"
            );
            fullMessage += decodedText;
            console.log("Decoded text:", decodedText);
          }
        } catch (error) {
          console.log("Error parsing body JSON:", error);
          console.log("Raw body string:", bodyString);
        }
      } else {
        console.log("Unexpected chunk type:", typeof chunk, chunk);
      }
    }

    console.log("Final full message:", fullMessage);

    if (fullMessage) {
      return fullMessage;
    } else {
      return "I'm sorry, but I couldn't generate a response at the moment. Please try again later.";
    }
  } catch (error) {
    console.error("Error invoking Bedrock Agent:", error);
    throw new Error(`Failed to process the message: ${error.message}`);
  }
};

export async function populateProductsTable() {
  // Implementation to populate the DynamoDB table
}

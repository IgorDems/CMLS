// routes/aiRoutes.js
import express from "express";
import {
  generateProductDetailsController,
  startOpenAIConversationController,
  sendOpenAIMessageController,
  startBedrockConversationController,
  sendBedrockMessageController,
} from "../controllers/aiController.js";

const router = express.Router();

// GCP Gemini route
router.post("/generate-product", generateProductDetailsController);

// OpenAI routes
router.post("/start", startOpenAIConversationController);
router.post("/message", sendOpenAIMessageController);

// Bedrock routes
router.post("/bedrock/start", startBedrockConversationController);
router.post("/bedrock/message", sendBedrockMessageController);

export default router;

import * as aiService from "../services/aiService.js";

// --- GCP Gemini Product Generation Controller ---
export const generateProductDetailsController = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "Product name is required" });
    }

    const result = await aiService.generateProductDetails(name, category || "General");

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error generating product details with Gemini:", error);
    res.status(500).json({
      success: false,
      error: "Error generating product details",
      details: error.message,
    });
  }
};

// --- Customer Support Chat Controllers (Google Gemini) ---
export const startOpenAIConversationController = async (req, res) => {
  try {
    const threadId = await aiService.createOpenAIConversation();
    res.json({ threadId });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({ error: "Error starting conversation", details: error.message });
  }
};

export const sendOpenAIMessageController = async (req, res) => {
  try {
    const { threadId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Відправляємо запит до Gemini замість Ollama
    const aiResponse = await aiService.sendGeminiChatMessage(message);

    // Повертаємо відповідь фронтенду
    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Error sending message to Gemini Chat:", error);
    res.status(500).json({ error: "Error processing message", details: error.message });
  }
};

export const startBedrockConversationController = startOpenAIConversationController;
export const sendBedrockMessageController = sendOpenAIMessageController;

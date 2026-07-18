// source/backend/src/server.js
import express from "express";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Налаштування CORS з урахуванням вашого домену sslip.io
const corsOptions = {
  origin: [
    'http://cloudmart.192.168.1.240.sslip.io',
    'https://cloudmart.192.168.1.240.sslip.io',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Застосовуємо налаштований CORS та парсинг JSON
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ai", aiRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

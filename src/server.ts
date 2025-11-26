// keep/server/src/server.ts

import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import listRoutes from './routes/listRoutes';
import authRoutes from './routes/authRoutes';
import cors from "cors";

// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer); // Initialize Socket.io

const PORT = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Middleware to parse JSON bodies
app.use(express.json());

// CORS setup with allowed origins
const allowedOrigins = [
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log the denied origin for debugging purposes
        console.log(`CORS Error: Denied origin ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    // Specify the allowed methods and headers
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

// Routes:
app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);

// ------------------------------------
// 🎯 Step 1: MongoDB Connection Logic
// ------------------------------------
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    // Exit process with failure
    process.exit(1);
  }
};

// ------------------------------------
// Base Route (Health Check)
// ------------------------------------
app.get('/', (req: Request, res: Response) => {
  res.send('Keep Server is running!');
});

// ------------------------------------
// Start Server
// ------------------------------------
// Only start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;

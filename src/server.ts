// keep/server/src/server.ts

import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import listRoutes from './routes/listRoutes';
import authRoutes from './routes/authRoutes';

// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer); // Initialize Socket.io

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Middleware to parse JSON bodies
app.use(express.json());

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
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});

export default app;

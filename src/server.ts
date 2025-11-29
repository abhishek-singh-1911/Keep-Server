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
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
}); // Initialize Socket.io

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join_list", (listId) => {
    socket.join(listId);
    console.log(`[Socket] ${socket.id} joined list room: ${listId}`);
  });

  socket.on("leave_list", (listId) => {
    socket.leave(listId);
    console.log(`[Socket] ${socket.id} left list room: ${listId}`);
  });

  socket.on("update_list", (data) => {
    const { listId, ...changes } = data;
    console.log(`[Socket] List update received for ${listId}:`, Object.keys(changes));
    socket.to(listId).emit("list_updated", changes);
  });

  socket.on("collaborator_added", (data) => {
    const { listId, userId } = data;
    console.log(`[Socket] Collaborator added to list ${listId}, user: ${userId}`);
    // Broadcast to all users in the list room (including the new collaborator)
    io.to(listId).emit("collaborator_added", { listId });
  });

  socket.on("collaborator_removed", (data) => {
    const { listId, userId } = data;
    console.log(`[Socket] Collaborator removed from list ${listId}, user: ${userId}`);
    // Broadcast to all users in the list room
    io.to(listId).emit("collaborator_removed", { listId });
  });

  socket.on("permission_changed", (data) => {
    const { listId, userId, permission } = data;
    console.log(`[Socket] Permission changed for list ${listId}, user: ${userId} -> ${permission}`);
    // Broadcast to all users in the list room
    io.to(listId).emit("permission_changed", { listId });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id}, Reason: ${reason}`);
  });
});

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
  console.log('[Server] Health check ping received');
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

export { app, httpServer, io };
export default app;

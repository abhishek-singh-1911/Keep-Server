// keep/server/src/routes/authRoutes.ts

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_not_safe';

// Utility function to generate JWT
const generateToken = (id: string) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d', // Token expires in 30 days
  });
};

// ------------------------------------
// Endpoint 1: POST /api/auth/register
// ------------------------------------
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    console.log(`[Auth] Registration attempt for email: ${email}`);

    // Simple validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    // Creates a new user (password hashing is handled by the model pre-save hook)
    const user = await User.create({ name, email, password });

    // Respond with user data and the token
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id.toString()),
    });
    console.log(`[Auth] User registered successfully: ${user._id}`);
  } catch (error) {
    // Handle MongoDB unique key error (e.g., if findOne misses a race condition)
    if ((error as any).code === 11000) {
      return res.status(400).json({ message: 'User already exists.' });
    }
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ------------------------------------
// Endpoint 2: POST /api/auth/login
// ------------------------------------
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log(`[Auth] Login attempt for email: ${email}`);

    // Check for user
    const user = await User.findOne({ email });

    // Check password using the instance method defined in the model
    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id.toString()),
      });
      console.log(`[Auth] User logged in successfully: ${user._id}`);
    } else {
      console.warn(`[Auth] Invalid login attempt for email: ${email}`);
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

export default router;

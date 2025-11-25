// keep/server/src/models/user.ts

import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// 🎯 TypeScript Interface for the User Document
export interface IUser extends Document {
  email: string;
  password: string; // Stored as a hash
  name: string;
  comparePassword: (candidatePassword: string) => Promise<boolean>; // Instance method
}

// ------------------------------------
// Mongoose Schema Definition
// ------------------------------------
const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
}, {
  timestamps: true
});

// ------------------------------------
// 🔐 Pre-save Hook: Hash Password
// ------------------------------------
UserSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw new Error("Failed to hash password during save.");
  }
});

// ------------------------------------
// Instance Method: Compare Password
// ------------------------------------
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  // Uses the stored hash to compare with the provided candidate password
  return bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser>('User', UserSchema);

export default User;
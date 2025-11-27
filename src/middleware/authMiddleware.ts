// keep/server/src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_not_safe';

// Extend the Express Request interface to include the user object
// This allows us to access req.user in our controllers after authorization
export interface AuthRequest extends Request {
    user?: IUser;
}

// Middleware function to protect routes
const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    // Check if the request contains a token in the Authorization header
    // Format: "Bearer TOKEN_STRING"
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // 1. Get token from header
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify token
            const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

            // 3. Attach the user object to the request
            // Select user by ID, but exclude the password field
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                res.status(401).json({ message: 'Not authorized, user not found' });
                return;
            }

            // The user is authenticated! Attach them to the request object.
            req.user = user;

            // Proceed to the next middleware or route handler
            next();

        } catch (error) {
            console.error('Error during token verification:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        // No token provided in the header
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware to check if user has access to a list (owner OR collaborator)
const protectListAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Import List model here to avoid circular dependency
        const List = (await import('../models/list')).default;

        const { listId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({ message: 'Not authorized, user ID missing' });
            return;
        }

        const list = await List.findOne({ listId });

        if (!list) {
            res.status(404).json({ message: 'List not found' });
            return;
        }

        // Check if user is owner or collaborator
        // Check if user is owner or collaborator
        const isOwner = list.owner.toString() === userId.toString();
        const collaborator = list.collaborators.find(
            (c) => c.userId.toString() === userId.toString()
        );

        if (!isOwner && !collaborator) {
            res.status(403).json({ message: 'Not authorized to access this list' });
            return;
        }

        // User has access, proceed
        next();
    } catch (error) {
        console.error('Error checking list access:', error);
        res.status(500).json({ message: 'Server error checking list access' });
    }
};

// Middleware to check if user has EDIT access to a list (owner OR collaborator with 'edit' permission)
const protectListEditAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const List = (await import('../models/list')).default;
        const { listId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({ message: 'Not authorized, user ID missing' });
            return;
        }

        const list = await List.findOne({ listId });

        if (!list) {
            res.status(404).json({ message: 'List not found' });
            return;
        }

        const isOwner = list.owner.toString() === userId.toString();
        const collaborator = list.collaborators.find(
            (c) => c.userId.toString() === userId.toString()
        );

        const hasEditAccess = isOwner || (collaborator && collaborator.permission === 'edit');

        if (!hasEditAccess) {
            res.status(403).json({ message: 'Not authorized to edit this list' });
            return;
        }

        next();
    } catch (error) {
        console.error('Error checking list edit access:', error);
        res.status(500).json({ message: 'Server error checking list edit access' });
    }
};

export { protect, protectListAccess, protectListEditAccess };
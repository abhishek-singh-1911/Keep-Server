// keep/server/src/routes/listRoutes.ts

import { Router, Request, Response } from 'express';
import List from '../models/list';
import { generateListId } from '../utils/idGenerator';
import { protect, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Endpoint 1: POST /api/lists (CREATE a new List)
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?._id;

    if (!ownerId) {
      return res.status(401).json({ message: 'Not authorized, owner ID missing.' });
    }

    const { name } = req.body;

    // 1. Generate a unique List ID
    let listId = generateListId();
    // Simple check to ensure uniqueness (rare, but good practice)
    while (await List.findOne({ listId })) {
      listId = generateListId();
    }

    // 2. Create the new List document
    const newList = new List({
      listId: listId,
      name: name || 'Untitled List',
      items: [],
      owner: ownerId,
    });

    await newList.save();

    // 3. Respond with the List ID for the frontend to navigate
    res.status(201).json({ listId: newList.listId, name: newList.name });
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ message: 'Failed to create list' });
  }
});

// Endpoint 2: GET /api/lists/:listId (FETCH a List)
router.get('/:listId', async (req: Request, res: Response) => {
  try {
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found.' });
    }

    // 🎯 FIX: Explicitly send back the list object, which now includes 'owner'
    // We use .toObject() to ensure we get a plain JS object representation 
    // that includes all schema fields (like owner).
    res.status(200).json(list.toObject());

  } catch (error) {
    console.error('Error fetching list:', error);
    res.status(500).json({ message: 'Failed to fetch list' });
  }
});

export default router;
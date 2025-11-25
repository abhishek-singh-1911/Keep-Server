// keep/server/src/routes/listRoutes.ts

import { Router, Request, Response } from 'express';
import List from '../models/list';
import User from '../models/user';
import { generateListId, generateItemId } from '../utils/idGenerator';
import { protect, protectListAccess, AuthRequest } from '../middleware/authMiddleware';

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

// Endpoint 3: PUT /api/lists/:listId (UPDATE List Name)
router.put('/:listId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Check ownership
    if (list.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this list' });
    }

    list.name = name || list.name;
    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error updating list:', error);
    res.status(500).json({ message: 'Failed to update list' });
  }
});

// Endpoint 4: DELETE /api/lists/:listId (DELETE List)
router.delete('/:listId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Check ownership
    if (list.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this list' });
    }

    await list.deleteOne();
    res.json({ message: 'List removed' });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ message: 'Failed to delete list' });
  }
});

// Endpoint 5: POST /api/lists/:listId/collaborators (ADD Collaborator)
router.post('/:listId/collaborators', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (list.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add collaborators' });
    }

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (list.collaborators.includes(userToAdd._id as any)) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    if (list.owner.toString() === userToAdd._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot be a collaborator' });
    }

    list.collaborators.push(userToAdd._id as any);
    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: 'Failed to add collaborator' });
  }
});

// Endpoint 6: DELETE /api/lists/:listId/collaborators (REMOVE Collaborator)
router.delete('/:listId/collaborators', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (list.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to remove collaborators' });
    }

    const userToRemove = await User.findOne({ email });
    if (!userToRemove) {
      return res.status(404).json({ message: 'User not found' });
    }

    list.collaborators = list.collaborators.filter(
      (collabId) => collabId.toString() !== userToRemove._id.toString()
    );
    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: 'Failed to remove collaborator' });
  }
});

// ============================================
// STEP 5: LIST ITEM CRUD ENDPOINTS
// ============================================

// Endpoint 7: POST /api/lists/:listId/items (ADD Item)
router.post('/:listId/items', protect, protectListAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Create new item
    const newItem = {
      itemId: generateItemId(),
      text: text || '',
      completed: false,
    };

    list.items.push(newItem);
    await list.save();

    res.status(201).json(list);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ message: 'Failed to add item' });
  }
});

// Endpoint 8: PUT /api/lists/:listId/items/:itemId (UPDATE Item)
router.put('/:listId/items/:itemId', protect, protectListAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { text, completed } = req.body;
    const { listId, itemId } = req.params;

    const list = await List.findOne({ listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Find the item
    const item = list.items.find((i) => i.itemId === itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update item fields
    if (text !== undefined) item.text = text;
    if (completed !== undefined) item.completed = completed;

    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item' });
  }
});

// Endpoint 9: DELETE /api/lists/:listId/items/:itemId (DELETE Item)
router.delete('/:listId/items/:itemId', protect, protectListAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { listId, itemId } = req.params;

    const list = await List.findOne({ listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Filter out the item
    const initialLength = list.items.length;
    list.items = list.items.filter((i) => i.itemId !== itemId);

    if (list.items.length === initialLength) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

export default router;
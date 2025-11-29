// keep/server/src/routes/listRoutes.ts

import { Router, Request, Response } from 'express';
import List from '../models/list';
import User from '../models/user';
import { generateListId, generateItemId } from '../utils/idGenerator';
import { protect, protectListAccess, protectListEditAccess, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// Endpoint 1: POST /api/lists (CREATE a new List)
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?._id;

    if (!ownerId) {
      return res.status(401).json({ message: 'Not authorized, owner ID missing.' });
    }

    const { name } = req.body;
    console.log(`[List] Creating new list for user: ${ownerId}, name: ${name}`);

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

// Endpoint 2: GET /api/lists (GET All Lists for User)
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    // Find lists where user is owner OR collaborator
    console.log(`[List] Fetching all lists for user: ${req.user?._id}`);
    const lists = await List.find({
      $or: [
        { owner: req.user?._id },
        { 'collaborators.userId': req.user?._id }
      ]
    }).sort({ order: 1, updatedAt: -1 })
      .populate('collaborators.userId', 'name email'); // Populate collaborator details

    res.status(200).json(lists);
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ message: 'Failed to fetch lists' });
  }
});

// Endpoint 13: PUT /api/lists/reorder (REORDER Lists)
// IMPORTANT: This must come BEFORE the /:listId route to avoid route conflicts
router.put('/reorder', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { listIds } = req.body; // Array of listIds in desired order
    console.log(`[List] Reordering lists for user: ${req.user?._id}`);

    if (!listIds || !Array.isArray(listIds)) {
      return res.status(400).json({ message: 'listIds must be an array' });
    }

    // Find all lists that belong to the user
    const lists = await List.find({
      $or: [
        { owner: req.user?._id },
        { 'collaborators.userId': req.user?._id }
      ]
    });

    // Validate all listIds exist and belong to user
    const userListIds = lists.map(list => list.listId);
    const allIdsValid = listIds.every((id: string) => userListIds.includes(id));

    if (!allIdsValid) {
      return res.status(400).json({ message: 'Invalid listIds provided' });
    }

    // Update order for each list
    const updatePromises = listIds.map((listId: string, index: number) => {
      return List.updateOne(
        { listId },
        { $set: { order: index } }
      );
    });

    await Promise.all(updatePromises);

    // Fetch updated lists
    const updatedLists = await List.find({
      $or: [
        { owner: req.user?._id },
        { 'collaborators.userId': req.user?._id }
      ]
    }).sort({ order: 1 })
      .populate('collaborators.userId', 'name email');

    res.json(updatedLists);
  } catch (error) {
    console.error('Error reordering lists:', error);
    res.status(500).json({ message: 'Failed to reorder lists' });
  }
});

// Endpoint 3: GET /api/lists/:listId (GET List)
router.get('/:listId', async (req: Request, res: Response) => {
  try {
    console.log(`[List] Fetching list: ${req.params.listId}`);
    const list = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

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
    console.log(`[List] Updating list name: ${req.params.listId}, new name: ${name}`);
    const list = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Only owner can update list name
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
    console.log(`[List] Deleting list: ${req.params.listId}`);

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
    console.log(`[List] Adding collaborator ${email} to list ${req.params.listId}`);
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

    if (list.collaborators.some(c => c.userId.toString() === userToAdd._id.toString())) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    if (list.owner.toString() === userToAdd._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot be a collaborator' });
    }

    list.collaborators.push({
      userId: userToAdd._id as any,
      permission: 'view' // Default permission
    });
    await list.save();

    // Re-fetch to get populated data
    const populatedList = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

    res.json(populatedList);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: 'Failed to add collaborator' });
  }
});

// Endpoint 6: DELETE /api/lists/:listId/collaborators (REMOVE Collaborator)
router.delete('/:listId/collaborators', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    console.log(`[List] Removing collaborator ${email} from list ${req.params.listId}`);
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
      (collab) => collab.userId.toString() !== userToRemove._id.toString()
    );
    await list.save();

    // Re-fetch to get populated data
    const populatedList = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

    res.json(populatedList);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: 'Failed to remove collaborator' });
  }
});

// Endpoint 14: PUT /api/lists/:listId/collaborators (UPDATE Collaborator Permission)
router.put('/:listId/collaborators', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { email, permission } = req.body;
    console.log(`[List] Updating permission for ${email} in list ${req.params.listId} to ${permission}`);
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (list.owner.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update permissions' });
    }

    const userToUpdate = await User.findOne({ email });
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const collaborator = list.collaborators.find(
      (c) => c.userId.toString() === userToUpdate._id.toString()
    );

    if (!collaborator) {
      return res.status(404).json({ message: 'User is not a collaborator' });
    }

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({ message: 'Invalid permission' });
    }

    collaborator.permission = permission;
    await list.save();

    // Re-fetch to get populated data
    const populatedList = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

    res.json(populatedList);
  } catch (error) {
    console.error('Error updating collaborator permission:', error);
    res.status(500).json({ message: 'Failed to update collaborator permission' });
  }
});

// ============================================
// STEP 5: LIST ITEM CRUD ENDPOINTS
// ============================================

// Endpoint 7: POST /api/lists/:listId/items (ADD Item)
router.post('/:listId/items', protect, protectListEditAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    console.log(`[List] Adding item to list ${req.params.listId}: ${text}`);
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Create new item with order set to end of list
    const newItem = {
      itemId: generateItemId(),
      text: text || '',
      completed: false,
      order: list.items.length, // Set order to current length (0-indexed)
    };

    list.items.push(newItem);
    await list.save();

    res.status(201).json(list);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ message: 'Failed to add item' });
  }
});

// Endpoint 10: PUT /api/lists/:listId/items/reorder (REORDER Items)
// IMPORTANT: This must come BEFORE the /:itemId route to avoid route conflicts
router.put('/:listId/items/reorder', protect, protectListEditAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { itemIds } = req.body; // Array of itemIds in desired order
    console.log(`[List] Reordering items in list ${req.params.listId}`);
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ message: 'itemIds must be an array' });
    }

    // Validate all itemIds exist
    const existingItemIds = list.items.map(item => item.itemId);
    const allIdsValid = itemIds.every(id => existingItemIds.includes(id));

    if (!allIdsValid) {
      return res.status(400).json({ message: 'Invalid itemIds provided' });
    }

    // Update order for each item
    itemIds.forEach((itemId, index) => {
      const item = list.items.find(i => i.itemId === itemId);
      if (item) {
        item.order = index;
      }
    });

    // Sort items by order
    list.items.sort((a, b) => a.order - b.order);

    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error reordering items:', error);
    res.status(500).json({ message: 'Failed to reorder items' });
  }
});

// Endpoint 8: PUT /api/lists/:listId/items/:itemId (UPDATE Item)
router.put('/:listId/items/:itemId', protect, protectListEditAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { text, completed } = req.body;
    const { listId, itemId } = req.params;
    console.log(`[List] Updating item ${itemId} in list ${listId}`);

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
router.delete('/:listId/items/:itemId', protect, protectListEditAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { listId, itemId } = req.params;
    console.log(`[List] Deleting item ${itemId} from list ${listId}`);

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

// Endpoint 11: PUT /api/lists/:listId/archive (ARCHIVE/UNARCHIVE List)
router.put('/:listId/archive', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { archived } = req.body;
    console.log(`[List] Setting archive status for list ${req.params.listId} to ${archived}`);
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Check if user is OWNER (only owner can archive/delete)
    const isOwner = list.owner.toString() === req.user?._id.toString();

    if (!isOwner) {
      return res.status(403).json({ message: 'Not authorized to archive this list' });
    }

    list.archived = archived !== undefined ? archived : !list.archived;

    // If archiving, remove all collaborators
    if (list.archived) {
      list.collaborators = [];
    }

    await list.save();

    // Re-fetch to get populated data
    const populatedList = await List.findOne({ listId: req.params.listId })
      .populate('collaborators.userId', 'name email');

    res.json(populatedList);
  } catch (error) {
    console.error('Error archiving list:', error);
    res.status(500).json({ message: 'Failed to archive list' });
  }
});

// Endpoint 12: PUT /api/lists/:listId/pin (PIN/UNPIN List)
router.put('/:listId/pin', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { pinned } = req.body;
    console.log(`[List] Setting pin status for list ${req.params.listId} to ${pinned}`);
    const list = await List.findOne({ listId: req.params.listId });

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Check if user is OWNER (only owner can pin)
    const isOwner = list.owner.toString() === req.user?._id.toString();

    if (!isOwner) {
      return res.status(403).json({ message: 'Not authorized to pin this list' });
    }

    list.pinned = pinned !== undefined ? pinned : !list.pinned;
    await list.save();

    res.json(list);
  } catch (error) {
    console.error('Error pinning list:', error);
    res.status(500).json({ message: 'Failed to pin list' });
  }
});

export default router;
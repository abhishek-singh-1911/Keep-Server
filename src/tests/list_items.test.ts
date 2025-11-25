import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const owner = {
  name: 'List Owner',
  email: 'owner@example.com',
  password: 'password123',
};
const collaborator = {
  name: 'Collaborator User',
  email: 'collaborator@example.com',
  password: 'password456',
};
const outsider = {
  name: 'Outsider User',
  email: 'outsider@example.com',
  password: 'password789',
};

let ownerToken: string;
let collaboratorToken: string;
let outsiderToken: string;
let listId: string;
let itemId: string;

// --- Helper function to ensure Mongoose is connected ---
const connectToTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
};

// --- Test Suite Setup and Teardown ---
beforeAll(async () => {
  await connectToTestDB();
  await User.deleteMany({});
  await List.deleteMany({});

  // Register and get tokens
  const ownerRes = await request(app).post('/api/auth/register').send(owner);
  expect(ownerRes.statusCode).toBe(201);
  ownerToken = ownerRes.body.token;

  const collabRes = await request(app).post('/api/auth/register').send(collaborator);
  expect(collabRes.statusCode).toBe(201);
  collaboratorToken = collabRes.body.token;

  const outsiderRes = await request(app).post('/api/auth/register').send(outsider);
  expect(outsiderRes.statusCode).toBe(201);
  outsiderToken = outsiderRes.body.token;

  // Create a list as owner
  const listRes = await request(app)
    .post('/api/lists')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Shopping List' });
  listId = listRes.body.listId;

  // Add collaborator to the list
  await request(app)
    .post(`/api/lists/${listId}/collaborators`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email: collaborator.email });
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Step 5: List Item CRUD Operations', () => {

  // ==========================================
  // ADD ITEM TESTS
  // ==========================================
  describe('POST /api/lists/:listId/items - Add Item', () => {

    it('should allow owner to add an item', async () => {
      const res = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Buy milk' });

      expect(res.statusCode).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].text).toBe('Buy milk');
      expect(res.body.items[0].completed).toBe(false);
      expect(res.body.items[0].itemId).toBeDefined();

      // Save itemId for later tests
      itemId = res.body.items[0].itemId;
    });

    it('should allow collaborator to add an item', async () => {
      const res = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Buy eggs' });

      expect(res.statusCode).toBe(201);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[1].text).toBe('Buy eggs');
    });

    it('should NOT allow outsider to add an item', async () => {
      const res = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ text: 'Hack attempt' });

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow unauthenticated user to add an item', async () => {
      const res = await request(app)
        .post(`/api/lists/${listId}/items`)
        .send({ text: 'No auth' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for non-existent list', async () => {
      const res = await request(app)
        .post('/api/lists/fake-list-id/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Test' });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================
  // UPDATE ITEM TESTS
  // ==========================================
  describe('PUT /api/lists/:listId/items/:itemId - Update Item', () => {

    it('should allow owner to update item text', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Buy organic milk' });

      expect(res.statusCode).toBe(200);
      const updatedItem = res.body.items.find((i: any) => i.itemId === itemId);
      expect(updatedItem.text).toBe('Buy organic milk');
      expect(updatedItem.completed).toBe(false);
    });

    it('should allow collaborator to toggle item completion', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ completed: true });

      expect(res.statusCode).toBe(200);
      const updatedItem = res.body.items.find((i: any) => i.itemId === itemId);
      expect(updatedItem.completed).toBe(true);
      expect(updatedItem.text).toBe('Buy organic milk'); // Text unchanged
    });

    it('should allow updating both text and completion', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Buy almond milk', completed: false });

      expect(res.statusCode).toBe(200);
      const updatedItem = res.body.items.find((i: any) => i.itemId === itemId);
      expect(updatedItem.text).toBe('Buy almond milk');
      expect(updatedItem.completed).toBe(false);
    });

    it('should NOT allow outsider to update an item', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ text: 'Hacked' });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent item', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/items/fake-item-id`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Test' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Item not found');
    });

    it('should return 404 for non-existent list', async () => {
      const res = await request(app)
        .put(`/api/lists/fake-list-id/items/${itemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ text: 'Test' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('List not found');
    });
  });

  // ==========================================
  // DELETE ITEM TESTS
  // ==========================================
  describe('DELETE /api/lists/:listId/items/:itemId - Delete Item', () => {

    it('should NOT allow outsider to delete an item', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should allow collaborator to delete an item', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1); // One item left
      const deletedItem = res.body.items.find((i: any) => i.itemId === itemId);
      expect(deletedItem).toBeUndefined();
    });

    it('should allow owner to delete remaining item', async () => {
      // Get the remaining item ID
      const listRes = await request(app)
        .get(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const remainingItemId = listRes.body.items[0].itemId;

      const res = await request(app)
        .delete(`/api/lists/${listId}/items/${remainingItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('should return 404 when deleting non-existent item', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}/items/fake-item-id`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Item not found');
    });

    it('should return 404 for non-existent list', async () => {
      const res = await request(app)
        .delete('/api/lists/fake-list-id/items/some-item-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('List not found');
    });
  });
});

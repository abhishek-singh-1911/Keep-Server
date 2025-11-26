import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const user1 = {
  name: 'Test User 1',
  email: 'user1@test.com',
  password: 'password123',
};

const user2 = {
  name: 'Test User 2',
  email: 'user2@test.com',
  password: 'password456',
};

let user1Token: string;
let user2Token: string;
let listId: string;

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

  // Register and Login User 1
  const regRes1 = await request(app).post('/api/auth/register').send(user1);
  expect(regRes1.statusCode).toBe(201);
  user1Token = regRes1.body.token;
  expect(user1Token).toBeDefined();

  // Register and Login User 2
  const regRes2 = await request(app).post('/api/auth/register').send(user2);
  expect(regRes2.statusCode).toBe(201);
  user2Token = regRes2.body.token;
  expect(user2Token).toBeDefined();
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('List Archive and Pin Functionality', () => {

  // Create a list before each test
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Test List' });

    expect(res.statusCode).toBe(201);
    listId = res.body.listId;
  });

  // Clean up after each test
  afterEach(async () => {
    await List.deleteMany({});
  });

  describe('Archive Functionality', () => {
    it('should archive a list when owner sets archived to true', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.archived).toBe(true);
      expect(res.body.listId).toBe(listId);
    });

    it('should unarchive a list when owner sets archived to false', async () => {
      // First archive it
      await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      // Then unarchive it
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.archived).toBe(false);
    });

    it('should toggle archive state when no archived value is provided', async () => {
      // First call should archive (toggle from false to true)
      const res1 = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res1.statusCode).toBe(200);
      expect(res1.body.archived).toBe(true);

      // Second call should unarchive (toggle from true to false)
      const res2 = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res2.statusCode).toBe(200);
      expect(res2.body.archived).toBe(false);
    });

    it('should allow collaborator to archive a list', async () => {
      // Add user2 as collaborator
      await request(app)
        .post(`/api/lists/${listId}/collaborators`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: user2.email });

      // User2 (collaborator) archives the list
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.archived).toBe(true);
    });

    it('should NOT allow non-owner/non-collaborator to archive a list', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Not authorized');
    });

    it('should return 404 for non-existent list', async () => {
      const res = await request(app)
        .put('/api/lists/INVALID123/archive')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .send({ archived: true });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Pin Functionality', () => {
    it('should pin a list when owner sets pinned to true', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.pinned).toBe(true);
      expect(res.body.listId).toBe(listId);
    });

    it('should unpin a list when owner sets pinned to false', async () => {
      // First pin it
      await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      // Then unpin it
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.pinned).toBe(false);
    });

    it('should toggle pin state when no pinned value is provided', async () => {
      // First call should pin (toggle from false to true)
      const res1 = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res1.statusCode).toBe(200);
      expect(res1.body.pinned).toBe(true);

      // Second call should unpin (toggle from true to false)
      const res2 = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(res2.statusCode).toBe(200);
      expect(res2.body.pinned).toBe(false);
    });

    it('should allow collaborator to pin a list', async () => {
      // Add user2 as collaborator
      await request(app)
        .post(`/api/lists/${listId}/collaborators`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: user2.email });

      // User2 (collaborator) pins the list
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.pinned).toBe(true);
    });

    it('should NOT allow non-owner/non-collaborator to pin a list', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Not authorized');
    });

    it('should return 404 for non-existent list', async () => {
      const res = await request(app)
        .put('/api/lists/INVALID123/pin')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Combined Archive and Pin', () => {
    it('should allow a list to be both archived and pinned', async () => {
      // Archive the list
      const archiveRes = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      expect(archiveRes.statusCode).toBe(200);
      expect(archiveRes.body.archived).toBe(true);

      // Pin the list
      const pinRes = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      expect(pinRes.statusCode).toBe(200);
      expect(pinRes.body.pinned).toBe(true);
      expect(pinRes.body.archived).toBe(true);
    });

    it('should maintain pin state when archiving', async () => {
      // Pin the list first
      await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      // Archive the list
      const res = await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.archived).toBe(true);
      expect(res.body.pinned).toBe(true);
    });

    it('should maintain archive state when pinning', async () => {
      // Archive the list first
      await request(app)
        .put(`/api/lists/${listId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ archived: true });

      // Pin the list
      const res = await request(app)
        .put(`/api/lists/${listId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.pinned).toBe(true);
      expect(res.body.archived).toBe(true);
    });
  });

  describe('Delete Functionality', () => {
    it('should allow owner to delete a list', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('List removed');
    });

    it('should NOT allow collaborator to delete a list', async () => {
      // Add user2 as collaborator
      await request(app)
        .post(`/api/lists/${listId}/collaborators`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ email: user2.email });

      // User2 tries to delete
      const res = await request(app)
        .delete(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow non-owner/non-collaborator to delete a list', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when deleting non-existent list', async () => {
      const res = await request(app)
        .delete('/api/lists/INVALID123')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(404);
    });

    it('should require authentication to delete', async () => {
      const res = await request(app)
        .delete(`/api/lists/${listId}`);

      expect(res.statusCode).toBe(401);
    });

    it('should permanently delete list (not retrievable after deletion)', async () => {
      // Delete the list
      await request(app)
        .delete(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      // Try to get the deleted list
      const res = await request(app)
        .get(`/api/lists/${listId}`);

      expect(res.statusCode).toBe(404);
    });
  });
});

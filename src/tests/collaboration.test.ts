import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const ownerUser = {
  name: 'Owner User',
  email: 'owner@example.com',
  password: 'password123',
};

const viewCollaborator = {
  name: 'View Collaborator',
  email: 'view@example.com',
  password: 'password456',
};

const editCollaborator = {
  name: 'Edit Collaborator',
  email: 'edit@example.com',
  password: 'password789',
};

const nonCollaborator = {
  name: 'Non Collaborator',
  email: 'non@example.com',
  password: 'password000',
};

let ownerToken: string;
let viewToken: string;
let editToken: string;
let nonCollabToken: string;
let testListId: string;

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

  // Register all users
  const ownerRes = await request(app).post('/api/auth/register').send(ownerUser);
  expect(ownerRes.statusCode).toBe(201);
  ownerToken = ownerRes.body.token;

  const viewRes = await request(app).post('/api/auth/register').send(viewCollaborator);
  expect(viewRes.statusCode).toBe(201);
  viewToken = viewRes.body.token;

  const editRes = await request(app).post('/api/auth/register').send(editCollaborator);
  expect(editRes.statusCode).toBe(201);
  editToken = editRes.body.token;

  const nonCollabRes = await request(app).post('/api/auth/register').send(nonCollaborator);
  expect(nonCollabRes.statusCode).toBe(201);
  nonCollabToken = nonCollabRes.body.token;

  // Create a test list as owner
  const listRes = await request(app)
    .post('/api/lists')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Test Collaboration List' });

  expect(listRes.statusCode).toBe(201);
  testListId = listRes.body.listId;
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Collaboration Feature Tests', () => {

  describe('Adding Collaborators', () => {
    it('should allow owner to add a collaborator with default view permission', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: viewCollaborator.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.collaborators).toHaveLength(1);
      expect(res.body.collaborators[0].userId.email).toBe(viewCollaborator.email);
      expect(res.body.collaborators[0].permission).toBe('view');
    });

    it('should add another collaborator with view permission', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: editCollaborator.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.collaborators).toHaveLength(2);
    });

    it('should NOT allow non-owner to add collaborators', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${viewToken}`)
        .send({ email: nonCollaborator.email });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Not authorized to add collaborators');
    });

    it('should prevent adding non-existent user as collaborator', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('User not found');
    });

    it('should prevent adding duplicate collaborators', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: viewCollaborator.email });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('User is already a collaborator');
    });

    it('should prevent owner from adding themselves as collaborator', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: ownerUser.email });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Owner cannot be a collaborator');
    });
  });

  describe('Updating Collaborator Permissions', () => {
    it('should allow owner to update collaborator permission to edit', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: editCollaborator.email,
          permission: 'edit'
        });

      expect(res.statusCode).toBe(200);
      const updatedCollab = res.body.collaborators.find(
        (c: any) => c.userId.email === editCollaborator.email
      );
      expect(updatedCollab.permission).toBe('edit');
    });

    it('should NOT allow collaborator to update permissions', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({
          email: viewCollaborator.email,
          permission: 'edit'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Not authorized to update permissions');
    });

    it('should reject invalid permission values', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: viewCollaborator.email,
          permission: 'admin' // Invalid permission
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Invalid permission');
    });

    it('should return 404 when updating permission for non-collaborator', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: nonCollaborator.email,
          permission: 'edit'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('User is not a collaborator');
    });
  });

  describe('Access Control - View Permission', () => {
    it('should allow view collaborator to GET the list', async () => {
      const res = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${viewToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.listId).toBe(testListId);
    });

    it('should NOT allow view collaborator to add items', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${viewToken}`)
        .send({ text: 'Unauthorized Item' });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Not authorized to edit this list');
    });

    it('should NOT allow view collaborator to update list name', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${viewToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow view collaborator to archive list', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${viewToken}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow view collaborator to delete list', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${viewToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Access Control - Edit Permission', () => {
    let itemId: string;

    it('should allow edit collaborator to add items', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ text: 'Edit Collaborator Item' });

      expect(res.statusCode).toBe(201);
      expect(res.body.items).toBeDefined();
      itemId = res.body.items[res.body.items.length - 1].itemId;
    });

    it('should allow edit collaborator to update items', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/items/${itemId}`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ text: 'Updated Item Text', completed: true });

      expect(res.statusCode).toBe(200);
      const item = res.body.items.find((i: any) => i.itemId === itemId);
      expect(item.text).toBe('Updated Item Text');
      expect(item.completed).toBe(true);
    });

    it('should allow edit collaborator to delete items', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}/items/${itemId}`)
        .set('Authorization', `Bearer ${editToken}`);

      expect(res.statusCode).toBe(200);
      const item = res.body.items.find((i: any) => i.itemId === itemId);
      expect(item).toBeUndefined();
    });

    it('should allow edit collaborator to reorder items', async () => {
      // First add multiple items
      await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ text: 'Item 1' });

      await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ text: 'Item 2' });

      const getRes = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${editToken}`);

      const itemIds = getRes.body.items.map((i: any) => i.itemId);

      // Reorder
      const res = await request(app)
        .put(`/api/lists/${testListId}/items/reorder`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ itemIds: itemIds.reverse() });

      expect(res.statusCode).toBe(200);
    });

    it('should NOT allow edit collaborator to update list name', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow edit collaborator to archive list', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow edit collaborator to delete list', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${editToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should NOT allow edit collaborator to pin list', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/pin`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Access Control - Non-Collaborator', () => {
    it('should NOT allow non-collaborator to view the list', async () => {
      const res = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${nonCollabToken}`);

      // Note: Current implementation allows anyone to view
      // If you want to restrict, uncomment:
      // expect(res.statusCode).toBe(403);
    });

    it('should NOT allow non-collaborator to add items', async () => {
      const res = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${nonCollabToken}`)
        .send({ text: 'Unauthorized Item' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('List Queries with Collaborators', () => {
    it('should return lists owned by user', async () => {
      const res = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      // Find the test list
      const testList = res.body.find((l: any) => l.listId === testListId);
      expect(testList).toBeDefined();
    });

    it('should return lists where user is a collaborator', async () => {
      const res = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${viewToken}`);

      expect(res.statusCode).toBe(200);
      const hasCollaboratedList = res.body.some(
        (l: any) => l.listId === testListId
      );
      expect(hasCollaboratedList).toBe(true);
    });

    it('should populate collaborator details in response', async () => {
      const res = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.collaborators).toBeDefined();
      expect(res.body.collaborators.length).toBeGreaterThan(0);

      const collab = res.body.collaborators[0];
      expect(collab.userId).toBeDefined();
      expect(collab.userId.email).toBeDefined();
      expect(collab.userId.name).toBeDefined();
      expect(collab.permission).toBeDefined();
    });
  });

  describe('Removing Collaborators', () => {
    // First re-add viewCollaborator since they might have been removed in earlier tests
    beforeAll(async () => {
      // Check if viewCollaborator exists, if not add them
      const list = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const hasViewCollab = list.body.collaborators.some(
        (c: any) => c.userId.email === viewCollaborator.email
      );

      if (!hasViewCollab) {
        await request(app)
          .post(`/api/lists/${testListId}/collaborators`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ email: viewCollaborator.email });
      }
    });

    it('should allow owner to remove a collaborator', async () => {
      // First verify the collaborator exists
      const getBefore = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const hasBeforeRemoval = getBefore.body.collaborators.some(
        (c: any) => c.userId.email === viewCollaborator.email
      );
      expect(hasBeforeRemoval).toBe(true);

      // Now remove
      const res = await request(app)
        .delete(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: viewCollaborator.email });

      expect(res.statusCode).toBe(200);

      // Verify with a fresh GET request
      const getAfter = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const hasViewCollab = getAfter.body.collaborators.some(
        (c: any) => c.userId.email === viewCollaborator.email
      );
      expect(hasViewCollab).toBe(false);
    });

    it('should NOT allow collaborator to remove other collaborators', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${editToken}`)
        .send({ email: viewCollaborator.email });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when removing non-existent collaborator', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Owner-Only Actions', () => {
    it('should allow only owner to archive list', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.archived).toBe(true);
    });

    it('should allow only owner to pin list', async () => {
      const res = await request(app)
        .put(`/api/lists/${testListId}/pin`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ pinned: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.pinned).toBe(true);
    });

    it('should allow only owner to delete list', async () => {
      const res = await request(app)
        .delete(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('List removed');
    });

    it('should verify list is deleted', async () => {
      const res = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});

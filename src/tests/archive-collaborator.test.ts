import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// Test data
const owner = {
  name: 'Owner User',
  email: 'owner@test.com',
  password: 'password123',
};

const collaborator = {
  name: 'Collaborator User',
  email: 'collab@test.com',
  password: 'password123',
};

let ownerToken: string;
let collaboratorToken: string;
let testListId: string;

// Connect to test database
const connectToTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
};

beforeAll(async () => {
  await connectToTestDB();
  await User.deleteMany({});
  await List.deleteMany({});

  // Register users
  const ownerRes = await request(app)
    .post('/api/auth/register')
    .send(owner);
  ownerToken = ownerRes.body.token;

  const collabRes = await request(app)
    .post('/api/auth/register')
    .send(collaborator);
  collaboratorToken = collabRes.body.token;
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Archive and Collaborator Features', () => {
  describe('Remove Collaborators on Archive', () => {
    beforeEach(async () => {
      // Create a new list for each test
      const listRes = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Test List' });

      testListId = listRes.body.listId;

      // Add collaborator
      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email });
    });

    afterEach(async () => {
      // Clean up lists after each test
      await List.deleteMany({});
    });

    it('should remove all collaborators when archiving a list', async () => {
      // Verify collaborator was added
      let list = await List.findOne({ listId: testListId }).populate('collaborators.userId');
      expect(list?.collaborators.length).toBe(1);

      // Archive the list
      const archiveRes = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: true });

      expect(archiveRes.statusCode).toBe(200);
      expect(archiveRes.body.archived).toBe(true);
      expect(archiveRes.body.collaborators).toHaveLength(0);

      // Verify in database
      list = await List.findOne({ listId: testListId });
      expect(list?.archived).toBe(true);
      expect(list?.collaborators.length).toBe(0);
    });

    it('should not remove collaborators when unarchiving', async () => {
      // Archive first (which removes collaborators)
      await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: true });

      // V verify collaborators are removed
      let list = await List.findOne({ listId: testListId });
      expect(list?.collaborators.length).toBe(0);

      // Unarchive the list
      const unarchiveRes = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: false });

      expect(unarchiveRes.statusCode).toBe(200);
      expect(unarchiveRes.body.archived).toBe(false);
      // Collaborators should still be empty (not automatically restored)
      expect(unarchiveRes.body.collaborators).toHaveLength(0);
    });

    it('should not allow collaborators to archive a list', async () => {
      const archiveRes = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ archived: true });

      expect(archiveRes.statusCode).toBe(403);
      expect(archiveRes.body.message).toBe('Not authorized to archive this list');
    });

    it('should not show archived list to collaborators after archiving', async () => {
      // Archive the list (removes collaborators)
      await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: true });

      // Try to get all lists as collaborator
      const listsRes = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(listsRes.statusCode).toBe(200);
      // Should not see the archived list (since they're not a collaborator anymore)
      const hasArchivedList = listsRes.body.some((l: any) => l.listId === testListId);
      expect(hasArchivedList).toBe(false);
    });
  });

  describe('Collaborator Permission Management', () => {
    beforeEach(async () => {
      // Create a new list
      const listRes = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Permission Test List' });

      testListId = listRes.body.listId;

      // Add collaborator with view permission
      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email });
    });

    afterEach(async () => {
      await List.deleteMany({});
    });

    it('should allow owner to change collaborator permission from view to edit', async () => {
      // Change permission to edit
      const permRes = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email, permission: 'edit' });

      expect(permRes.statusCode).toBe(200);
      const collab = permRes.body.collaborators.find(
        (c: any) => c.userId.email === collaborator.email
      );
      expect(collab.permission).toBe('edit');
    });

    it('should allow owner to change collaborator permission from edit to view', async () => {
      // First set to edit
      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email, permission: 'edit' });

      // Then change back to view
      const permRes = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email, permission: 'view' });

      expect(permRes.statusCode).toBe(200);
      const collab = permRes.body.collaborators.find(
        (c: any) => c.userId.email === collaborator.email
      );
      expect(collab.permission).toBe('view');
    });

    it('should allow owner to remove collaborators anytime', async () => {
      // Remove collaborator
      const removeRes = await request(app)
        .delete(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaborator.email });

      expect(removeRes.statusCode).toBe(200);
      expect(removeRes.body.collaborators).toHaveLength(0);
    });
  });
});

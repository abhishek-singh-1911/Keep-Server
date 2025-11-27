import request from 'supertest';
import mongoose from 'mongoose';
import { app, httpServer } from '../server';
import User from '../models/user';
import List from '../models/list';
import { io as ioClient, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5002';

// --- Setup Test Variables ---
const ownerUser = {
  name: 'Owner User',
  email: 'owner-integration@example.com',
  password: 'password123',
};

const collaboratorUser = {
  name: 'Collaborator User',
  email: 'collab-integration@example.com',
  password: 'password456',
};

let ownerToken: string;
let collaboratorToken: string;
let testListId: string;
let ownerSocket: Socket;
let collaboratorSocket: Socket;

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

  // Start the HTTP server for Socket.IO
  if (!httpServer.listening) {
    httpServer.listen(5002);
  }

  // Register users
  const ownerRes = await request(app)
    .post('/api/auth/register')
    .send(ownerUser);
  ownerToken = ownerRes.body.token;

  const collabRes = await request(app)
    .post('/api/auth/register')
    .send(collaboratorUser);
  collaboratorToken = collabRes.body.token;

  // Create a test list
  const listRes = await request(app)
    .post('/api/lists')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Integration Test List' });
  testListId = listRes.body.listId;
});

afterAll(async () => {
  if (ownerSocket) ownerSocket.disconnect();
  if (collaboratorSocket) collaboratorSocket.disconnect();

  // Close server
  if (httpServer.listening) {
    httpServer.close();
  }

  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Collaboration Integration Tests', () => {

  describe('End-to-End Collaboration Flow', () => {
    it('should complete full collaboration workflow', async () => {
      // Step 1: Owner adds collaborator
      const addRes = await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email });

      expect(addRes.statusCode).toBe(200);
      expect(addRes.body.collaborators).toHaveLength(1);
      expect(addRes.body.collaborators[0].permission).toBe('view');

      // Step 2: Collaborator can now see the list
      const viewRes = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(viewRes.statusCode).toBe(200);
      const hasCollaboratedList = viewRes.body.some(
        (l: any) => l.listId === testListId
      );
      expect(hasCollaboratedList).toBe(true);

      // Step 3: Collaborator with view permission cannot add items
      const addItemRes = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Should Fail' });

      expect(addItemRes.statusCode).toBe(403);

      // Step 4: Owner upgrades collaborator to edit permission
      const updatePermRes = await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: collaboratorUser.email,
          permission: 'edit'
        });

      expect(updatePermRes.statusCode).toBe(200);
      const updatedCollab = updatePermRes.body.collaborators.find(
        (c: any) => c.userId.email === collaboratorUser.email
      );
      expect(updatedCollab.permission).toBe('edit');

      // Step 5: Collaborator with edit permission can now add items
      const addItemRes2 = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Collaborator Item' });

      expect(addItemRes2.statusCode).toBe(201);
      expect(addItemRes2.body.items).toBeDefined();

      // Step 6: Collaborator still cannot delete the list
      const deleteRes = await request(app)
        .delete(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(deleteRes.statusCode).toBe(403);

      // Step 7: Owner can still perform all actions
      const archiveRes = await request(app)
        .put(`/api/lists/${testListId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ archived: true });

      expect(archiveRes.statusCode).toBe(200);
      expect(archiveRes.body.archived).toBe(true);
    });
  });

  describe('Real-time Socket Events', () => {
    beforeEach((done) => {
      ownerSocket = ioClient(SOCKET_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      collaboratorSocket = ioClient(SOCKET_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      let connectedCount = 0;
      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      ownerSocket.on('connect', checkConnected);
      collaboratorSocket.on('connect', checkConnected);
    });

    afterEach(() => {
      if (ownerSocket) ownerSocket.disconnect();
      if (collaboratorSocket) collaboratorSocket.disconnect();
    });

    it('should broadcast collaborator_added event', (done) => {
      // Both sockets join the list room
      ownerSocket.emit('join_list', testListId);
      collaboratorSocket.emit('join_list', testListId);

      // Collaborator listens for the event
      collaboratorSocket.on('collaborator_added', (data: any) => {
        expect(data.listId).toBe(testListId);
        done();
      });

      // Owner adds a new collaborator (simulated)
      setTimeout(() => {
        ownerSocket.emit('collaborator_added', {
          listId: testListId,
          userId: 'some-user-id',
        });
      }, 100);
    });

    it('should broadcast collaborator_removed event', (done) => {
      ownerSocket.emit('join_list', testListId);
      collaboratorSocket.emit('join_list', testListId);

      collaboratorSocket.on('collaborator_removed', (data: any) => {
        expect(data.listId).toBe(testListId);
        done();
      });

      setTimeout(() => {
        ownerSocket.emit('collaborator_removed', {
          listId: testListId,
          userId: 'some-user-id',
        });
      }, 100);
    });

    it('should broadcast permission_changed event', (done) => {
      ownerSocket.emit('join_list', testListId);
      collaboratorSocket.emit('join_list', testListId);

      collaboratorSocket.on('permission_changed', (data: any) => {
        expect(data.listId).toBe(testListId);
        done();
      });

      setTimeout(() => {
        ownerSocket.emit('permission_changed', {
          listId: testListId,
          userId: 'some-user-id',
          permission: 'edit',
        });
      }, 100);
    });

    it('should broadcast list_updated event for item changes', (done) => {
      ownerSocket.emit('join_list', testListId);
      collaboratorSocket.emit('join_list', testListId);

      collaboratorSocket.on('list_updated', (changes: any) => {
        expect(changes).toBeDefined();
        done();
      });

      setTimeout(() => {
        ownerSocket.emit('update_list', {
          listId: testListId,
          items: [{ itemId: '123', text: 'New Item', completed: false }],
        });
      }, 100);
    });

    it('should only broadcast to list room members', (done) => {
      const otherListId = 'OTHER123';

      ownerSocket.emit('join_list', testListId);
      collaboratorSocket.emit('join_list', otherListId);

      let eventReceived = false;
      collaboratorSocket.on('list_updated', () => {
        eventReceived = true;
      });

      ownerSocket.emit('update_list', {
        listId: testListId,
        items: [],
      });

      setTimeout(() => {
        expect(eventReceived).toBe(false);
        done();
      }, 500);
    });
  });

  describe('Permission Transitions', () => {
    let itemId: string;

    beforeEach(async () => {
      // Reset collaborators for the list
      const list = await List.findOne({ listId: testListId });
      if (list) {
        list.collaborators = [];
        await list.save();
      }
    });

    it('should handle permission upgrade (view to edit)', async () => {
      // Add collaborator with view permission
      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email });

      // Cannot add items with view permission
      const failRes = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Should Fail' });

      expect(failRes.statusCode).toBe(403);

      // Upgrade to edit permission
      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: collaboratorUser.email,
          permission: 'edit'
        });

      // Can now add items
      const successRes = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Success Item' });

      expect(successRes.statusCode).toBe(201);
      itemId = successRes.body.items[successRes.body.items.length - 1].itemId;
    });

    it('should handle permission downgrade (edit to view)', async () => {
      // Downgrade to view permission
      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: collaboratorUser.email,
          permission: 'view'
        });

      // Cannot update items with view permission
      const failRes = await request(app)
        .put(`/api/lists/${testListId}/items/${itemId}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Should Fail' });

      expect(failRes.statusCode).toBe(403);
    });
  });

  describe('Collaborative Editing', () => {
    it('should allow multiple edit collaborators to work simultaneously', async () => {
      // Create second collaborator
      const collab2 = {
        name: 'Second Collaborator',
        email: 'collab2-integration@example.com',
        password: 'password789',
      };

      const collab2Res = await request(app)
        .post('/api/auth/register')
        .send(collab2);
      const collab2Token = collab2Res.body.token;

      // Add both as edit collaborators
      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email });

      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email, permission: 'edit' });

      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collab2.email });

      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collab2.email, permission: 'edit' });

      // Both add items
      const item1Res = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Collab 1 Item' });

      const item2Res = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collab2Token}`)
        .send({ text: 'Collab 2 Item' });

      expect(item1Res.statusCode).toBe(201);
      expect(item2Res.statusCode).toBe(201);

      // Get list and verify both items exist
      const getRes = await request(app)
        .get(`/api/lists/${testListId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const items = getRes.body.items;
      const hasItem1 = items.some((i: any) => i.text === 'Collab 1 Item');
      const hasItem2 = items.some((i: any) => i.text === 'Collab 2 Item');

      expect(hasItem1).toBe(true);
      expect(hasItem2).toBe(true);
    });
  });

  describe('Access Revocation', () => {
    it('should prevent access after collaborator is removed', async () => {
      // Add collaborator
      await request(app)
        .post(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email });

      // Upgrade to edit
      await request(app)
        .put(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email, permission: 'edit' });

      // Collaborator can access
      const accessRes = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'Before Removal' });

      expect(accessRes.statusCode).toBe(201);

      // Remove collaborator
      await request(app)
        .delete(`/api/lists/${testListId}/collaborators`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: collaboratorUser.email });

      // Collaborator can no longer access
      const noAccessRes = await request(app)
        .post(`/api/lists/${testListId}/items`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ text: 'After Removal' });

      expect(noAccessRes.statusCode).toBe(403);
    });
  });
});

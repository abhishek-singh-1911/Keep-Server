import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const user1 = {
  name: 'Owner User',
  email: 'owner@example.com',
  password: 'password123',
};
const user2 = {
  name: 'Collaborator User',
  email: 'collab@example.com',
  password: 'password456',
};
const user3 = {
  name: 'Random User',
  email: 'random@example.com',
  password: 'password789',
};

let user1Token: string;
let user2Token: string;
let user3Token: string;
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

  // Register and Login User 3
  const regRes3 = await request(app).post('/api/auth/register').send(user3);
  expect(regRes3.statusCode).toBe(201);
  user3Token = regRes3.body.token;
  expect(user3Token).toBeDefined();
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Step 4: List CRUD & Collaboration', () => {

  // 1. Create a List (Prerequisite)
  it('should create a list for user1', async () => {
    const res = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'My Test List' });

    expect(res.statusCode).toBe(201);
    listId = res.body.listId;
  });

  // 2. Update List (PUT)
  it('should allow owner to update list name', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Updated List Name' });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated List Name');
  });

  it('should NOT allow non-owner to update list name', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'Hacked List Name' });

    expect(res.statusCode).toBe(403);
  });

  // 3. Add Collaborator (POST)
  it('should allow owner to add a collaborator', async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/collaborators`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ email: user2.email });

    expect(res.statusCode).toBe(200);
    expect(res.body.collaborators).toHaveLength(1);
  });

  it('should NOT allow non-owner to add a collaborator', async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/collaborators`)
      .set('Authorization', `Bearer ${user2Token}`) // user2 is now a collaborator but not owner
      .send({ email: user3.email });

    expect(res.statusCode).toBe(403);
  });

  it('should fail to add non-existent user as collaborator', async () => {
    const res = await request(app)
      .post(`/api/lists/${listId}/collaborators`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ email: 'nonexistent@example.com' });

    expect(res.statusCode).toBe(404);
  });

  // 4. Remove Collaborator (DELETE)
  it('should allow owner to remove a collaborator', async () => {
    const res = await request(app)
      .delete(`/api/lists/${listId}/collaborators`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ email: user2.email });

    expect(res.statusCode).toBe(200);
    expect(res.body.collaborators).toHaveLength(0);
  });

  // 5. Delete List (DELETE)
  it('should NOT allow non-owner to delete list', async () => {
    const res = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send();

    expect(res.statusCode).toBe(403);
  });

  it('should allow owner to delete list', async () => {
    const res = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('List removed');
  });

  it('should return 404 for deleted list', async () => {
    const res = await request(app)
      .get(`/api/lists/${listId}`);

    expect(res.statusCode).toBe(404);
  });
});

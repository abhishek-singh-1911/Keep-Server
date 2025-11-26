import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const owner = {
  name: 'List Owner',
  email: 'owner-reorder@example.com',
  password: 'password123',
};

let ownerToken: string;
let listId: string;
let item1Id: string;
let item2Id: string;
let item3Id: string;

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

  // Register and get token
  const ownerRes = await request(app).post('/api/auth/register').send(owner);
  ownerToken = ownerRes.body.token;

  // Create a list
  const listRes = await request(app)
    .post('/api/lists')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Reorder Test List' });
  listId = listRes.body.listId;

  // Add 3 items
  const item1Res = await request(app)
    .post(`/api/lists/${listId}/items`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ text: 'Item 1' });
  item1Id = item1Res.body.items[0].itemId;

  const item2Res = await request(app)
    .post(`/api/lists/${listId}/items`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ text: 'Item 2' });
  item2Id = item2Res.body.items[1].itemId;

  const item3Res = await request(app)
    .post(`/api/lists/${listId}/items`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ text: 'Item 3' });
  item3Id = item3Res.body.items[2].itemId;
});

afterAll(async () => {
  await User.deleteMany({});
  await List.deleteMany({});
  await mongoose.connection.close();
});

describe('Item Reordering', () => {

  it('should have items with order field set correctly on creation', async () => {
    const res = await request(app)
      .get(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0].order).toBe(0);
    expect(res.body.items[1].order).toBe(1);
    expect(res.body.items[2].order).toBe(2);
  });

  it('should reorder items successfully', async () => {
    // Reverse the order: item3, item2, item1
    const res = await request(app)
      .put(`/api/lists/${listId}/items/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemIds: [item3Id, item2Id, item1Id] });

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(3);

    // Check new order
    expect(res.body.items[0].itemId).toBe(item3Id);
    expect(res.body.items[0].order).toBe(0);

    expect(res.body.items[1].itemId).toBe(item2Id);
    expect(res.body.items[1].order).toBe(1);

    expect(res.body.items[2].itemId).toBe(item1Id);
    expect(res.body.items[2].order).toBe(2);
  });

  it('should persist reordered items', async () => {
    // Fetch the list again to verify persistence
    const res = await request(app)
      .get(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].itemId).toBe(item3Id);
    expect(res.body.items[1].itemId).toBe(item2Id);
    expect(res.body.items[2].itemId).toBe(item1Id);
  });

  it('should fail to reorder with invalid itemIds', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}/items/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemIds: ['invalid-id', item1Id, item2Id] });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid itemIds provided');
  });

  it('should fail to reorder without itemIds array', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}/items/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemIds: 'not-an-array' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('itemIds must be an array');
  });

  it('should fail to reorder without authentication', async () => {
    const res = await request(app)
      .put(`/api/lists/${listId}/items/reorder`)
      .send({ itemIds: [item1Id, item2Id, item3Id] });

    expect(res.statusCode).toBe(401);
  });

  it('should allow partial reordering (only some items)', async () => {
    // Only reorder item1 and item2, leave item3 in place
    const res = await request(app)
      .put(`/api/lists/${listId}/items/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ itemIds: [item1Id, item2Id, item3Id] });

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].itemId).toBe(item1Id);
    expect(res.body.items[1].itemId).toBe(item2Id);
    expect(res.body.items[2].itemId).toBe(item3Id);
  });
});

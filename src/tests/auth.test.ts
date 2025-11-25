import request from 'supertest';
import mongoose from 'mongoose';
// Note: We don't import http/socket.io here, as they are managed inside server.ts's export.
import app from '../server';
import User from '../models/user';
import List from '../models/list';

// --- Setup Test Variables ---
const user1 = {
    name: 'Test User 1',
    email: 'test1@example.com',
    password: 'password123',
};
const user2 = {
    name: 'Test User 2',
    email: 'test2@example.com',
    password: 'password456',
};

let user1Token: string;
let user1Id: mongoose.Types.ObjectId;
let testListId: string;

// --- Helper function to ensure Mongoose is connected ---
const connectToTestDB = async () => {
    // Check connection state: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (mongoose.connection.readyState === 0) {
        // MONGODB_URI is loaded by 'dotenv/config' in jest.config.js
        await mongoose.connect(process.env.MONGODB_URI!);
    }
};

// --- Test Suite Setup and Teardown ---
beforeAll(async () => {
    // Connect to the DB and clean up before running tests
    await connectToTestDB();
    await User.deleteMany({});
    await List.deleteMany({});
});

afterAll(async () => {
    // Clean up the database after all tests are done
    await User.deleteMany({});
    await List.deleteMany({});

    // Close the connection
    await mongoose.connection.close();
});

// ----------------------------------------------------
// STEP 2 TESTS: Authentication (Register & Login)
// ----------------------------------------------------
describe('STEP 2: /api/auth Endpoints', () => {

    it('should register a new user (user1)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(user1);

        expect(res.statusCode).toBe(201);
        expect(res.body.token).toBeDefined();
        expect(res.body.email).toBe(user1.email);

        user1Token = res.body.token;
        user1Id = new mongoose.Types.ObjectId(res.body._id); // Ensure we store ObjectId type
    });

    it('should fail to register a user with the same email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(user1);

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('User already exists.');
    });

    it('should log in the registered user (user1)', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: user1.email, password: user1.password });

        expect(res.statusCode).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    it('should fail login with incorrect password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: user1.email, password: 'wrongpassword' });

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Invalid email or password.');
    });

    // Register a second user for collaboration tests later
    it('should register a second user (user2)', async () => {
        await request(app).post('/api/auth/register').send(user2);
    });
});

// ----------------------------------------------------
// STEP 3 TESTS: Middleware & List Creation Protection
// ----------------------------------------------------
describe('STEP 3: /api/lists Endpoints (Protection)', () => {
    const listData = { name: 'Protected Shopping List' };

    it('should FAIL to create a list without a JWT token (401)', async () => {
        const res = await request(app)
            .post('/api/lists')
            .send(listData);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Not authorized/);
    });

    it('should SUCCESSFULLY create a list with a valid JWT token (201)', async () => {
        const res = await request(app)
            .post('/api/lists')
            .set('Authorization', `Bearer ${user1Token}`)
            .send(listData);

        expect(res.statusCode).toBe(201);
        expect(res.body.listId).toBeDefined();
        expect(res.body.name).toBe(listData.name);

        testListId = res.body.listId; // Save ID for later tests

        // Verify the list was saved with the correct owner in the database
        const dbList = await List.findOne({ listId: testListId });
        expect(dbList).not.toBeNull();
        expect(dbList?.owner.toString()).toBe(user1Id.toString());
    });

    it('should SUCCESSFULLY fetch the created list (unprotected GET)', async () => {
        const res = await request(app)
            .get(`/api/lists/${testListId}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.listId).toBe(testListId);
        expect(res.body.name).toBe(listData.name);
        expect(res.body.owner).toBeDefined();
    });
});
# Keep Server - Setup Guide

> Quick start guide to get the Keep server running locally

---

## Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

---

## Quick Start

### 1. Install Dependencies

```bash
cd keep/server
npm install
```

### 2. Configure Environment

Create a `.env` file in the server root:

```env
PORT=5002
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/?appName=KeepCluster"
JWT_SECRET="your-secret-key-here"
NODE_ENV="development"
```

**Get MongoDB URI**:
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string
4. Replace `<username>` and `<password>`

### 3. Run Development Server

```bash
npm run dev
```

Server will start at `http://localhost:5002`

### 4. Run Tests

```bash
# Run all tests sequentially (recommended)
npm test -- --runInBand

# Run specific test file
npm test -- src/tests/auth.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run production server |
| `npm run dev` | Run development server with auto-reload |
| `npm test` | Run all tests |
| `npm test -- --runInBand` | Run tests sequentially |
| `npm test -- --coverage` | Run tests with coverage report |

---

## Project Structure

```
keep/server/
├── src/
│   ├── middleware/
│   │   └── authMiddleware.ts       # JWT auth & access control
│   ├── models/
│   │   ├── user.ts                 # User schema
│   │   └── list.ts                 # List schema
│   ├── routes/
│   │   ├── authRoutes.ts           # Auth endpoints
│   │   └── listRoutes.ts           # List endpoints
│   ├── tests/
│   │   ├── auth.test.ts            # Auth tests
│   │   ├── collaboration.test.ts   # Collaboration tests
│   │   └── list_items.test.ts      # Item CRUD tests
│   ├── utils/
│   │   └── idGenerator.ts          # ID generation
│   └── server.ts                   # Main server file
├── .env                            # Environment variables (gitignored)
├── .env.example                    # Environment template
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── jest.config.js                  # Jest config
```

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT + bcryptjs
- **Real-time**: Socket.IO
- **Testing**: Jest + Supertest

---

## API Endpoints

### Base URL
```
http://localhost:5002/api
```

### Quick Test

```bash
# Health check
curl http://localhost:5002

# Register user
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Troubleshooting

### MongoDB Connection Issues

1. **Check connection string** - Verify username/password
2. **Whitelist IP** - Add your IP in MongoDB Atlas Network Access
3. **Check network** - Ensure you're not behind a firewall

```bash
# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected!')).catch(e => console.error(e))"
```

### Port Already in Use

```bash
# Kill process using port 5002
lsof -ti:5002 | xargs kill -9

# Or change port in .env
PORT=5003
```

### Tests Failing

```bash
# Clear Jest cache
npm test -- --clearCache

# Run tests one at a time
npm test -- --runInBand

# Check MongoDB connection in tests
# Ensure MONGODB_URI is set in .env
```

---

## Next Steps

- Read the [Developer Documentation](./DEVELOPER_DOCS.md) for detailed API reference
- Explore the test files in `src/tests/` for examples
- Set up the client application to connect to this server

---

**Need Help?** Check the Developer Documentation or MongoDB Atlas documentation.

# Keep Server - Quick Start Guide

> Get up and running with the Keep server in 5 minutes

---

## ⚡ Quick Setup

### 1. Prerequisites Check

```bash
# Check Node.js version (need v16+)
node --version

# Check npm version
npm --version
```

### 2. Install Dependencies

```bash
cd keep/server
npm install
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# Required: MONGODB_URI and JWT_SECRET
```

**Your `.env` should look like:**
```env
PORT=5002
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/?appName=KeepCluster"
JWT_SECRET="your-super-secret-key-here"
```

### 4. Start Development Server

```bash
npm run dev
```

✅ Server running at `http://localhost:5002`

### 5. Verify Installation

```bash
# In a new terminal, test the health endpoint
curl http://localhost:5002

# Should return: "Keep Server is running!"
```

---

## 🧪 Run Tests

```bash
# Run all tests
npm test -- --runInBand

# Expected output: 34 tests passing ✅
```

---

## 📝 First API Call

### Register a User

```bash
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "_id": "...",
  "name": "Test User",
  "email": "test@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Create a List

```bash
# Replace TOKEN with the token from registration
curl -X POST http://localhost:5002/api/lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "My First List"}'
```

**Response:**
```json
{
  "listId": "gftr-1234",
  "name": "My First List"
}
```

### Add an Item

```bash
# Replace TOKEN and LIST_ID
curl -X POST http://localhost:5002/api/lists/LIST_ID/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"text": "My first item"}'
```

---

## 📚 Next Steps

1. **Read the Documentation**
   - `README.md` - Complete developer guide
   - `API_REFERENCE.md` - All endpoints with examples
   - `ARCHITECTURE.md` - Technical architecture

2. **Explore the Code**
   - Start with `/src/server.ts` - Main entry point
   - Check `/src/routes/` - API endpoints
   - Review `/src/tests/` - Test examples

3. **Try the API**
   - Use Postman or Thunder Client
   - Import the API endpoints
   - Test all features

4. **Build the Frontend**
   - Backend is ready for integration
   - All endpoints are tested and working
   - See API_REFERENCE.md for details

---

## 🐛 Troubleshooting

### Server won't start

**Error:** `MONGODB_URI is not defined`
- **Fix:** Check your `.env` file exists and has `MONGODB_URI`

**Error:** `Port 5002 already in use`
- **Fix:** Change `PORT` in `.env` or kill the process using port 5002

### Tests failing

**Error:** `Connection refused`
- **Fix:** Check MongoDB Atlas connection string
- **Fix:** Ensure IP address is whitelisted in MongoDB Atlas

**Error:** `EADDRINUSE`
- **Fix:** Run tests with `--runInBand` flag

### Authentication issues

**Error:** `Not authorized, no token`
- **Fix:** Include `Authorization: Bearer <token>` header

**Error:** `Not authorized, token failed`
- **Fix:** Token may be expired or invalid, login again

---

## 📞 Getting Help

1. Check the documentation files
2. Review test files for usage examples
3. Check MongoDB Atlas connection
4. Verify environment variables

---

## 🎯 Common Tasks

### Reset Database
```bash
# Connect to MongoDB and drop collections
# Or delete all documents via MongoDB Atlas UI
```

### View Logs
```bash
# Server logs appear in terminal
# Look for console.log and console.error outputs
```

### Add New Endpoint
1. Add route in `/src/routes/`
2. Add middleware if needed
3. Write tests in `/src/tests/`
4. Update API documentation

---

**Ready to code!** 🚀

For detailed information, see:
- `README.md` - Full documentation
- `API_REFERENCE.md` - API details
- `ARCHITECTURE.md` - Technical design

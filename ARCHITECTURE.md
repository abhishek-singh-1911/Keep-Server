# Keep Server - Technical Architecture

> Detailed technical architecture and design decisions for the Keep collaborative list application backend

---

## 📐 System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
│  (React/Vue/Angular - Future Frontend Implementation)       │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/HTTPS + JWT
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Express.js Server                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Routes Layer                                          │ │
│  │  • /api/auth (Authentication)                          │ │
│  │  • /api/lists (Lists & Items)                          │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Middleware Layer                                      │ │
│  │  • protect (JWT Authentication)                        │ │
│  │  • protectListAccess (Authorization)                   │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Business Logic Layer                                  │ │
│  │  • User management                                     │ │
│  │  • List CRUD operations                                │ │
│  │  • Item CRUD operations                                │ │
│  │  • Collaboration management                            │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Data Access Layer (Mongoose ODM)                      │ │
│  │  • User Model                                          │ │
│  │  • List Model                                          │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    MongoDB Atlas                            │
│  • Users Collection                                         │
│  • Lists Collection                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂 Data Model Design

### Entity Relationship Diagram

```
┌─────────────────────┐
│       User          │
│─────────────────────│
│ _id: ObjectId (PK)  │
│ name: String        │
│ email: String (UK)  │
│ password: String    │
│ createdAt: Date     │
│ updatedAt: Date     │
└──────────┬──────────┘
           │
           │ 1:N (owner)
           │
           ▼
┌─────────────────────────────────┐
│            List                 │
│─────────────────────────────────│
│ _id: ObjectId (PK)              │
│ listId: String (UK)             │
│ name: String                    │
│ owner: ObjectId (FK → User)     │◄─── One owner
│ collaborators: [ObjectId]       │◄─── Many collaborators
│ items: [Item]                   │◄─── Embedded items
│ createdAt: Date                 │
│ updatedAt: Date                 │
└─────────────────────────────────┘
           │
           │ 1:N (embedded)
           │
           ▼
┌─────────────────────┐
│       Item          │
│─────────────────────│
│ itemId: String      │
│ text: String        │
│ completed: Boolean  │
└─────────────────────┘
```

### Design Decisions

#### 1. **Embedded Items vs. Separate Collection**

**Decision:** Items are embedded in the List document

**Rationale:**
- Items are always accessed in the context of a list
- No need to query items independently
- Reduces database queries (no JOINs needed)
- Atomic updates (update list and items in one operation)
- Simpler data model

**Trade-offs:**
- Document size limit (16MB in MongoDB - sufficient for lists)
- Cannot query items across all lists efficiently
- For this use case, benefits outweigh drawbacks

#### 2. **List ID Generation**

**Decision:** Use short, readable IDs (e.g., "gftr-1234") instead of MongoDB ObjectIds

**Rationale:**
- User-friendly URLs: `/lists/gftr-1234` vs `/lists/507f1f77bcf86cd799439011`
- Easy to share and remember
- Still unique and indexed
- Separate from internal `_id` for flexibility

#### 3. **Collaborators as Array of ObjectIds**

**Decision:** Store collaborators as array of User references

**Rationale:**
- Simple to add/remove collaborators
- Easy to check if user is collaborator
- Can populate with user details when needed
- No separate join table required

---

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────┐                                    ┌─────────┐
│  Client  │                                    │ Server  │
└─────┬────┘                                    └───┬─────┘
      │                                             │
      │  1. POST /api/auth/login                    │
      │     { email, password }                     │
      ├────────────────────────────────────────────►│
      │                                             │
      │  2. Validate credentials                    │
      │                                             │
      │  3. Generate JWT token                      │
      │                                             │
      │  4. Return token                            │
      │◄────────────────────────────────────────────┤
      │     { token, user }                         │
      │                                             │
      │  5. Store token (localStorage/cookie)       │
      │                                             │
      │  6. Subsequent requests                     │
      │     Authorization: Bearer <token>           │
      ├────────────────────────────────────────────►│
      │                                             │
      │  7. Verify token                            │
      │                                             │
      │  8. Attach user to request                  │
      │                                             │
      │  9. Return protected data                   │
      │◄────────────────────────────────────────────┤
      │                                             │
```

### Authorization Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    Authorization Matrix                     │
├──────────────────────┬──────────┬──────────┬────────────────┤
│ Action               │ Public   │ Owner    │ Collaborator   │
├──────────────────────┼──────────┼──────────┼────────────────┤
│ View List            │    ✅    │    ✅    │      ✅        │
│ Create List          │    ❌    │    ✅    │      ❌        │
│ Update List Name     │    ❌    │    ✅    │      ❌        │
│ Delete List          │    ❌    │    ✅    │      ❌        │
│ Add Collaborator     │    ❌    │    ✅    │      ❌        │
│ Remove Collaborator  │    ❌    │    ✅    │      ❌        │
│ Add Item             │    ❌    │    ✅    │      ✅        │
│ Update Item          │    ❌    │    ✅    │      ✅        │
│ Delete Item          │    ❌    │    ✅    │      ✅        │
└──────────────────────┴──────────┴──────────┴────────────────┘
```

### Password Security

1. **Hashing:** bcrypt with salt rounds (10)
2. **Storage:** Only hashed passwords stored in database
3. **Comparison:** Using bcrypt's constant-time comparison
4. **Never exposed:** Password field excluded from API responses

### JWT Security

1. **Secret:** Stored in environment variable
2. **Expiration:** 30 days
3. **Payload:** Only user ID (minimal data)
4. **Verification:** On every protected route
5. **No refresh tokens:** (Can be added in future)

---

## 🔄 Request/Response Flow

### Example: Adding an Item to a List

```
1. Client Request
   ┌────────────────────────────────────────────┐
   │ POST /api/lists/gftr-1234/items            │
   │ Authorization: Bearer eyJhbGc...           │
   │ Content-Type: application/json             │
   │                                            │
   │ { "text": "Buy milk" }                     │
   └────────────────────────────────────────────┘
                    ▼
2. Express Routing
   ┌────────────────────────────────────────────┐
   │ router.post('/:listId/items', ...)         │
   └────────────────────────────────────────────┘
                    ▼
3. Middleware Chain
   ┌────────────────────────────────────────────┐
   │ protect → Verify JWT                       │
   │         → Attach user to req.user          │
   └────────────────────────────────────────────┘
                    ▼
   ┌────────────────────────────────────────────┐
   │ protectListAccess → Find list              │
   │                   → Check owner/collab     │
   └────────────────────────────────────────────┘
                    ▼
4. Route Handler
   ┌────────────────────────────────────────────┐
   │ • Generate itemId                          │
   │ • Create item object                       │
   │ • Push to list.items array                 │
   │ • Save list to database                    │
   └────────────────────────────────────────────┘
                    ▼
5. Database Operation
   ┌────────────────────────────────────────────┐
   │ MongoDB: Update list document              │
   │ • Atomic operation                         │
   │ • Update timestamp                         │
   └────────────────────────────────────────────┘
                    ▼
6. Response
   ┌────────────────────────────────────────────┐
   │ 201 Created                                │
   │ Content-Type: application/json             │
   │                                            │
   │ { listId, name, items: [...], ... }        │
   └────────────────────────────────────────────┘
```

---

## 🧩 Component Breakdown

### 1. Server Entry Point (`server.ts`)

**Responsibilities:**
- Initialize Express app
- Configure middleware (JSON parsing)
- Set up routes
- Connect to MongoDB
- Start HTTP server
- Export app for testing

**Key Features:**
- Environment-based configuration
- Conditional server start (not in test mode)
- Socket.IO initialization (ready for Step 6)

### 2. Models

#### User Model (`models/user.ts`)
- Schema definition with validation
- Password hashing pre-save hook
- Password comparison method
- Timestamps enabled

#### List Model (`models/list.ts`)
- Schema with owner and collaborators
- Embedded items subdocument
- Virtual fields support
- Timestamps enabled

### 3. Routes

#### Auth Routes (`routes/authRoutes.ts`)
- User registration with validation
- User login with credential verification
- JWT token generation
- Error handling

#### List Routes (`routes/listRoutes.ts`)
- List CRUD operations
- Collaborator management
- Item CRUD operations
- Authorization checks
- Comprehensive error handling

### 4. Middleware

#### `protect`
- JWT token extraction
- Token verification
- User lookup
- Request augmentation

#### `protectListAccess`
- List existence check
- Owner/collaborator verification
- Access control enforcement

### 5. Utilities

#### ID Generator (`utils/idGenerator.ts`)
- `generateListId()`: Short, readable list IDs
- `generateItemId()`: Timestamp-based item IDs

---

## 📊 Performance Considerations

### Database Indexing

```javascript
// User Model
email: { type: String, unique: true, required: true }
// Creates index on email for fast lookups

// List Model
listId: { type: String, unique: true, required: true }
// Creates index on listId for fast retrieval
```

### Query Optimization

1. **Selective Field Retrieval**
   ```javascript
   User.findById(id).select('-password')
   // Excludes password from results
   ```

2. **Embedded Documents**
   - Items are embedded, no additional queries needed
   - Single database round-trip for list + items

3. **Lean Queries** (Future optimization)
   ```javascript
   List.findOne({ listId }).lean()
   // Returns plain JavaScript object (faster)
   ```

### Scalability Considerations

**Current Architecture:**
- Suitable for 1,000s of users
- Handles 100s of concurrent requests
- MongoDB Atlas auto-scaling

**Future Optimizations:**
- Add Redis for session caching
- Implement database connection pooling
- Add CDN for static assets
- Horizontal scaling with load balancer

---

## 🧪 Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │   E2E Tests │  (Future)
        │   (Planned) │
        └─────────────┘
       ┌───────────────┐
       │ Integration   │
       │ Tests (34)    │  ← Current Focus
       └───────────────┘
      ┌─────────────────┐
      │  Unit Tests     │
      │  (Implicit in   │
      │   Integration)  │
      └─────────────────┘
```

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| Authentication | 5 | Registration, login, validation |
| List CRUD | 3 | Create, update, delete |
| Collaboration | 7 | Add/remove collaborators, access control |
| Item CRUD | 16 | Add, update, delete items |
| Authorization | 3 | Token validation, access checks |
| **Total** | **34** | **Complete API coverage** |

### Testing Approach

1. **Integration Tests:** Test full request/response cycle
2. **Database Cleanup:** Before/after each test suite
3. **Sequential Execution:** Avoid race conditions
4. **Real Database:** Use actual MongoDB (not mocks)
5. **Comprehensive Scenarios:** Happy paths + error cases

---

## 🔮 Future Enhancements

### Step 6: Real-Time Sync (Socket.IO)

```javascript
// Planned architecture
io.on('connection', (socket) => {
  // Authenticate socket
  // Join list rooms
  // Emit real-time events
});

// Events to implement:
// - list:updated
// - item:added
// - item:updated
// - item:deleted
// - collaborator:added
// - collaborator:removed
```

### Step 7: Additional Features

- User profile management
- List search and filtering
- Activity logs
- Email notifications
- Rate limiting
- Input validation (express-validator)

### Step 9: Production Readiness

- Docker containerization
- CI/CD pipeline (GitHub Actions)
- Logging (Winston/Pino)
- Monitoring (Sentry)
- API documentation (Swagger)
- Health check endpoints

---

## 🎯 Design Principles

### 1. **Separation of Concerns**
- Routes handle HTTP
- Middleware handles cross-cutting concerns
- Models handle data logic
- Clear boundaries between layers

### 2. **DRY (Don't Repeat Yourself)**
- Reusable middleware
- Shared utilities
- Consistent error handling

### 3. **Security First**
- Authentication on all protected routes
- Authorization checks before operations
- Input validation
- Secure password handling

### 4. **Testability**
- Modular code
- Dependency injection (via imports)
- Comprehensive test coverage
- Test-friendly configuration

### 5. **Scalability**
- Stateless server (JWT tokens)
- Database indexing
- Efficient queries
- Ready for horizontal scaling

---

## 📚 Technology Choices

### Why TypeScript?
- Type safety reduces bugs
- Better IDE support
- Self-documenting code
- Easier refactoring

### Why Express?
- Minimal and flexible
- Large ecosystem
- Well-documented
- Industry standard

### Why MongoDB?
- Flexible schema (good for evolving requirements)
- JSON-like documents (matches JavaScript objects)
- Excellent scaling options
- MongoDB Atlas (managed service)

### Why JWT?
- Stateless authentication
- No server-side session storage
- Easy to scale horizontally
- Industry standard

### Why Jest + Supertest?
- Comprehensive testing framework
- Easy HTTP testing
- Good TypeScript support
- Fast and reliable

---

## 🔍 Code Quality

### Linting & Formatting (Future)
```json
{
  "eslint": "Code quality rules",
  "prettier": "Code formatting",
  "husky": "Pre-commit hooks"
}
```

### Code Review Checklist
- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Security considerations addressed
- [ ] Performance implications considered

---

**Last Updated:** 2025-11-25  
**Architecture Version:** 1.0.0  
**Status:** Production-ready core functionality ✅

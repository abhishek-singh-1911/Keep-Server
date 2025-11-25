# Keep API Reference - Quick Guide

> Quick reference for all API endpoints with request/response examples

---

## 🔗 Base URL

```
http://localhost:5002/api
```

---

## 📋 Endpoint Summary

| Method | Endpoint | Auth | Access | Description |
|--------|----------|------|--------|-------------|
| POST | `/auth/register` | ❌ | Public | Register new user |
| POST | `/auth/login` | ❌ | Public | Login user |
| POST | `/lists` | ✅ | Authenticated | Create list |
| GET | `/lists/:listId` | ❌ | Public | Get list details |
| PUT | `/lists/:listId` | ✅ | Owner | Update list name |
| DELETE | `/lists/:listId` | ✅ | Owner | Delete list |
| POST | `/lists/:listId/collaborators` | ✅ | Owner | Add collaborator |
| DELETE | `/lists/:listId/collaborators` | ✅ | Owner | Remove collaborator |
| POST | `/lists/:listId/items` | ✅ | Owner + Collab | Add item |
| PUT | `/lists/:listId/items/:itemId` | ✅ | Owner + Collab | Update item |
| DELETE | `/lists/:listId/items/:itemId` | ✅ | Owner + Collab | Delete item |

---

## 🔐 Authentication

### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (201):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (400):**
```json
{
  "message": "User already exists."
}
```

---

### Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (401):**
```json
{
  "message": "Invalid email or password."
}
```

---

## 📝 Lists

### Create List

```http
POST /api/lists
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Shopping List"
}
```

**Success Response (201):**
```json
{
  "listId": "gftr-1234",
  "name": "Shopping List"
}
```

---

### Get List

```http
GET /api/lists/gftr-1234
```

**Success Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "listId": "gftr-1234",
  "name": "Shopping List",
  "owner": "507f1f77bcf86cd799439012",
  "collaborators": ["507f1f77bcf86cd799439013"],
  "items": [
    {
      "itemId": "item-1234567890-xyz",
      "text": "Buy milk",
      "completed": false
    }
  ],
  "createdAt": "2025-11-25T12:00:00.000Z",
  "updatedAt": "2025-11-25T12:30:00.000Z"
}
```

**Error Response (404):**
```json
{
  "message": "List not found."
}
```

---

### Update List Name

```http
PUT /api/lists/gftr-1234
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Shopping List"
}
```

**Success Response (200):** Full list object

**Error Responses:**
- `401` - Not authenticated
- `403` - Not the owner
- `404` - List not found

---

### Delete List

```http
DELETE /api/lists/gftr-1234
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "message": "List removed"
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Not the owner
- `404` - List not found

---

## 👥 Collaborators

### Add Collaborator

```http
POST /api/lists/gftr-1234/collaborators
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "collaborator@example.com"
}
```

**Success Response (200):** Full list object with updated collaborators

**Error Responses:**
- `400` - User already a collaborator / Owner cannot be collaborator
- `401` - Not authenticated
- `403` - Not the owner
- `404` - List not found / User not found

---

### Remove Collaborator

```http
DELETE /api/lists/gftr-1234/collaborators
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "collaborator@example.com"
}
```

**Success Response (200):** Full list object with updated collaborators

**Error Responses:**
- `401` - Not authenticated
- `403` - Not the owner
- `404` - List not found / User not found

---

## ✅ Items

### Add Item

```http
POST /api/lists/gftr-1234/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Buy groceries"
}
```

**Success Response (201):** Full list object with new item

**Error Responses:**
- `401` - Not authenticated
- `403` - Not owner or collaborator
- `404` - List not found

---

### Update Item

```http
PUT /api/lists/gftr-1234/items/item-1234567890-xyz
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Buy organic groceries",
  "completed": true
}
```

**Notes:**
- Both `text` and `completed` are optional
- Can update one or both fields

**Success Response (200):** Full list object with updated item

**Error Responses:**
- `401` - Not authenticated
- `403` - Not owner or collaborator
- `404` - List not found / Item not found

---

### Delete Item

```http
DELETE /api/lists/gftr-1234/items/item-1234567890-xyz
Authorization: Bearer <token>
```

**Success Response (200):** Full list object without deleted item

**Error Responses:**
- `401` - Not authenticated
- `403` - Not owner or collaborator
- `404` - List not found / Item not found

---

## 🔑 Authentication Header Format

All protected endpoints require the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ❌ Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid input, duplicate email, validation error |
| 401 | Unauthorized | Missing token, invalid token, expired token |
| 403 | Forbidden | Not owner, not collaborator, insufficient permissions |
| 404 | Not Found | List not found, item not found, user not found |
| 500 | Server Error | Database error, unexpected server issue |

---

## 📊 Data Models

### User Object
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2025-11-25T12:00:00.000Z",
  "updatedAt": "2025-11-25T12:00:00.000Z"
}
```

### List Object
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "listId": "gftr-1234",
  "name": "Shopping List",
  "owner": "507f1f77bcf86cd799439012",
  "collaborators": ["507f1f77bcf86cd799439013"],
  "items": [
    {
      "itemId": "item-1234567890-xyz",
      "text": "Buy milk",
      "completed": false
    }
  ],
  "createdAt": "2025-11-25T12:00:00.000Z",
  "updatedAt": "2025-11-25T12:30:00.000Z"
}
```

### Item Object (embedded in List)
```json
{
  "itemId": "item-1234567890-xyz",
  "text": "Buy milk",
  "completed": false
}
```

---

## 🧪 Testing with cURL

### Register and Login
```bash
# Register
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

### Create List and Add Items
```bash
# Create list (replace TOKEN with actual token)
curl -X POST http://localhost:5002/api/lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Shopping List"}'

# Add item (replace LIST_ID)
curl -X POST http://localhost:5002/api/lists/LIST_ID/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"text":"Buy milk"}'

# Update item (replace LIST_ID and ITEM_ID)
curl -X PUT http://localhost:5002/api/lists/LIST_ID/items/ITEM_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"completed":true}'
```

---

## 🔄 Typical Workflow

1. **Register/Login** → Get JWT token
2. **Create List** → Get `listId`
3. **Add Items** → Build your list
4. **Add Collaborators** → Share with team
5. **Collaborators can:**
   - View the list
   - Add/update/delete items
   - Cannot modify list metadata or collaborators

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- JWT tokens expire after 30 days
- List IDs are short, readable (e.g., "gftr-1234")
- Item IDs are timestamp-based (e.g., "item-1234567890-xyz")
- Passwords are hashed with bcrypt (never stored in plain text)

---

**Last Updated:** 2025-11-25  
**API Version:** 1.0.0

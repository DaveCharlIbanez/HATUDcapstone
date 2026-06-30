# Flask API Implementation Plan

## Overview

Flask API added alongside Next.js/Convex backend, running on port 5000.

## Project Structure

```
flask_api/
├── app.py              # Main Flask application
├── config.py          # Configuration (SECRET_KEY, JWT settings)
├── models.py           # In-memory data stores and type definitions
├── requirements.txt    # Dependencies
├── routes/
│   ├── __init__.py
│   ├── auth.py         # Authentication endpoints
│   ├── data.py         # Data endpoints
│   └── aggregation.py  # Aggregation endpoint
└── services/
    ├── __init__.py
    └── aggregator.py   # Data aggregation logic
```

## Endpoints

| # | Route | Method | Auth | Description | Status Code |
|---|-------|--------|------|-------------|-------------|
| 1 | `/api/auth/register` | POST | None | Register new user | 201 |
| 2 | `/api/auth/login` | POST | None | Login, returns JWT | 200 |
| 3 | `/api/auth/profile` | GET | JWT Required | Get current user profile | 200 |
| 4 | `/api/data/posts` | GET | None | Get all posts | 200 |
| 5 | `/api/data/comments` | GET | None | Get all comments | 200 |
| 6 | `/api/aggregate/dashboard` | GET | JWT Required | Aggregated data from posts + comments + user | 200 |

## Requirements Met

- **Five+ functional endpoints**: All 6 endpoints are functional
- **Aggregates data from multiple sources**: `/api/aggregate/dashboard` combines posts, comments, and user data
- **JWT authentication protects routes**: `/api/auth/profile` and `/api/aggregate/dashboard` require valid JWT

## Running the API

```bash
cd flask_api
pip3 install -r requirements.txt
python3 app.py
```

Server runs on `http://localhost:5000`.

## Testing

### 1. Start the Server

```bash
cd flask_api
pip3 install -r requirements.txt
python3 app.py
```

### 2. Test All Endpoints with curl

**Register a user:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "myuser", "email": "my@example.com", "password": "mypass123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "myuser", "password": "mypass123"}'
```
Copy the `access_token` from the response.

**Get posts (no auth required):**
```bash
curl http://localhost:5000/api/data/posts
```

**Get comments (no auth required):**
```bash
curl http://localhost:5000/api/data/comments
```

**Get profile (JWT required)** - replace `<TOKEN>` with your access token:
```bash
curl http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <TOKEN>"
```

**Get aggregated dashboard (JWT required)** - combine data from posts, comments, and user:
```bash
curl http://localhost:5000/api/aggregate/dashboard \
  -H "Authorization: Bearer <TOKEN>"
```

**Health check:**
```bash
curl http://localhost:5000/health
```

### 3. Verify JWT Protection (should fail without token)

```bash
curl http://localhost:5000/api/auth/profile
# Returns: {"msg":"Missing Authorization Header"}

curl http://localhost:5000/api/aggregate/dashboard
# Returns: {"msg":"Missing Authorization Header"}
```

### 4. Using Postman/Insomnia

Import as a collection:

| Method | URL | Auth | Body |
|--------|-----|------|------|
| POST | `http://localhost:5000/api/auth/register` | None | `{"username":"test","email":"t@t.com","password":"123"}` |
| POST | `http://localhost:5000/api/auth/login` | None | `{"username":"test","password":"123"}` |
| GET | `http://localhost:5000/api/data/posts` | None | - |
| GET | `http://localhost:5000/api/data/comments` | None | - |
| GET | `http://localhost:5000/api/data/comments?post_id=1` | None | - (filter by post) |
| GET | `http://localhost:5000/api/auth/profile` | Bearer token | - |
| GET | `http://localhost:5000/api/aggregate/dashboard` | Bearer token | - |
| GET | `http://localhost:5000/health` | None | - |
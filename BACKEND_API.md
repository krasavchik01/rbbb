# Backend API Reference

This document describes all available API endpoints in the SUITE-A backend.

## Authentication

All API requests should include user context headers:

```
x-user-id: {user_id}
x-user-name: {user_name}
x-user-role: {user_role}
```

**Note**: In production, these should be extracted from a JWT token instead.

## Health Check

### GET /api/health

Returns the health status of the server.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-18T10:30:00.000Z"
}
```

---

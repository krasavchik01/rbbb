# Backend API Reference

This document describes all available API endpoints in the RB Partners Suite backend.

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

## Service Memos API

Service memos follow a multi-stage approval workflow. Each memo passes through departments based on its category.

### GET /api/service-memos

List all service memos with optional filtering.

**Query Parameters:**
- `filter` (optional): `all`, `my`, `pending`, `in_progress`, `completed`, `rejected`
  - `all`: All memos visible to user
  - `my`: Memos created by current user
  - `pending`: Memos awaiting current user's approval
  - `in_progress`: Memos currently in approval process
  - `completed`: Finished memos
  - `rejected`: Rejected memos

**Response:**
```json
[
  {
    "id": "memo-1703084400000-abc123",
    "title": "Требуется ремонт ноутбука",
    "description": "Ноутбук не включается",
    "createdBy": "user-123",
    "createdByName": "Иван Петров",
    "priority": "high",
    "category": "it_support",
    "workflow": [
      {
        "stage": 0,
        "department": "initiator",
        "departmentLabel": "Инициатор",
        "status": "approved",
        "approver": "user-123",
        "approverName": "Иван Петров",
        "approvedAt": "2025-12-18T10:00:00.000Z",
        "comments": ""
      },
      {
        "stage": 1,
        "department": "it",
        "departmentLabel": "IT отдел",
        "status": "pending",
        "approverName": null
      }
    ],
    "currentStage": 1,
    "overallStatus": "in_progress",
    "attachments": [],
    "createdAt": "2025-12-18T10:00:00.000Z",
    "updatedAt": "2025-12-18T10:00:00.000Z"
  }
]
```

### GET /api/service-memos/:id

Get a specific service memo.

**Parameters:**
- `id`: Memo ID

**Response:** Single memo object (same format as list)

### POST /api/service-memos

Create a new service memo.

**Request Body:**
```json
{
  "title": "Требуется ремонт ноутбука",
  "description": "Ноутбук не включается, нужна диагностика",
  "priority": "high",
  "category": "it_support",
  "customWorkflow": [] // Optional: override default workflow route
}
```

**Priority Options:** `low`, `medium`, `high`, `urgent`

**Category Options:** `purchase`, `maintenance`, `request`, `complaint`, `it_support`, `other`

**Category Workflows:**
- `it_support`: Initiator → IT → Deputy Director → Director
- `purchase`: Initiator → Procurement → Deputy Director → Director → Accounting
- `maintenance`: Initiator → Admin → Deputy Director → Director
- `request`: Initiator → HR → Deputy Director → Director
- `complaint`: Initiator → HR → Deputy Director → Director
- `other`: Initiator → Admin → Director

**Response:** Created memo object with ID and all fields

### PUT /api/service-memos/:id/approve

Approve a memo at the current stage and advance to next stage.

**Parameters:**
- `id`: Memo ID

**Request Body:**
```json
{
  "comments": "Одобрено, всё необходимо" // Optional
}
```

**Responses:**

Success (200):
```json
{
  "id": "memo-...",
  "currentStage": 2,
  "overallStatus": "in_progress",
  // ... full updated memo
}
```

Errors:
- 404: Memo not found
- 400: Invalid memo state (already completed/rejected)
- 403: User doesn't have permission to approve

### PUT /api/service-memos/:id/reject

Reject a memo with a required reason.

**Parameters:**
- `id`: Memo ID

**Request Body:**
```json
{
  "comments": "Необходимо уточнить требования к ремонту" // Required
}
```

**Responses:**

Success (200): Updated memo with `overallStatus: "rejected"`

Errors:
- 400: Missing rejection reason
- 404: Memo not found
- 403: Permission denied

### DELETE /api/service-memos/:id

Delete a service memo.

**Parameters:**
- `id`: Memo ID

**Permissions:**
- Only memo creator or admin can delete

**Response:**
```json
{
  "success": true
}
```

---

## Team Evaluations API

Team evaluations allow rating colleagues after project completion.

### Evaluation Types

- **partner_by_manager**: Manager evaluates partner (project leader)
- **manager_by_team**: Team anonymously evaluates manager
- **team_by_manager**: Manager evaluates individual team members

### GET /api/project-evaluations/:projectId

List evaluations for a project.

**Parameters:**
- `projectId`: Project ID

**Visibility Rules:**
- Management (CEO, Admin, Deputy Director): See all evaluations
- Evaluators: See their own evaluations
- Team: Cannot see anonymous evaluations of others

**Response:**
```json
[
  {
    "id": "eval-1703084400000-abc123",
    "projectId": "proj-123",
    "evaluatedPersonId": "user-456",
    "evaluatorId": "user-123",
    "evaluatorName": "Мария Сидорова",
    "evaluatorRole": "manager_1",
    "type": "manager_by_team",
    "rating": 4,
    "comment": "Хорошая координация, чётко ставил задачи",
    "isAnonymous": true,
    "createdAt": "2025-12-18T10:00:00.000Z",
    "updatedAt": "2025-12-18T10:00:00.000Z"
  }
]
```

### GET /api/project-evaluations/:projectId/:evaluationId

Get a specific evaluation.

**Parameters:**
- `projectId`: Project ID
- `evaluationId`: Evaluation ID

**Response:** Single evaluation object

### POST /api/project-evaluations

Create a new evaluation.

**Request Body:**
```json
{
  "projectId": "proj-123",
  "evaluatedPersonId": "user-456",
  "type": "manager_by_team",
  "rating": 4,
  "comment": "Хорошая координация, чётко ставил задачи",
  "teamMembers": [] // For team_by_manager evaluations
}
```

**Rating:** Integer from 1 to 5
- 1: Неудовлетворительно (Unsatisfactory)
- 2: Плохо (Poor)
- 3: Удовлетворительно (Satisfactory)
- 4: Хорошо (Good)
- 5: Отлично (Excellent)

**Permissions:**
- `partner_by_manager`: Only manager_1 role
- `manager_by_team`: Any non-management role (team members)
- `team_by_manager`: Only manager_1, manager_2, manager_3 roles
- `admin` or `ceo`: Can evaluate anyone

**Response:** Created evaluation object with ID

### PUT /api/project-evaluations/:id

Update an existing evaluation.

**Parameters:**
- `id`: Evaluation ID

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Отличная работа, очень доволен результатом"
}
```

**Permissions:**
- Only the creator can update their own evaluation
- Admin can update any evaluation

**Response:** Updated evaluation object

### DELETE /api/project-evaluations/:id

Delete an evaluation.

**Parameters:**
- `id`: Evaluation ID

**Permissions:**
- Only the creator can delete their own evaluation
- Admin can delete any evaluation

**Response:**
```json
{
  "success": true
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Error Codes:**
- 400: Bad Request - Invalid parameters or missing required fields
- 403: Forbidden - User doesn't have permission for this action
- 404: Not Found - Resource doesn't exist
- 500: Internal Server Error - Server-side issue

---

## Rate Limiting

API requests are rate limited:
- **General**: 10 requests per second
- **API Endpoints**: 30 requests per second

Rate limit headers in response:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1703088600
```

---

## Examples

### Example 1: Create and Approve a Memo

```bash
# 1. Create a memo
curl -X POST http://localhost:3000/api/service-memos \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -H "x-user-name: Иван Петров" \
  -H "x-user-role: partner" \
  -d '{
    "title": "Требуется ремонт офиса",
    "description": "Потёкла крыша в офисе, нужна срочная помощь",
    "priority": "urgent",
    "category": "maintenance"
  }'

# 2. Get memos awaiting my approval
curl http://localhost:3000/api/service-memos?filter=pending \
  -H "x-user-id: user-456" \
  -H "x-user-name: Администратор" \
  -H "x-user-role: admin"

# 3. Approve the memo
curl -X PUT http://localhost:3000/api/service-memos/memo-1703084400000-abc123/approve \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-456" \
  -H "x-user-name: Администратор" \
  -H "x-user-role: admin" \
  -d '{
    "comments": "Одобрено администратором, направлено на согласование"
  }'
```

### Example 2: Create Team Evaluation

```bash
# Create anonymous evaluation from team member
curl -X POST http://localhost:3000/api/project-evaluations \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-789" \
  -H "x-user-name: Алексей Иванов" \
  -H "x-user-role: supervisor_1" \
  -d '{
    "projectId": "proj-123",
    "evaluatedPersonId": "user-456",
    "type": "manager_by_team",
    "rating": 4,
    "comment": "Хороший руководитель, чётко ставит задачи, доступен для вопросов"
  }'

# Get all evaluations (management only)
curl http://localhost:3000/api/project-evaluations/proj-123 \
  -H "x-user-id: user-admin" \
  -H "x-user-name: CEO" \
  -H "x-user-role: ceo"
```

---

## Frontend Integration

The frontend automatically includes user context when using the API client:

```typescript
import { apiPost, apiPut } from '@/lib/api';

// Create memo
const { data: newMemo, error } = await apiPost('/api/service-memos', {
  title: 'Test',
  description: 'Test memo',
  priority: 'medium',
  category: 'request',
});

// Approve memo
const { data: approved } = await apiPut(`/api/service-memos/${memoId}/approve`, {
  comments: 'Approved',
});
```

---

## Data Persistence

Currently uses in-memory storage with localStorage fallback. In production, integrate with Supabase:

```sql
-- Create service_memos table
CREATE TABLE service_memos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  workflow JSONB NOT NULL,
  current_stage INT NOT NULL,
  overall_status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create team_evaluations table
CREATE TABLE team_evaluations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  evaluated_person_id UUID NOT NULL,
  evaluator_id UUID NOT NULL,
  type TEXT NOT NULL,
  rating INT NOT NULL,
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

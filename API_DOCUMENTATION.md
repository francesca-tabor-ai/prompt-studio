# Prompt Library Platform - Comprehensive API Documentation

**Version:** 2.0.0
**Last Updated:** 2024-01-15
**Base URL:** `https://your-supabase-project.supabase.co`

## Overview

This document provides complete OpenAPI/Swagger specifications for all platform endpoints. The API follows RESTful principles and uses Supabase as the backend infrastructure.

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Core APIs](#core-apis)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Pagination & Filtering](#pagination--filtering)
7. [WebSocket Endpoints](#websocket-endpoints)
8. [File Operations](#file-operations)
9. [OpenAPI Specification](#openapi-specification)

---

## Base URL

All API calls are handled through the client-side service layer that communicates with Supabase:
- **REST API:** `https://your-project.supabase.co/rest/v1`
- **Auth API:** `https://your-project.supabase.co/auth/v1`
- **Storage API:** `https://your-project.supabase.co/storage/v1`
- **Realtime:** `wss://your-project.supabase.co/realtime/v1`

## Authentication

All endpoints require authentication via Supabase Auth. The authentication token is automatically included in requests.

## Authorization

Users can only access prompts based on:
- **Public prompts**: Available to all authenticated users
- **Private prompts**: Only accessible by the author
- **Team prompts**: Accessible to team members
- **Department prompts**: Accessible to department members
- **Role-based permissions**: Create, update, delete operations require appropriate permissions

## API Endpoints

### 1. Create Prompt

**Endpoint**: `POST /prompts`

**Description**: Creates a new prompt with metadata and initializes version history.

**Request Body**:
```typescript
{
  title: string;              // Required, 3-500 characters
  description?: string;        // Optional
  content: string;            // Required, min 10 characters
  role?: string;              // Optional
  department?: string;        // Optional
  workflow?: string;          // Optional
  prompt_type?: string;       // Optional: general, technical, creative, analytical, customer_service, other
  status?: string;            // Optional: draft, review, approved, rejected, published, archived
  visibility?: string;        // Optional: private, team, department, public
  department_id?: string;     // Optional UUID
  team_id?: string;           // Optional UUID
  is_template?: boolean;      // Optional, default: false
  tags?: string[];           // Optional array of strings (2-50 chars each)
  metadata?: object;         // Optional JSON object
}
```

**Response**:
```typescript
{
  data: Prompt;
  message: "Prompt created successfully";
  success: true;
}
```

**Authorization**: Requires 'prompt:create' permission

**Validation**:
- Title: Required, 3-500 characters
- Content: Required, minimum 10 characters
- Tags: Each tag must be 2-50 characters
- Automatically creates version 1 in history

---

### 2. List Prompts

**Endpoint**: `GET /prompts`

**Description**: Retrieves a paginated list of prompts with filtering and sorting capabilities.

**Query Parameters**:

**Pagination**:
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 20, min: 1, max: 100)

**Sorting**:
- `sortBy` (string, optional): Field to sort by
  - Options: `title`, `created_at`, `updated_at`, `usage_count`, `rating_average`, `status`, `prompt_type`
  - Default: `created_at`
- `sortOrder` (string, optional): Sort direction (`asc` or `desc`, default: `desc`)

**Filtering**:
- `role` (string, optional): Filter by role
- `department` (string, optional): Filter by department
- `workflow` (string, optional): Filter by workflow
- `type` (string, optional): Filter by prompt type
- `status` (string, optional): Filter by status
- `visibility` (string, optional): Filter by visibility
- `author_id` (string, optional): Filter by author UUID
- `search` (string, optional): Search in title, description, and content

**Response**:
```typescript
{
  data: Prompt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: true;
}
```

**Authorization**: Returns only prompts the user has access to based on visibility settings

**Example Usage**:
```typescript
const response = await promptsApi.listPrompts(
  { page: 1, limit: 20 },
  { sortBy: 'created_at', sortOrder: 'desc' },
  { status: 'published', search: 'customer service' }
);
```

---

### 3. Get Prompt by ID

**Endpoint**: `GET /prompts/:id`

**Description**: Retrieves a specific prompt with full details and complete version history.

**Path Parameters**:
- `id` (string, required): UUID of the prompt

**Response**:
```typescript
{
  data: {
    ...Prompt,
    versions: PromptVersion[];
  };
  message: "Prompt retrieved successfully";
  success: true;
}
```

**Authorization**:
- Public prompts: All authenticated users
- Private prompts: Author only
- Team/Department prompts: Members only

**Validation**: ID must be a valid UUID

**Side Effects**: Logs an analytics event for prompt view

---

### 4. Update Prompt

**Endpoint**: `PUT /prompts/:id`

**Description**: Updates prompt content and metadata. Creates a new version if content changes.

**Path Parameters**:
- `id` (string, required): UUID of the prompt

**Request Body** (all fields optional):
```typescript
{
  title?: string;
  description?: string;
  content?: string;
  role?: string;
  department?: string;
  workflow?: string;
  prompt_type?: string;
  status?: string;
  visibility?: string;
  department_id?: string;
  team_id?: string;
  is_template?: boolean;
  tags?: string[];
  metadata?: object;
}
```

**Response**:
```typescript
{
  data: Prompt;
  message: "Prompt updated successfully";
  success: true;
}
```

**Authorization**:
- Author can always update
- Others require 'prompt:update' permission

**Validation**:
- If title provided: 3-500 characters
- If content provided: min 10 characters
- Validates all enum fields

**Versioning**:
- If content changes, creates new version automatically
- Increments version number
- Records change summary

---

### 5. Delete Prompt (Soft Delete)

**Endpoint**: `DELETE /prompts/:id`

**Description**: Soft deletes a prompt by archiving it. Data is retained but marked as archived.

**Path Parameters**:
- `id` (string, required): UUID of the prompt

**Response**:
```typescript
{
  data: null;
  message: "Prompt archived successfully";
  success: true;
}
```

**Authorization**:
- Author can always delete
- Others require 'prompt:delete' permission

**Implementation**:
- Sets `is_archived` to true
- Sets `status` to 'archived'
- Sets `archived_at` timestamp
- Does NOT permanently delete data
- Version history is preserved

---

### 6. Get Prompt Version History

**Endpoint**: `GET /prompts/:id/versions`

**Description**: Retrieves paginated version history for a specific prompt.

**Path Parameters**:
- `id` (string, required): UUID of the prompt

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)

**Response**:
```typescript
{
  data: PromptVersion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: true;
}
```

**Version Object**:
```typescript
{
  id: string;
  prompt_id: string;
  version_number: number;
  title: string;
  prompt_text: string;
  change_summary: string;
  change_type: 'major' | 'minor' | 'patch' | 'rollback';
  author_id: string;
  metadata: object;
  created_at: string;
}
```

**Authorization**: Same as parent prompt access rules

**Sorting**: Returns versions in descending order (newest first)

---

### 7. Revert to Previous Version

**Endpoint**: `POST /prompts/:id/revert`

**Description**: Reverts a prompt to a previous version, creating a new version entry with rollback type.

**Path Parameters**:
- `id` (string, required): UUID of the prompt

**Request Body**:
```typescript
{
  version_id: string;    // Required: UUID of version to revert to
  reason?: string;       // Optional: Reason for reversion
}
```

**Response**:
```typescript
{
  data: Prompt;
  message: "Prompt reverted to version X";
  success: true;
}
```

**Authorization**:
- Author can always revert
- Others require 'prompt:update' permission

**Implementation**:
1. Validates version exists and belongs to prompt
2. Updates prompt with version's title and content
3. Creates new version entry with type 'rollback'
4. Increments version number
5. Records reversion in change summary
6. Logs analytics event

---

## Error Handling

All endpoints follow a standardized error response format:

```typescript
{
  error: string;          // Error code
  message: string;        // Human-readable error message
  statusCode: number;     // HTTP status code
  details?: object;       // Optional additional details
}
```

### Common Error Codes

- **`AUTHENTICATION_ERROR`** (401): User not authenticated
- **`AUTHORIZATION_ERROR`** (403): User lacks permission
- **`NOT_FOUND`** (404): Resource not found
- **`VALIDATION_ERROR`** (400): Request validation failed
- **`INTERNAL_ERROR`** (500): Server error

### Example Error Response

```typescript
{
  error: "VALIDATION_ERROR",
  message: "Validation failed for field 'title': Title must be at least 3 characters long",
  statusCode: 400,
  details: {
    field: "title",
    validationMessage: "Title must be at least 3 characters long"
  }
}
```

---

## Data Models

### Prompt

```typescript
interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  role: string;
  department: string;
  workflow: string;
  prompt_type: string;
  status: string;
  visibility: string;
  author_id: string;
  department_id?: string;
  team_id?: string;
  is_template: boolean;
  is_archived: boolean;
  usage_count: number;
  rating_average: number;
  rating_count: number;
  accuracy_score: number;
  relevance_score: number;
  tags: string[];
  metadata?: object;
  created_at: string;
  updated_at: string;
  created_by?: string;
}
```

---

## Usage Examples

### React Hooks

The API provides custom React hooks for easy integration:

```typescript
import { usePrompts, usePrompt, usePromptVersions, usePromptMutations } from '@/hooks/usePrompts';

// List prompts with pagination and filtering
function PromptList() {
  const { prompts, loading, error, pagination, refetch } = usePrompts(
    { page: 1, limit: 20 },
    { sortBy: 'created_at', sortOrder: 'desc' },
    { status: 'published' }
  );

  // prompts: Prompt[]
  // loading: boolean
  // error: string | null
  // pagination: { page, limit, total, totalPages }
  // refetch: () => void
}

// Get single prompt with versions
function PromptDetail({ id }) {
  const { prompt, loading, error, refetch } = usePrompt(id);

  // prompt: PromptWithVersions
  // includes versions array
}

// Get version history
function VersionHistory({ id }) {
  const { versions, loading, error, pagination, refetch } = usePromptVersions(id);

  // versions: PromptVersion[]
}

// Mutations (create, update, delete, revert)
function PromptEditor() {
  const { createPrompt, updatePrompt, deletePrompt, revertPrompt, loading, error } = usePromptMutations();

  const handleCreate = async () => {
    const prompt = await createPrompt({
      title: 'New Prompt',
      content: 'Prompt content...',
      visibility: 'private',
    });
  };

  const handleUpdate = async (id: string) => {
    const prompt = await updatePrompt(id, {
      title: 'Updated Title',
    });
  };

  const handleDelete = async (id: string) => {
    const success = await deletePrompt(id);
  };

  const handleRevert = async (id: string, versionId: string) => {
    const prompt = await revertPrompt(id, {
      version_id: versionId,
      reason: 'Reverting due to error',
    });
  };
}
```

### Direct API Usage

```typescript
import { promptsApi } from '@/api';

// Create prompt
const response = await promptsApi.createPrompt({
  title: 'Customer Service Prompt',
  content: 'You are a helpful customer service agent...',
  prompt_type: 'customer_service',
  visibility: 'team',
  tags: ['customer-service', 'support'],
});

// List prompts
const prompts = await promptsApi.listPrompts(
  { page: 1, limit: 20 },
  { sortBy: 'rating_average', sortOrder: 'desc' },
  { type: 'technical', status: 'published' }
);

// Get prompt by ID
const prompt = await promptsApi.getPromptById('uuid-here');

// Update prompt
const updated = await promptsApi.updatePrompt('uuid-here', {
  status: 'published',
});

// Delete prompt
await promptsApi.deletePrompt('uuid-here');

// Get versions
const versions = await promptsApi.getPromptVersions('uuid-here', { page: 1, limit: 10 });

// Revert to version
const reverted = await promptsApi.revertPrompt('uuid-here', {
  version_id: 'version-uuid',
  reason: 'Bug fix',
});
```

---

## Analytics & Logging

All API operations automatically log:

1. **Request Logging**: Method, endpoint, parameters
2. **Analytics Events**:
   - `prompt_create`: When prompts are created
   - `prompt_view`: When prompts are viewed
   - `prompt_edit`: When prompts are updated
   - `prompt_delete`: When prompts are archived
3. **Audit Trail**: All CRUD operations are recorded in audit_logs table

---

## Performance Considerations

- **Pagination**: Always use pagination for list endpoints
- **Filtering**: Apply filters to reduce data transfer
- **Caching**: Consider implementing client-side caching for frequently accessed prompts
- **Batch Operations**: For bulk operations, consider implementing batch endpoints
- **Database Indexes**: All foreign keys and commonly queried fields are indexed

---

## Security

- **Authentication**: All endpoints require valid Supabase auth token
- **Authorization**: Row Level Security (RLS) policies enforce access control
- **Input Validation**: All inputs are validated before processing
- **SQL Injection**: Prevented by using Supabase parameterized queries
- **XSS Prevention**: Content should be sanitized on display
- **Rate Limiting**: Consider implementing at Supabase project level

---

---

## Rate Limiting

### Rate Limits by Endpoint Type

All endpoints are subject to rate limiting to ensure fair usage:

| Endpoint Type | Limit | Window | Header |
|--------------|-------|--------|--------|
| Authentication | 10 requests | 1 minute | `X-RateLimit-Auth` |
| Read Operations (GET) | 100 requests | 1 minute | `X-RateLimit-Read` |
| Write Operations (POST/PUT/PATCH) | 50 requests | 1 minute | `X-RateLimit-Write` |
| Delete Operations | 20 requests | 1 minute | `X-RateLimit-Delete` |
| Search Queries | 30 requests | 1 minute | `X-RateLimit-Search` |
| Analytics | 20 requests | 1 minute | `X-RateLimit-Analytics` |
| File Upload | 10 requests | 1 minute | `X-RateLimit-Upload` |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642246320
X-RateLimit-Type: read
```

### Rate Limit Exceeded Response

**HTTP 429 Too Many Requests:**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please retry after 60 seconds.",
  "statusCode": 429,
  "details": {
    "limit": 100,
    "remaining": 0,
    "reset": 1642246320,
    "retry_after": 60
  }
}
```

### Best Practices

1. **Monitor Headers:** Check rate limit headers in responses
2. **Implement Backoff:** Use exponential backoff for retries
3. **Cache Data:** Cache frequently accessed data client-side
4. **Batch Requests:** Combine multiple operations when possible
5. **Use Webhooks:** Subscribe to real-time updates instead of polling

---

## Pagination & Filtering

### Range-Based Pagination (Supabase Default)

```http
GET /rest/v1/prompt_submissions
Range: 0-19
```

**Response Headers:**
```http
Content-Range: 0-19/100
```

### Query Parameter Pagination

```typescript
// Using limit and offset
const { data, count } = await supabase
  .from('prompt_submissions')
  .select('*', { count: 'exact' })
  .range(0, 19);

// Pagination metadata
{
  page: 1,
  per_page: 20,
  total: 100,
  total_pages: 5,
  has_next: true,
  has_prev: false
}
```

### Filtering Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `?status=eq.approved` |
| `neq` | Not equal | `?status=neq.archived` |
| `gt` | Greater than | `?rating=gt.4` |
| `gte` | Greater than or equal | `?rating=gte.4` |
| `lt` | Less than | `?created_at=lt.2024-01-01` |
| `lte` | Less than or equal | `?created_at=lte.2024-12-31` |
| `like` | Pattern match | `?title=like.*customer*` |
| `ilike` | Case-insensitive pattern | `?title=ilike.*Customer*` |
| `in` | In list | `?status=in.(approved,published)` |
| `is` | Is null/not null | `?deleted_at=is.null` |

### Complex Filtering

```http
GET /rest/v1/prompt_submissions?or=(status.eq.approved,status.eq.published)&rating=gte.4&category=eq.customer_service
```

### Sorting

```http
GET /rest/v1/prompt_submissions?order=rating.desc,created_at.desc
```

### Full-Text Search

```http
GET /rest/v1/prompt_submissions?prompt_text=wfts.customer service template
```

---

## WebSocket Endpoints (Realtime)

### Overview

Supabase Realtime provides WebSocket connections for real-time updates.

### Connection

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
```

### Notifications Channel

Subscribe to user-specific notifications:

```typescript
const notificationsChannel = supabase
  .channel('user-notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('New notification:', payload.new);
      // payload.new contains the notification object
    }
  )
  .subscribe();
```

**Notification Payload:**
```json
{
  "schema": "public",
  "table": "notifications",
  "commit_timestamp": "2024-01-15T14:30:00.000Z",
  "eventType": "INSERT",
  "new": {
    "id": "uuid",
    "user_id": "user-uuid",
    "type": "review_assigned",
    "title": "New Review Assignment",
    "message": "You have been assigned to review a prompt",
    "data": {
      "submission_id": "prompt-uuid",
      "submitter_name": "John Doe"
    },
    "read": false,
    "created_at": "2024-01-15T14:30:00.000Z"
  }
}
```

### Prompt Updates Channel

Real-time updates when prompts change:

```typescript
const promptsChannel = supabase
  .channel('prompt-updates')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'prompt_submissions'
    },
    (payload) => {
      switch(payload.eventType) {
        case 'INSERT':
          console.log('New prompt:', payload.new);
          break;
        case 'UPDATE':
          console.log('Updated prompt:', payload.new);
          console.log('Old values:', payload.old);
          break;
        case 'DELETE':
          console.log('Deleted prompt:', payload.old);
          break;
      }
    }
  )
  .subscribe();
```

### Live Metrics Channel

Real-time analytics and metrics:

```typescript
const metricsChannel = supabase
  .channel('live-metrics')
  .on('broadcast', { event: 'metrics-update' }, (payload) => {
    console.log('Metrics updated:', payload);
  })
  .subscribe();

// Send metrics update
metricsChannel.send({
  type: 'broadcast',
  event: 'metrics-update',
  payload: {
    total_prompts: 1547,
    active_users: 234,
    reviews_pending: 45
  }
});
```

### Presence (Online Users)

Track which users are currently online:

```typescript
const presenceChannel = supabase.channel('online-users', {
  config: {
    presence: {
      key: userId
    }
  }
});

// Subscribe and track
presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    console.log('Online users:', Object.keys(state));
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', key);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', key);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        user_id: userId,
        email: userEmail,
        online_at: new Date().toISOString()
      });
    }
  });
```

### Unsubscribing

```typescript
// Unsubscribe from channel
channel.unsubscribe();

// Remove all channels
supabase.removeAllChannels();
```

---

## File Operations

### Upload File

```http
POST /storage/v1/object/{bucket}/{path}
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Example:**
```typescript
const file = event.target.files[0];

// Upload file
const { data, error } = await supabase.storage
  .from('prompt-attachments')
  .upload(`${userId}/${Date.now()}-${file.name}`, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type
  });

// Response
{
  "path": "user-uuid/1642246320-document.pdf",
  "id": "uuid",
  "fullPath": "prompt-attachments/user-uuid/1642246320-document.pdf"
}
```

**File Constraints:**
- Maximum file size: 50 MB
- Allowed types: `.pdf`, `.docx`, `.txt`, `.md`, `.json`, `.csv`, `.xlsx`
- Filename pattern: `[user-id]/[timestamp]-[filename]`

### Download File

```http
GET /storage/v1/object/{bucket}/{path}
```

**Example:**
```typescript
// Download file
const { data, error } = await supabase.storage
  .from('prompt-attachments')
  .download('user-uuid/document.pdf');

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('prompt-attachments')
  .getPublicUrl('user-uuid/document.pdf');
```

### List Files

```typescript
const { data, error } = await supabase.storage
  .from('prompt-attachments')
  .list('user-uuid', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });
```

### Delete File

```typescript
const { data, error } = await supabase.storage
  .from('prompt-attachments')
  .remove(['user-uuid/document.pdf']);
```

---

## OpenAPI Specification

### OpenAPI 3.0 Schema

```yaml
openapi: 3.0.0
info:
  title: Prompt Library Platform API
  version: 2.0.0
  description: Comprehensive API for managing prompts, reviews, and governance
  contact:
    email: api-support@promptlibrary.com

servers:
  - url: https://your-project.supabase.co
    description: Production server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Prompt:
      type: object
      required:
        - title
        - content
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          minLength: 3
          maxLength: 500
        description:
          type: string
        content:
          type: string
          minLength: 10
        category:
          type: string
          enum: [customer_service, content_generation, data_analysis, general]
        tags:
          type: array
          items:
            type: string
            minLength: 2
            maxLength: 50
        status:
          type: string
          enum: [draft, pending_review, approved, rejected, published, archived]
        visibility:
          type: string
          enum: [private, team, department, public]
        created_at:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        statusCode:
          type: integer
        details:
          type: object

security:
  - BearerAuth: []

paths:
  /rest/v1/prompt_submissions:
    get:
      summary: List prompts
      tags:
        - Prompts
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: status
          in: query
          schema:
            type: string
        - name: order
          in: query
          schema:
            type: string
            default: created_at.desc
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Prompt'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      summary: Create prompt
      tags:
        - Prompts
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Prompt'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Prompt'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

---

## Code Examples

### TypeScript/React

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Authenticated request helper
async function apiRequest<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await fn();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No data returned');
  return data;
}

// Create prompt
const createPrompt = async (promptData: any) => {
  return apiRequest(() =>
    supabase
      .from('prompt_submissions')
      .insert(promptData)
      .select()
      .single()
  );
};

// List prompts with pagination
const listPrompts = async (page: number = 1, perPage: number = 20) => {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await supabase
    .from('prompt_submissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / perPage),
      has_next: to < (count || 0) - 1,
      has_prev: page > 1
    }
  };
};

// Real-time subscription
const subscribeToPrompts = (callback: (prompt: any) => void) => {
  const channel = supabase
    .channel('prompt-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'prompt_submissions'
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return () => channel.unsubscribe();
};
```

### cURL Examples

```bash
# Get prompts
curl -X GET 'https://your-project.supabase.co/rest/v1/prompt_submissions?select=*&limit=10' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"

# Create prompt
curl -X POST 'https://your-project.supabase.co/rest/v1/prompt_submissions' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "Example Prompt",
    "content": "Prompt content",
    "category": "general"
  }'

# Update prompt
curl -X PATCH 'https://your-project.supabase.co/rest/v1/prompt_submissions?id=eq.UUID' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'

# Delete prompt
curl -X DELETE 'https://your-project.supabase.co/rest/v1/prompt_submissions?id=eq.UUID' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## Postman Collection

Import this collection to test all endpoints:

```json
{
  "info": {
    "name": "Prompt Library API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://your-project.supabase.co"
    },
    {
      "key": "access_token",
      "value": ""
    },
    {
      "key": "anon_key",
      "value": ""
    }
  ]
}
```

---

## Testing & Validation

### API Testing Checklist

- [ ] Authentication flows (signup, login, logout, refresh)
- [ ] CRUD operations for all resources
- [ ] Pagination on list endpoints
- [ ] Filtering and sorting
- [ ] Error handling for invalid inputs
- [ ] Rate limiting behavior
- [ ] Real-time subscriptions
- [ ] File upload/download
- [ ] Permission checks
- [ ] Audit trail logging

### Sample Test Cases

```typescript
describe('Prompts API', () => {
  it('should create a prompt', async () => {
    const prompt = await createPrompt({
      title: 'Test Prompt',
      content: 'Test content'
    });
    expect(prompt.id).toBeDefined();
  });

  it('should enforce rate limits', async () => {
    // Make 101 requests
    const requests = Array(101).fill(null).map(() => listPrompts());

    await expect(Promise.all(requests)).rejects.toThrow('Rate limit exceeded');
  });

  it('should filter by status', async () => {
    const prompts = await listPrompts(1, 20, { status: 'approved' });
    expect(prompts.data.every(p => p.status === 'approved')).toBe(true);
  });
});
```

---

## Changelog

### Version 2.0.0 (2024-01-15)
- Added comprehensive OpenAPI specification
- Documented rate limiting policies
- Added WebSocket endpoints documentation
- Enhanced file operations section
- Added code examples and Postman collection

### Version 1.0.0 (2024-01-01)
- Initial API documentation
- Core CRUD endpoints
- Basic authentication

---

## Support & Resources

- **API Documentation:** https://docs.promptlibrary.com
- **Status Page:** https://status.promptlibrary.com
- **Support Email:** api-support@promptlibrary.com
- **GitHub:** https://github.com/your-org/prompt-library
- **Discord:** https://discord.gg/prompt-library

---

## License

API access is subject to the Terms of Service at https://promptlibrary.com/terms

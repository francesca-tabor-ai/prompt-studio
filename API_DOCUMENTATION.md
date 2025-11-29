# Prompt Management API Documentation

## Overview

This document describes the comprehensive RESTful API endpoints for prompt management in the Prompt Studio application. All endpoints are implemented as client-side services that interact with Supabase backend.

## Base URL

All API calls are handled through the client-side service layer that communicates with Supabase.

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

## Future Enhancements

Potential API improvements:

1. **Batch Operations**: Create/update/delete multiple prompts
2. **Bulk Import/Export**: Import/export prompts in various formats
3. **Advanced Search**: Full-text search with ranking
4. **Prompt Duplication**: Clone existing prompts
5. **Prompt Templates**: Manage reusable templates
6. **Collaboration**: Share and collaborate on prompts
7. **Approval Workflows**: Multi-stage approval process
8. **Version Comparison**: Diff between versions
9. **GraphQL Support**: Alternative API interface
10. **Webhooks**: Real-time notifications for events

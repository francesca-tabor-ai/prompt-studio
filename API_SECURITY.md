# API Security Documentation

## Overview

Comprehensive API security features including rate limiting, threat detection, input validation, CORS, CSRF protection, API key authentication, request signing, and DDoS protection.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Threat Detection](#threat-detection)
3. [CORS Policies](#cors-policies)
4. [Input Validation](#input-validation)
5. [CSRF Protection](#csrf-protection)
6. [API Key Authentication](#api-key-authentication)
7. [Request Signing](#request-signing)
8. [DDoS Protection](#ddos-protection)

---

## Rate Limiting

### Configuration

```typescript
Default Limits:
- Per User: 100 requests/minute
- Per IP: 50 requests/minute
- Per API Key: 1000 requests/minute
```

### Implementation

```typescript
import { rateLimiter } from './services/api';

const result = await rateLimiter.checkUserLimit(userId);

if (!result.allowed) {
  return {
    error: 'Rate limit exceeded',
    statusCode: 429,
    headers: {
      'Retry-After': result.retryAfter
    }
  };
}
```

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 2024-01-15T10:31:00Z
```

---

## Threat Detection

### Patterns Detected

1. SQL Injection
2. Cross-Site Scripting (XSS)
3. Path Traversal
4. Suspicious User Agents
5. Anomalous Request Patterns

### Implementation

```typescript
import { threatDetectionService } from './services/api';

const analysis = await threatDetectionService.analyzeRequest({
  url, method, headers, body, ip, userId
});

if (!analysis.safe) {
  return { error: 'Request blocked', statusCode: 403 };
}
```

### Automatic Blocking

Critical threats trigger automatic IP blocking for 24 hours.

---

## Input Validation

### Validation Rules

```typescript
import { inputValidationService } from './services/api';

const rules = [
  { field: 'email', type: 'email', required: true },
  { field: 'password', type: 'string', minLength: 12 },
  { field: 'age', type: 'number', min: 18, max: 120 }
];

const result = inputValidationService.validate(data, rules);
```

### Sanitization

All user input is automatically sanitized to prevent XSS and SQL injection attacks.

---

## API Key Authentication

### Creating Keys

```typescript
const apiKey = await apiGateway.createAPIKey(
  userId,
  'Production API Key',
  ['read:prompts', 'write:prompts'],
  365 // expires in days
);
```

### Using Keys

```
X-API-Key: sk_abc123xyz789...
```

Or:

```
Authorization: Bearer sk_abc123xyz789...
```

---

## Request Signing

### HMAC-SHA256 Signatures

```typescript
const signature = apiGateway.signRequest(
  'POST',
  '/api/prompts',
  body,
  apiKey
);

// Include in request
headers['X-Signature'] = signature;
```

---

## DDoS Protection

### Mechanisms

1. Rate limiting per IP/user
2. Automatic IP blocking
3. CloudFront protection
4. Pattern detection
5. Challenge-response

### Metrics

```typescript
const metrics = await apiGateway.getDDoSMetrics(5);
```

---

For complete documentation, see SECURITY.md and DEPLOYMENT.md.

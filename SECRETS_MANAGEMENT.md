# Secrets Management Documentation

## Overview

Comprehensive secrets management system with secure vault storage, automatic rotation, access control, and deployment integration. Never store secrets in code or configuration files.

## Table of Contents

1. [Secrets Vault](#secrets-vault)
2. [Secret Rotation](#secret-rotation)
3. [Access Control](#access-control)
4. [Audit Trail](#audit-trail)
5. [Secret Types](#secret-types)
6. [Deployment Integration](#deployment-integration)
7. [Emergency Procedures](#emergency-procedures)
8. [Best Practices](#best-practices)

---

## Secrets Vault

### Creating Secrets

```typescript
import { secretsVault } from './services/security';

// Create a new secret
const secretId = await secretsVault.createSecret({
  name: 'prod/database/password',
  type: 'database_password',
  value: 'complex_password_here',
  rotationEnabled: true,
  rotationIntervalDays: 90,
  expiresInDays: 365,
  metadata: {
    environment: 'production',
    service: 'api'
  },
  tags: ['database', 'critical']
}, userId);
```

### Retrieving Secrets

```typescript
// Get current version
const secret = await secretsVault.getSecret(
  'prod/database/password',
  userId
);

// Get specific version
const oldSecret = await secretsVault.getSecret(
  'prod/database/password',
  userId,
  5 // version number
);
```

### Updating Secrets

```typescript
await secretsVault.updateSecret(
  'prod/database/password',
  'new_complex_password',
  userId,
  'Security policy update'
);
```

### Secret Types

```typescript
type SecretType =
  | 'password'           // User passwords
  | 'api_key'            // API keys
  | 'certificate'        // SSL/TLS certificates
  | 'encryption_key'     // Encryption keys
  | 'database_password'  // Database credentials
  | 'oauth_token'        // OAuth tokens
  | 'ssh_key'            // SSH private keys
  | 'generic';           // Generic secrets
```

---

## Secret Rotation

### Automatic Rotation

```typescript
import { secretsRotationService } from './services/security';

// Enable auto-rotation
await secretsRotationService.enableAutoRotation(
  secretId,
  90 // days
);

// Rotate immediately
const result = await secretsRotationService.rotateSecret(
  'prod/database/password',
  userId,
  'manual'
);

console.log(`Rotated from v${result.oldVersion} to v${result.newVersion}`);
```

### Rotation Schedule

```typescript
// Schedule future rotation
await secretsRotationService.scheduleRotation(
  secretId,
  new Date('2024-12-31'),
  'automatic'
);

// Get pending rotations
const pending = await secretsRotationService.getPendingRotations();
```

### Bulk Rotation

```typescript
// Rotate all due secrets
const results = await secretsRotationService.rotateAllDueSecrets();

// Emergency rotation (compromised secrets)
const results = await secretsRotationService.emergencyRotateAll('prod/*');
```

### Rotation Metrics

```typescript
const metrics = await secretsRotationService.getRotationMetrics();

// Returns:
{
  totalSecrets: 150,
  rotationEnabled: 120,
  rotationDisabled: 30,
  completedLast30Days: 45,
  failedLast30Days: 2,
  successRate: 95.74
}
```

---

## Access Control

### Least-Privilege Policies

```typescript
import { secretsAccessControl } from './services/security';

// Create access policy
await secretsAccessControl.createPolicy({
  policyName: 'api_service_readonly',
  secretPattern: 'prod/api/*',
  allowedUsers: [],
  allowedRoles: ['api-service'],
  allowedServices: ['api-gateway', 'worker'],
  allowedOperations: ['read'],
  priority: 50
});
```

### Pattern Matching

```typescript
Patterns:
- '*'              // All secrets
- 'prod/*'         // All production secrets
- '*/database/*'   // All database secrets
- 'prod/api/key'   // Specific secret
```

### Grant/Revoke Access

```typescript
// Grant user access
await secretsAccessControl.grantAccess(
  userId,
  'prod/database/*',
  ['read']
);

// Revoke access
await secretsAccessControl.revokeAccess(
  userId,
  'prod/database/*'
);
```

### Check Access

```typescript
const hasAccess = await secretsAccessControl.checkAccess({
  secretName: 'prod/database/password',
  userId: userId,
  operation: 'read'
});

if (!hasAccess) {
  throw new Error('Access denied');
}
```

### Default Policies

**1. Admin Full Access:**
```json
{
  "pattern": "*",
  "operations": ["read", "create", "update", "delete", "rotate", "revoke"],
  "priority": 100
}
```

**2. Service Read-Only:**
```json
{
  "pattern": "service/*",
  "operations": ["read"],
  "priority": 50
}
```

**3. Production Restricted:**
```json
{
  "pattern": "prod/*",
  "operations": ["read"],
  "priority": 75
}
```

---

## Audit Trail

### Access Logging

All secret access is automatically logged:

```typescript
const logs = await secretsAccessControl.getAccessLog(
  secretId,
  userId,
  100 // limit
);

// Log entry:
{
  id: 'log-uuid',
  secret_id: 'secret-uuid',
  accessed_by: 'user-uuid',
  access_type: 'read',
  accessed_at: '2024-01-15T10:30:00Z',
  ip_address: '192.168.1.100',
  access_granted: true
}
```

### Access Denials

```typescript
const denials = await secretsAccessControl.getAccessDenials(50);

// Denied access attempts
denials.forEach(denial => {
  console.log(`User ${denial.accessed_by} denied ${denial.access_type} on ${denial.secret_id}`);
  console.log(`Reason: ${denial.denial_reason}`);
});
```

### Access Metrics

```typescript
const metrics = await secretsAccessControl.getAccessMetrics(secretId);

// Returns:
{
  total: 1547,
  granted: 1532,
  denied: 15,
  byOperation: {
    read: 1450,
    update: 75,
    rotate: 22
  },
  byUser: {
    'user-1': 450,
    'user-2': 350
  }
}
```

---

## Secret Types

### API Keys

```typescript
await secretsVault.createSecret({
  name: 'prod/stripe/api_key',
  type: 'api_key',
  value: 'sk_live_abc123...',
  rotationEnabled: true,
  rotationIntervalDays: 90
});

// Auto-generated format: sk_[32+ random chars]
```

### Database Passwords

```typescript
await secretsVault.createSecret({
  name: 'prod/postgres/password',
  type: 'database_password',
  value: 'complex_db_password',
  rotationEnabled: true,
  rotationIntervalDays: 60,
  metadata: {
    host: 'db.example.com',
    database: 'production'
  }
});
```

### Certificates

```typescript
await secretsVault.createSecret({
  name: 'prod/ssl/certificate',
  type: 'certificate',
  value: '-----BEGIN CERTIFICATE-----\n...',
  rotationEnabled: true,
  rotationIntervalDays: 365,
  expiresInDays: 730
});
```

### Encryption Keys

```typescript
await secretsVault.createSecret({
  name: 'prod/encryption/master_key',
  type: 'encryption_key',
  value: 'hex_encoded_256_bit_key',
  rotationEnabled: true,
  rotationIntervalDays: 90
});
```

---

## Deployment Integration

### Pre-Deployment Validation

```typescript
import { secretsDeploymentService } from './services/security';

// Validate all required secrets exist
const validation = await secretsDeploymentService.validateDeploymentSecrets({
  environment: 'production',
  serviceName: 'api-gateway',
  requiredSecrets: [
    'prod/database/password',
    'prod/stripe/api_key',
    'prod/jwt/secret'
  ]
});

if (!validation.valid) {
  console.error('Missing secrets:', validation.missing);
  console.error('Errors:', validation.errors);
  process.exit(1);
}
```

### Secret Injection

```typescript
// Inject secrets into service
const secrets = await secretsDeploymentService.injectSecrets({
  environment: 'production',
  serviceName: 'api-gateway',
  requiredSecrets: [
    'prod/database/password',
    'prod/stripe/api_key'
  ]
});

// Use injected secrets
const dbPassword = secrets['prod/database/password'];
const stripeKey = secrets['prod/stripe/api_key'];
```

### Environment File Generation

```typescript
const envFile = secretsDeploymentService.generateEnvFile(
  config,
  secrets
);

// Output:
# Generated environment file for api-gateway
# Environment: production
# Generated: 2024-01-15T10:30:00Z

PROD_DATABASE_PASSWORD=complex_password
PROD_STRIPE_API_KEY=sk_live_abc123
```

### Kubernetes Secrets

```typescript
const k8sSecret = secretsDeploymentService.generateKubernetesSecret(
  config,
  secrets
);

// Output YAML:
apiVersion: v1
kind: Secret
metadata:
  name: api-gateway-secrets
  namespace: production
type: Opaque
data:
  database_password: Y29tcGxleF9wYXNzd29yZA==
  stripe_api_key: c2tfbGl2ZV9hYmMxMjM=
```

### Docker Secrets

```typescript
const dockerSecrets = secretsDeploymentService.generateDockerSecrets(
  config,
  secrets
);

// Output:
{
  'api-gateway_database_password': 'complex_password',
  'api-gateway_stripe_api_key': 'sk_live_abc123'
}
```

### Terraform Variables

```typescript
const tfVars = secretsDeploymentService.generateTerraformVariables(
  config,
  secrets
);

// Output:
variable "database_password" {
  type        = string
  description = "Secret: database_password"
  sensitive   = true
}
```

---

## Emergency Procedures

### Emergency Revocation

```typescript
// Immediately revoke compromised secret
await secretsVault.revokeSecret(
  'prod/compromised/api_key',
  userId
);

// Secret status: revoked
// All access denied immediately
```

### Emergency Rotation

```typescript
// Rotate all secrets matching pattern
const results = await secretsRotationService.emergencyRotateAll(
  'prod/api/*'
);

results.forEach(result => {
  if (result.success) {
    console.log(`✓ Rotated ${result.secretId}`);
  } else {
    console.error(`✗ Failed ${result.secretId}: ${result.error}`);
  }
});
```

### Incident Response

**Step 1: Identify compromised secrets**
```typescript
// Get access log
const logs = await secretsAccessControl.getAccessLog(secretId);

// Find suspicious access
const suspicious = logs.filter(log =>
  log.access_granted &&
  log.ip_address !== 'known_ip'
);
```

**Step 2: Revoke access**
```typescript
await secretsVault.revokeSecret(secretName, adminUserId);
```

**Step 3: Rotate immediately**
```typescript
await secretsRotationService.rotateSecret(
  secretName,
  adminUserId,
  'emergency'
);
```

**Step 4: Update services**
```typescript
// Re-inject new secrets
await secretsDeploymentService.injectSecrets(config);
```

**Step 5: Audit and investigate**
```typescript
const metrics = await secretsAccessControl.getAccessMetrics(secretId);
// Review access patterns
```

---

## Best Practices

### Secret Naming Convention

```
{environment}/{service}/{type}

Examples:
- prod/api/database_password
- staging/worker/redis_password
- prod/payment/stripe_api_key
- dev/test/jwt_secret
```

### Rotation Schedule

```typescript
Recommended Intervals:
- API Keys:            90 days
- Database Passwords:  60 days
- Encryption Keys:     90 days
- Certificates:        365 days
- OAuth Tokens:        30 days
- SSH Keys:            180 days
```

### Access Control

**DO:**
- ✅ Use least-privilege policies
- ✅ Grant role-based access
- ✅ Use pattern matching for groups
- ✅ Regular access reviews
- ✅ Monitor access logs

**DON'T:**
- ❌ Grant wildcard access
- ❌ Share secrets between users
- ❌ Store secrets in code
- ❌ Commit secrets to Git
- ❌ Log secret values

### Secret Storage

**NEVER store secrets in:**
- ❌ Source code
- ❌ Configuration files
- ❌ Environment variables (in repo)
- ❌ Logs
- ❌ Error messages
- ❌ Client-side code

**ALWAYS:**
- ✅ Use secrets vault
- ✅ Encrypt at rest
- ✅ Encrypt in transit
- ✅ Version secrets
- ✅ Audit access
- ✅ Rotate regularly

### Deployment

```typescript
// CORRECT: Load from vault
const apiKey = await secretsVault.getSecret('prod/api/key');

// WRONG: Hardcode in code
const apiKey = 'sk_live_abc123'; // ❌ NEVER DO THIS

// WRONG: Store in config file
const config = { apiKey: 'sk_live_abc123' }; // ❌ NEVER DO THIS
```

---

## Security Checklist

### Secrets Management

- [x] All secrets stored in vault
- [x] Secrets encrypted at rest (AES-256)
- [x] Secrets encrypted in transit (TLS 1.3)
- [x] Automatic rotation enabled
- [x] Version history maintained
- [x] Rollback capability
- [x] Access control policies
- [x] Audit logging enabled
- [x] Emergency revocation support

### Access Control

- [x] Least-privilege policies
- [x] Pattern-based access
- [x] Role-based access control
- [x] Service authentication
- [x] Access logging
- [x] Denial tracking
- [x] Regular access reviews

### Deployment

- [x] Pre-deployment validation
- [x] Secure injection
- [x] Environment-specific secrets
- [x] Post-deployment cleanup
- [x] No secrets in code/config
- [x] Integration with CI/CD
- [x] Rollback support

---

## Monitoring & Alerts

### Key Metrics

```typescript
// Secrets requiring attention
const dueRotations = await secretsRotationService.getPendingRotations();

// Access anomalies
const denials = await secretsAccessControl.getAccessDenials(50);

// Rotation failures
const metrics = await secretsRotationService.getRotationMetrics();
```

### Alerts

**High Priority:**
- Secret rotation failed
- Unauthorized access attempt
- Secret compromised
- Rotation past due (>7 days)

**Medium Priority:**
- Secret expiring soon (<7 days)
- Rotation scheduled
- Access pattern anomaly

---

## Support

For secrets management issues:
- **Email**: security@promptlibrary.com
- **Slack**: #secrets-management
- **Emergency**: PagerDuty

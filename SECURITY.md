# Security Documentation

## Overview

This document describes the comprehensive data security measures implemented in the Prompt Library Platform, including encryption, key management, data masking, and compliance features.

## Table of Contents

1. [Encryption at Rest](#encryption-at-rest)
2. [Encryption in Transit](#encryption-in-transit)
3. [Password Security](#password-security)
4. [Key Management](#key-management)
5. [Field-Level Encryption](#field-level-encryption)
6. [Data Masking](#data-masking)
7. [Compliance](#compliance)
8. [Security Best Practices](#security-best-practices)

---

## Encryption at Rest

### AES-256 Encryption

All sensitive data is encrypted using **AES-256-CBC** with PBKDF2 key derivation.

**Implementation:**

```typescript
import { encryptionService } from './services/security';

// Encrypt data
const encrypted = encryptionService.encryptAES256('sensitive data');
// Returns: { ciphertext, iv, salt, keyVersion }

// Decrypt data
const decrypted = encryptionService.decryptAES256({
  ciphertext: encrypted.ciphertext,
  iv: encrypted.iv,
  salt: encrypted.salt,
  keyVersion: encrypted.keyVersion,
});
```

**Key Features:**
- **Algorithm**: AES-256-CBC
- **Key Derivation**: PBKDF2 with 10,000 iterations
- **IV**: Random 128-bit initialization vector per encryption
- **Salt**: Random 128-bit salt per encryption
- **Key Versioning**: Supports multiple key versions for rotation

### Database Encryption

**Supabase Built-in Encryption:**
- Data at rest encrypted using AES-256
- Automatic encryption of all database files
- Encrypted backups
- Encrypted transaction logs

**Application-Level Encryption:**
- Sensitive fields encrypted before storage
- Field-level encryption for PII
- Encrypted API keys and secrets

**Encrypted Fields:**
```typescript
const sensitiveData = {
  ssn: '123-45-6789',
  creditCard: '4532-1234-5678-9010',
  apiKey: 'sk_live_abc123...'
};

// Encrypt object
const encrypted = encryptionService.encryptObject(
  sensitiveData,
  ['ssn', 'creditCard', 'apiKey']
);
```

---

## Encryption in Transit

### TLS 1.3

All data transmitted between clients and servers uses **TLS 1.3**.

**Configuration:**

**Client-Side (Supabase):**
```typescript
// Supabase automatically uses TLS 1.3
const supabase = createClient(supabaseUrl, supabaseKey);
// All requests encrypted with TLS 1.3
```

**API Endpoints:**
- All endpoints require HTTPS
- TLS 1.3 enforced on CloudFront
- Perfect Forward Secrecy (PFS)
- Strong cipher suites only

**Supported Cipher Suites:**
```
TLS_AES_128_GCM_SHA256
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
```

**Certificate Management:**
- Automatic certificate renewal
- Certificate pinning for mobile apps
- HSTS enabled (max-age: 31536000)

---

## Password Security

### Secure Hashing

Passwords are hashed using **PBKDF2** with 100,000 iterations.

**Implementation:**

```typescript
import { encryptionService } from './services/security';

// Hash password during registration
const hashedPassword = encryptionService.hashPassword('user_password');
// Format: pbkdf2$100000$salt$hash

// Verify password during login
const isValid = encryptionService.verifyPassword(
  'user_password',
  hashedPassword
);
```

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Not in common password list

**Additional Security:**
- Rate limiting on login attempts
- Account lockout after 5 failed attempts
- Password reset via secure email link
- Password history (prevent reuse of last 5 passwords)

**Migration from bcrypt/Argon2:**

While we currently use PBKDF2, the system supports migration to Argon2:

```typescript
// Future: Argon2 implementation
const argon2Hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});
```

---

## Key Management

### Encryption Key Lifecycle

**Key States:**
1. **Active** - Currently used for encryption
2. **Rotating** - Being replaced with new key
3. **Deprecated** - No longer used for new data
4. **Destroyed** - Permanently removed

**Key Storage:**

```typescript
import { keyManagementService } from './services/security';

// Store new key
const keyId = await keyManagementService.storeKey(
  keyData,
  version,
  'AES-256-GCM'
);

// Retrieve active key
const activeKey = await keyManagementService.retrieveActiveKey();

// List all keys
const keys = await keyManagementService.listKeys();
```

### Key Rotation

**Automatic Rotation:**
- Keys rotate every 90 days
- Notification 7 days before expiration
- Zero-downtime rotation process

**Manual Rotation:**

```typescript
// Rotate encryption key
const newKeyId = await keyManagementService.rotateKey(oldKeyId);

// Re-encrypt data with new key
const reEncryptedCount = await keyManagementService.reEncryptWithNewKey(
  oldKeyId,
  newKeyId,
  'users',
  ['ssn', 'credit_card']
);
```

**Rotation Process:**
1. Generate new encryption key
2. Store new key with incremented version
3. Mark old key as "rotating"
4. Re-encrypt existing data (background job)
5. Mark old key as "deprecated"
6. Destroy old key after 30 days

### Key Access Audit

All key access is logged:

```typescript
await keyManagementService.auditKeyAccess(
  keyId,
  'retrieve',
  userId
);

// Audit log includes:
// - Key ID
// - Action (retrieve, rotate, destroy)
// - User ID
// - Timestamp
// - IP address
```

### Secrets Vault

**Environment Variables:**
```env
# Master encryption key
VITE_ENCRYPTION_MASTER_KEY=hex_encoded_256_bit_key

# Rotated keys
VITE_ENCRYPTION_KEY_V2=hex_encoded_256_bit_key
VITE_ENCRYPTION_KEY_V3=hex_encoded_256_bit_key
```

**Key Generation:**
```bash
# Generate new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**AWS Secrets Manager Integration:**

```typescript
// Future: AWS Secrets Manager
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

const secret = await secretsManager.getSecretValue({
  SecretId: 'prompt-library/encryption-keys'
}).promise();

const keys = JSON.parse(secret.SecretString);
```

---

## Field-Level Encryption

### Selective Encryption

Encrypt specific fields based on sensitivity:

```typescript
import { encryptionService } from './services/security';

// Define sensitive fields
const sensitiveFields = ['ssn', 'credit_card', 'api_key'];

// Encrypt before storage
const user = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  ssn: '123-45-6789',
  credit_card: '4532-1234-5678-9010'
};

const encryptedUser = encryptionService.encryptObject(
  user,
  sensitiveFields
);

// Store in database
await supabase.from('users').insert(encryptedUser);

// Decrypt after retrieval
const decryptedUser = encryptionService.decryptObject(
  encryptedUser,
  sensitiveFields
);
```

### Data Classification

Fields are classified by sensitivity:

**Classification Levels:**
- **Public** - No encryption needed
- **Internal** - Basic protection
- **Confidential** - Encrypted in storage
- **Restricted** - Encrypted + access controls
- **PII** - Encrypted + compliance tracking

**Classification Schema:**

```sql
CREATE TABLE data_classification (
  table_name text,
  column_name text,
  classification text,
  encryption_required boolean,
  masking_strategy text,
  retention_days integer
);
```

---

## Data Masking

### Automatic Masking

Sensitive data is automatically masked in logs and error messages:

```typescript
import { dataMaskingService } from './services/security';

// Mask email
const masked = dataMaskingService.maskEmail('john.doe@example.com');
// Output: j***e@e***.com

// Mask phone
const masked = dataMaskingService.maskPhone('555-123-4567');
// Output: (***) ***-4567

// Mask credit card
const masked = dataMaskingService.maskCreditCard('4532-1234-5678-9010');
// Output: ****-****-****-9010

// Mask API key
const masked = dataMaskingService.maskAPIKey('sk_live_abc123xyz789');
// Output: sk_l**********789
```

### Masking Strategies

**1. Full Masking:**
```typescript
dataMaskingService.maskString('sensitive', 'full');
// Output: *********
```

**2. Partial Masking:**
```typescript
dataMaskingService.maskString('sensitive', 'partial', 2);
// Output: se*****ve
```

**3. Hash Masking:**
```typescript
dataMaskingService.maskString('sensitive', 'hash');
// Output: hash_a1b2c3
```

**4. Redaction:**
```typescript
dataMaskingService.maskString('sensitive', 'redact');
// Output: [REDACTED]
```

### Log Masking

Automatically mask sensitive data in logs:

```typescript
import { logger } from './services/monitoring';
import { dataMaskingService } from './services/security';

// Original log
const logData = {
  user: 'john.doe@example.com',
  action: 'login',
  apiKey: 'sk_live_abc123xyz789'
};

// Masked log
const maskedLog = dataMaskingService.maskLogData(logData);
logger.info('User action', maskedLog);

// Output: { user: 'j***e@e***.com', action: 'login', apiKey: 'sk_l**********789' }
```

### Error Message Masking

```typescript
try {
  // Operation that might expose sensitive data
  await api.call({ apiKey: 'sk_live_abc123xyz789' });
} catch (error) {
  const maskedError = dataMaskingService.maskErrorMessage(error);
  logger.error('API call failed', maskedError);
}
```

---

## Compliance

### Supported Frameworks

- **GDPR** (General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **SOC 2** (Service Organization Control 2)
- **PCI-DSS** (Payment Card Industry Data Security Standard) - Partial

### GDPR Compliance

**Right to Access:**
```typescript
import { complianceService } from './services/security';

// User data export
const userData = await complianceService.handleDataSubjectAccessRequest(userId);

// Returns:
// {
//   personalData: {...},
//   processingActivities: [...],
//   dataRetention: {...},
//   thirdPartySharing: [...]
// }
```

**Right to Be Forgotten:**
```typescript
// Delete all user data
await complianceService.handleDataDeletionRequest(userId);

// Or anonymize instead
await complianceService.anonymizeUserData(userId);
```

**Right to Data Portability:**
```typescript
const exportedData = await complianceService.handleDataPortabilityRequest(userId);
// Returns JSON file with all user data
```

**Consent Management:**
```typescript
// Record consent
await complianceService.recordConsent(
  userId,
  'marketing_emails',
  true
);

// Validate consent
const hasConsent = await complianceService.validateConsent(
  userId,
  'marketing_emails'
);
```

### Audit Logging

All data operations are logged for compliance:

```typescript
await complianceService.logComplianceEvent({
  eventType: 'data_access',
  resourceType: 'user_data',
  resourceId: userId,
  userId: userId,
  action: 'export_personal_data',
  framework: 'GDPR',
});
```

### Data Retention

Automatic data retention enforcement:

```typescript
// Run retention cleanup
await complianceService.checkDataRetention();

// Policies:
// - Activity logs: 365 days
// - Audit logs: 7 years
// - Session logs: 90 days
```

### Compliance Reports

```typescript
const report = await complianceService.getComplianceReport(
  'GDPR',
  startDate,
  endDate
);

// Returns:
// {
//   framework: 'GDPR',
//   period: { start, end },
//   totalEvents: 1547,
//   eventsByType: {...},
//   dataSubjectRequests: {...},
//   securityIncidents: 0
// }
```

---

## Security Best Practices

### 1. Encryption Keys

**DO:**
- ✅ Rotate keys every 90 days
- ✅ Store keys in environment variables
- ✅ Use different keys per environment
- ✅ Audit key access
- ✅ Generate keys with cryptographically secure random

**DON'T:**
- ❌ Hardcode keys in source code
- ❌ Commit keys to version control
- ❌ Share keys via email/chat
- ❌ Use the same key for multiple purposes
- ❌ Store keys in application logs

### 2. Data Classification

**Classify all data:**
```typescript
// High sensitivity - Always encrypt
['ssn', 'credit_card', 'password', 'api_key']

// Medium sensitivity - Encrypt in production
['email', 'phone', 'address', 'ip_address']

// Low sensitivity - Mask in logs
['username', 'user_agent', 'device_id']
```

### 3. Access Control

**Principle of Least Privilege:**
- Only grant necessary permissions
- Use Row Level Security (RLS) in Supabase
- Implement role-based access control
- Audit access regularly

### 4. Secure Development

**Code Reviews:**
- Security-focused code reviews
- Automated security scanning
- Dependency vulnerability checks

**Testing:**
- Security unit tests
- Penetration testing
- Vulnerability assessments

### 5. Incident Response

**Security Incident Plan:**
1. Detect and contain
2. Assess impact
3. Notify affected users (if required)
4. Remediate vulnerabilities
5. Document and learn

---

## Security Checklist

### Application Security

- [x] AES-256 encryption for data at rest
- [x] TLS 1.3 for data in transit
- [x] PBKDF2 password hashing (100,000 iterations)
- [x] Encryption key rotation (90-day cycle)
- [x] Field-level encryption for PII
- [x] Secure key management
- [x] Data masking in logs
- [x] GDPR compliance features
- [x] Audit logging
- [x] Data retention policies

### Infrastructure Security

- [x] HTTPS enforced on all endpoints
- [x] HSTS headers enabled
- [x] Security headers configured
- [x] Rate limiting implemented
- [x] DDoS protection (CloudFront)
- [x] Database encryption (Supabase)
- [x] Encrypted backups
- [x] Network segmentation

### Operational Security

- [x] Security monitoring
- [x] Intrusion detection
- [x] Vulnerability scanning
- [x] Access logging
- [x] Incident response plan
- [x] Security training
- [x] Compliance audits
- [x] Disaster recovery plan

---

## Contact

For security concerns or vulnerabilities:
- **Email**: security@promptlibrary.com
- **PGP Key**: [Link to public key]
- **Bug Bounty**: [Link to program]

---

## References

- [NIST Cryptographic Standards](https://csrc.nist.gov/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Official Text](https://gdpr-info.eu/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

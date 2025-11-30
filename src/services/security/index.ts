export { encryptionService } from './encryption';
export type { EncryptionResult, DecryptionParams } from './encryption';

export { keyManagementService } from './keyManagement';
export type { EncryptionKey, KeyRotationSchedule } from './keyManagement';

export { dataMaskingService } from './dataMasking';
export type { MaskingStrategy, MaskingRule } from './dataMasking';

export { complianceService } from './compliance';
export type { ComplianceFramework, ComplianceEvent, DataSubjectRequest } from './compliance';

export { secretsVault } from './secretsVault';
export type { SecretType, SecretConfig, Secret } from './secretsVault';

export { secretsRotationService } from './secretsRotation';
export type { RotationConfig, RotationResult } from './secretsRotation';

export { secretsAccessControl } from './secretsAccess';
export type { AccessPolicy, AccessRequest } from './secretsAccess';

export { secretsDeploymentService } from './secretsDeployment';
export type { DeploymentConfig, InjectedSecrets } from './secretsDeployment';

import { secretsVault } from './secretsVault';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  serviceName: string;
  requiredSecrets: string[];
}

export interface InjectedSecrets {
  [key: string]: string;
}

class SecretsDeploymentService {
  private static instance: SecretsDeploymentService;
  private injectedSecrets: Map<string, InjectedSecrets> = new Map();

  private constructor() {}

  static getInstance(): SecretsDeploymentService {
    if (!SecretsDeploymentService.instance) {
      SecretsDeploymentService.instance = new SecretsDeploymentService();
    }
    return SecretsDeploymentService.instance;
  }

  async injectSecrets(config: DeploymentConfig): Promise<InjectedSecrets> {
    const secrets: InjectedSecrets = {};

    for (const secretName of config.requiredSecrets) {
      try {
        const value = await secretsVault.getSecret(secretName);
        secrets[secretName] = value;
      } catch (error) {
        console.error(`Failed to inject secret ${secretName}:`, error);
        throw new Error(
          `Critical secret ${secretName} not available for ${config.environment}`
        );
      }
    }

    this.injectedSecrets.set(config.serviceName, secrets);

    return secrets;
  }

  getInjectedSecret(serviceName: string, secretName: string): string | null {
    const serviceSecrets = this.injectedSecrets.get(serviceName);
    return serviceSecrets?.[secretName] || null;
  }

  generateEnvFile(config: DeploymentConfig, secrets: InjectedSecrets): string {
    let envContent = `# Generated environment file for ${config.serviceName}\n`;
    envContent += `# Environment: ${config.environment}\n`;
    envContent += `# Generated: ${new Date().toISOString()}\n\n`;

    for (const [key, value] of Object.entries(secrets)) {
      const envKey = key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      envContent += `${envKey}=${value}\n`;
    }

    return envContent;
  }

  generateDockerSecrets(
    config: DeploymentConfig,
    secrets: InjectedSecrets
  ): Record<string, string> {
    const dockerSecrets: Record<string, string> = {};

    for (const [key, value] of Object.entries(secrets)) {
      dockerSecrets[`${config.serviceName}_${key}`] = value;
    }

    return dockerSecrets;
  }

  generateKubernetesSecret(
    config: DeploymentConfig,
    secrets: InjectedSecrets
  ): string {
    const data: Record<string, string> = {};

    for (const [key, value] of Object.entries(secrets)) {
      data[key] = Buffer.from(value).toString('base64');
    }

    const k8sSecret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${config.serviceName}-secrets`,
        namespace: config.environment,
        labels: {
          app: config.serviceName,
          environment: config.environment,
        },
      },
      type: 'Opaque',
      data,
    };

    return JSON.stringify(k8sSecret, null, 2);
  }

  generateTerraformVariables(
    config: DeploymentConfig,
    secrets: InjectedSecrets
  ): string {
    let tfVars = '';

    for (const [key, value] of Object.entries(secrets)) {
      const tfKey = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      tfVars += `variable "${tfKey}" {\n`;
      tfVars += `  type        = string\n`;
      tfVars += `  description = "Secret: ${key}"\n`;
      tfVars += `  sensitive   = true\n`;
      tfVars += `}\n\n`;
    }

    return tfVars;
  }

  clearInjectedSecrets(serviceName: string): void {
    this.injectedSecrets.delete(serviceName);
  }

  async validateDeploymentSecrets(config: DeploymentConfig): Promise<{
    valid: boolean;
    missing: string[];
    errors: string[];
  }> {
    const missing: string[] = [];
    const errors: string[] = [];

    for (const secretName of config.requiredSecrets) {
      try {
        await secretsVault.getSecret(secretName);
      } catch (error: any) {
        if (error.message === 'Secret not found') {
          missing.push(secretName);
        } else {
          errors.push(`${secretName}: ${error.message}`);
        }
      }
    }

    return {
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors,
    };
  }

  async preDeploymentCheck(config: DeploymentConfig): Promise<boolean> {
    console.log(`Running pre-deployment check for ${config.serviceName}`);

    const validation = await this.validateDeploymentSecrets(config);

    if (!validation.valid) {
      console.error('Pre-deployment check failed:');

      if (validation.missing.length > 0) {
        console.error('Missing secrets:', validation.missing);
      }

      if (validation.errors.length > 0) {
        console.error('Errors:', validation.errors);
      }

      return false;
    }

    console.log('Pre-deployment check passed');
    return true;
  }

  async postDeploymentCleanup(config: DeploymentConfig): Promise<void> {
    this.clearInjectedSecrets(config.serviceName);

    console.log(`Post-deployment cleanup completed for ${config.serviceName}`);
  }
}

export const secretsDeploymentService = SecretsDeploymentService.getInstance();

import type { ApiError } from './types';

export class ApiErrorHandler {
  static handle(error: unknown): ApiError {
    if (this.isApiError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return this.fromError(error);
    }

    if (typeof error === 'string') {
      return {
        error: 'STRING_ERROR',
        message: error,
        statusCode: 500,
      };
    }

    return {
      error: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      statusCode: 500,
    };
  }

  static isApiError(error: unknown): error is ApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      'message' in error &&
      'statusCode' in error
    );
  }

  static fromError(error: Error): ApiError {
    const message = error.message.toLowerCase();

    if (message.includes('not authenticated')) {
      return {
        error: 'AUTHENTICATION_ERROR',
        message: error.message,
        statusCode: 401,
      };
    }

    if (message.includes('unauthorized') || message.includes('permission')) {
      return {
        error: 'AUTHORIZATION_ERROR',
        message: error.message,
        statusCode: 403,
      };
    }

    if (message.includes('not found')) {
      return {
        error: 'NOT_FOUND',
        message: error.message,
        statusCode: 404,
      };
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return {
        error: 'VALIDATION_ERROR',
        message: error.message,
        statusCode: 400,
      };
    }

    return {
      error: 'INTERNAL_ERROR',
      message: error.message,
      statusCode: 500,
    };
  }

  static createValidationError(field: string, message: string): ApiError {
    return {
      error: 'VALIDATION_ERROR',
      message: `Validation failed for field '${field}': ${message}`,
      statusCode: 400,
      details: {
        field,
        validationMessage: message,
      },
    };
  }

  static createNotFoundError(resource: string, id: string): ApiError {
    return {
      error: 'NOT_FOUND',
      message: `${resource} with id '${id}' not found`,
      statusCode: 404,
      details: {
        resource,
        id,
      },
    };
  }

  static createUnauthorizedError(action: string, resource: string): ApiError {
    return {
      error: 'AUTHORIZATION_ERROR',
      message: `Unauthorized: Cannot ${action} ${resource}`,
      statusCode: 403,
      details: {
        action,
        resource,
      },
    };
  }

  static createAuthenticationError(): ApiError {
    return {
      error: 'AUTHENTICATION_ERROR',
      message: 'User not authenticated',
      statusCode: 401,
    };
  }
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    public validationMessage: string
  ) {
    super(`Validation failed for field '${field}': ${validationMessage}`);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: string
  ) {
    super(`${resource} with id '${id}' not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(
    public action: string,
    public resource: string
  ) {
    super(`Unauthorized: Cannot ${action} ${resource}`);
    this.name = 'UnauthorizedError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

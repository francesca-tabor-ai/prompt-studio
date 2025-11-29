import type { CreatePromptRequest, UpdatePromptRequest } from './types';
import { ValidationError } from './errorHandler';

export class PromptValidator {
  static validateCreateRequest(request: CreatePromptRequest): void {
    if (!request.title || request.title.trim().length === 0) {
      throw new ValidationError('title', 'Title is required');
    }

    if (request.title.length < 3) {
      throw new ValidationError('title', 'Title must be at least 3 characters long');
    }

    if (request.title.length > 500) {
      throw new ValidationError('title', 'Title must not exceed 500 characters');
    }

    if (!request.content || request.content.trim().length === 0) {
      throw new ValidationError('content', 'Content is required');
    }

    if (request.content.length < 10) {
      throw new ValidationError('content', 'Content must be at least 10 characters long');
    }

    if (request.prompt_type) {
      const validTypes = ['general', 'technical', 'creative', 'analytical', 'customer_service', 'other', 'Template'];
      if (!validTypes.includes(request.prompt_type)) {
        throw new ValidationError(
          'prompt_type',
          `Invalid prompt type. Must be one of: ${validTypes.join(', ')}`
        );
      }
    }

    if (request.status) {
      const validStatuses = ['draft', 'review', 'approved', 'rejected', 'published', 'archived', 'Active', 'Inactive'];
      if (!validStatuses.includes(request.status)) {
        throw new ValidationError(
          'status',
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    if (request.visibility) {
      const validVisibilities = ['private', 'team', 'department', 'public'];
      if (!validVisibilities.includes(request.visibility)) {
        throw new ValidationError(
          'visibility',
          `Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`
        );
      }
    }

    if (request.tags && !Array.isArray(request.tags)) {
      throw new ValidationError('tags', 'Tags must be an array');
    }

    if (request.tags) {
      for (const tag of request.tags) {
        if (typeof tag !== 'string') {
          throw new ValidationError('tags', 'All tags must be strings');
        }
        if (tag.length < 2 || tag.length > 50) {
          throw new ValidationError('tags', 'Each tag must be between 2 and 50 characters');
        }
      }
    }
  }

  static validateUpdateRequest(request: UpdatePromptRequest): void {
    if (request.title !== undefined) {
      if (typeof request.title !== 'string') {
        throw new ValidationError('title', 'Title must be a string');
      }
      if (request.title.trim().length === 0) {
        throw new ValidationError('title', 'Title cannot be empty');
      }
      if (request.title.length < 3) {
        throw new ValidationError('title', 'Title must be at least 3 characters long');
      }
      if (request.title.length > 500) {
        throw new ValidationError('title', 'Title must not exceed 500 characters');
      }
    }

    if (request.content !== undefined) {
      if (typeof request.content !== 'string') {
        throw new ValidationError('content', 'Content must be a string');
      }
      if (request.content.trim().length === 0) {
        throw new ValidationError('content', 'Content cannot be empty');
      }
      if (request.content.length < 10) {
        throw new ValidationError('content', 'Content must be at least 10 characters long');
      }
    }

    if (request.prompt_type !== undefined) {
      const validTypes = ['general', 'technical', 'creative', 'analytical', 'customer_service', 'other', 'Template'];
      if (!validTypes.includes(request.prompt_type)) {
        throw new ValidationError(
          'prompt_type',
          `Invalid prompt type. Must be one of: ${validTypes.join(', ')}`
        );
      }
    }

    if (request.status !== undefined) {
      const validStatuses = ['draft', 'review', 'approved', 'rejected', 'published', 'archived', 'Active', 'Inactive'];
      if (!validStatuses.includes(request.status)) {
        throw new ValidationError(
          'status',
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    if (request.visibility !== undefined) {
      const validVisibilities = ['private', 'team', 'department', 'public'];
      if (!validVisibilities.includes(request.visibility)) {
        throw new ValidationError(
          'visibility',
          `Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`
        );
      }
    }

    if (request.tags !== undefined) {
      if (!Array.isArray(request.tags)) {
        throw new ValidationError('tags', 'Tags must be an array');
      }
      for (const tag of request.tags) {
        if (typeof tag !== 'string') {
          throw new ValidationError('tags', 'All tags must be strings');
        }
        if (tag.length < 2 || tag.length > 50) {
          throw new ValidationError('tags', 'Each tag must be between 2 and 50 characters');
        }
      }
    }
  }

  static validateId(id: string, fieldName: string = 'id'): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(fieldName, `${fieldName} is required and must be a string`);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError(fieldName, `${fieldName} must be a valid UUID`);
    }
  }

  static validatePaginationParams(page?: number, limit?: number): void {
    if (page !== undefined) {
      if (typeof page !== 'number' || page < 1) {
        throw new ValidationError('page', 'Page must be a positive number');
      }
    }

    if (limit !== undefined) {
      if (typeof limit !== 'number' || limit < 1 || limit > 100) {
        throw new ValidationError('limit', 'Limit must be between 1 and 100');
      }
    }
  }

  static validateSortParams(sortBy?: string, sortOrder?: string): void {
    if (sortBy !== undefined) {
      const validSortFields = [
        'title',
        'created_at',
        'updated_at',
        'usage_count',
        'rating_average',
        'status',
        'prompt_type',
      ];
      if (!validSortFields.includes(sortBy)) {
        throw new ValidationError(
          'sortBy',
          `Invalid sort field. Must be one of: ${validSortFields.join(', ')}`
        );
      }
    }

    if (sortOrder !== undefined) {
      if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        throw new ValidationError('sortOrder', 'Sort order must be "asc" or "desc"');
      }
    }
  }
}

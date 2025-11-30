export { promptsApi } from './promptsApi';
export { apiClient } from './client';
export { ApiErrorHandler, ValidationError, NotFoundError, UnauthorizedError, AuthenticationError } from './errorHandler';
export { PromptValidator } from './validators';
export { versionControlApi } from './versionControlApi';
export { searchApi } from './searchApi';
export { tagsApi } from './tagsApi';

export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  FilterParams,
  Prompt,
  PromptVersion,
  PromptWithVersions,
  CreatePromptRequest,
  UpdatePromptRequest,
  RevertPromptRequest,
} from './types';

export type {
  PromptBranch,
  VersionMetadata,
  VersionComparison,
  CreateBranchRequest,
  CreateVersionRequest,
} from './versionControlApi';

export type {
  SavedSearch,
  CreateSavedSearchRequest,
  SearchResponse,
} from './searchApi';

export type {
  CreateTagRequest,
  AssignTagRequest,
} from './tagsApi';

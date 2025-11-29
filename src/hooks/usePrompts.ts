import { useState, useEffect, useCallback } from 'react';
import {
  promptsApi,
  type Prompt,
  type PromptWithVersions,
  type PromptVersion,
  type CreatePromptRequest,
  type UpdatePromptRequest,
  type RevertPromptRequest,
  type PaginatedResponse,
  type PaginationParams,
  type SortParams,
  type FilterParams,
  ApiErrorHandler,
} from '../api';

export function usePrompts(
  initialPagination?: PaginationParams,
  initialSort?: SortParams,
  initialFilters?: FilterParams
) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPagination?.page || 1,
    limit: initialPagination?.limit || 20,
    total: 0,
    totalPages: 0,
  });

  const fetchPrompts = useCallback(
    async (
      paginationParams?: PaginationParams,
      sortParams?: SortParams,
      filterParams?: FilterParams
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await promptsApi.listPrompts(
          paginationParams || initialPagination,
          sortParams || initialSort,
          filterParams || initialFilters
        );

        setPrompts(response.data);
        setPagination(response.pagination);
      } catch (err) {
        const apiError = ApiErrorHandler.handle(err);
        setError(apiError.message);
      } finally {
        setLoading(false);
      }
    },
    [initialPagination, initialSort, initialFilters]
  );

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    prompts,
    loading,
    error,
    pagination,
    refetch: fetchPrompts,
  };
}

export function usePrompt(id: string) {
  const [prompt, setPrompt] = useState<PromptWithVersions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompt = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await promptsApi.getPromptById(id);
      setPrompt(response.data);
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrompt();
  }, [fetchPrompt]);

  return {
    prompt,
    loading,
    error,
    refetch: fetchPrompt,
  };
}

export function usePromptVersions(id: string, initialPagination?: PaginationParams) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPagination?.page || 1,
    limit: initialPagination?.limit || 10,
    total: 0,
    totalPages: 0,
  });

  const fetchVersions = useCallback(
    async (paginationParams?: PaginationParams) => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await promptsApi.getPromptVersions(
          id,
          paginationParams || initialPagination
        );

        setVersions(response.data);
        setPagination(response.pagination);
      } catch (err) {
        const apiError = ApiErrorHandler.handle(err);
        setError(apiError.message);
      } finally {
        setLoading(false);
      }
    },
    [id, initialPagination]
  );

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return {
    versions,
    loading,
    error,
    pagination,
    refetch: fetchVersions,
  };
}

export function usePromptMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPrompt = async (request: CreatePromptRequest): Promise<Prompt | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await promptsApi.createPrompt(request);
      return response.data;
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err);
      setError(apiError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updatePrompt = async (
    id: string,
    request: UpdatePromptRequest
  ): Promise<Prompt | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await promptsApi.updatePrompt(id, request);
      return response.data;
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err);
      setError(apiError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deletePrompt = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await promptsApi.deletePrompt(id);
      return true;
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err);
      setError(apiError.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const revertPrompt = async (
    id: string,
    request: RevertPromptRequest
  ): Promise<Prompt | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await promptsApi.revertPrompt(id, request);
      return response.data;
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err);
      setError(apiError.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createPrompt,
    updatePrompt,
    deletePrompt,
    revertPrompt,
    loading,
    error,
  };
}

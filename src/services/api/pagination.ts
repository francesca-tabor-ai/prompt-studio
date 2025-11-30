export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

class PaginationService {
  private static instance: PaginationService;
  private defaultLimit = 20;
  private maxLimit = 100;

  private constructor() {}

  static getInstance(): PaginationService {
    if (!PaginationService.instance) {
      PaginationService.instance = new PaginationService();
    }
    return PaginationService.instance;
  }

  parseParams(query: any): PaginationParams {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || this.defaultLimit,
      this.maxLimit
    );
    const offset = query.offset ? parseInt(query.offset) : (page - 1) * limit;
    const cursor = query.cursor || undefined;

    return { page, limit, offset, cursor };
  }

  async paginate<T>(
    data: T[],
    total: number,
    params: PaginationParams
  ): Promise<PaginationResult<T>> {
    const page = params.page || 1;
    const limit = params.limit || this.defaultLimit;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async cursorPaginate<T>(
    data: T[],
    params: PaginationParams,
    getCursor: (item: T) => string
  ): Promise<CursorPaginationResult<T>> {
    const limit = params.limit || this.defaultLimit;
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    const nextCursor =
      hasMore && items.length > 0 ? getCursor(items[items.length - 1]) : null;

    const prevCursor =
      params.cursor && items.length > 0 ? getCursor(items[0]) : null;

    return {
      data: items,
      pagination: {
        nextCursor,
        prevCursor,
        hasNext: hasMore,
        hasPrev: !!params.cursor,
      },
    };
  }

  buildOffsetQuery(params: PaginationParams): { limit: number; offset: number } {
    const limit = params.limit || this.defaultLimit;
    const offset = params.offset || 0;

    return { limit: limit + 1, offset };
  }

  buildCursorQuery(
    params: PaginationParams,
    cursorField: string = 'created_at'
  ): { limit: number; cursor?: any } {
    return {
      limit: (params.limit || this.defaultLimit) + 1,
      cursor: params.cursor,
    };
  }

  encodeCursor(value: any): string {
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  decodeCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  getLinkHeader(
    baseUrl: string,
    params: PaginationParams,
    totalPages: number
  ): string {
    const links: string[] = [];
    const page = params.page || 1;
    const limit = params.limit || this.defaultLimit;

    if (page > 1) {
      links.push(`<${baseUrl}?page=${page - 1}&limit=${limit}>; rel="prev"`);
      links.push(`<${baseUrl}?page=1&limit=${limit}>; rel="first"`);
    }

    if (page < totalPages) {
      links.push(`<${baseUrl}?page=${page + 1}&limit=${limit}>; rel="next"`);
      links.push(`<${baseUrl}?page=${totalPages}&limit=${limit}>; rel="last"`);
    }

    return links.join(', ');
  }

  setDefaultLimit(limit: number): void {
    this.defaultLimit = limit;
  }

  setMaxLimit(limit: number): void {
    this.maxLimit = limit;
  }
}

export const paginationService = PaginationService.getInstance();

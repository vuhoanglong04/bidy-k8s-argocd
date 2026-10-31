export type ResponseStatus = 'success' | 'fail' | 'error';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  status: ResponseStatus;
  message: string;
  data?: T;
  error_code?: unknown;
}

export const apiResponse = <T>(
  status: ResponseStatus,
  message: string,
  data?: T,
): ApiResponse<T> => {
  const result: ApiResponse<T> = { status, message };

  if (data !== undefined) {
    if (status === 'success') {
      result.data = data;
    } else {
      result.error_code = data;
    }
  }

  return result;
};

export const paginatedResponse = <T>(
  message: string,
  items: T[],
  page: number,
  limit: number,
  totalItems: number,
): ApiResponse<PaginatedData<T>> => {
  const totalPages = Math.ceil(totalItems / limit);

  return apiResponse('success', message, {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
};
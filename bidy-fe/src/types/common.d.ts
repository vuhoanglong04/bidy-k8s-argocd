export interface ApiResponse<T = undefined> {
  status: "success" | "fail";
  message: string;
  data?: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ApiPaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface JwtPayload {
  payload: {
    idUser: string;
    email: string;
    role: string;
  };
  exp: number;
}

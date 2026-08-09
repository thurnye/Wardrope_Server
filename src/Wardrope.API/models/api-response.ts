export interface ApiMeta {
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      meta: ApiMeta;
    }
  | {
      success: false;
      error: ApiError;
      data?: T;
      meta: ApiMeta;
    };

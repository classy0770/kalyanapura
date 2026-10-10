// Browser-safe HTTP types. Never import database or provider code here.
export type ApiMeta = { requestId: string };

export type ApiSuccess<T> = { data: T; meta: ApiMeta };

export type ApiPage = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type ApiList<T> = ApiSuccess<T[]> & { page: ApiPage };

export type ApiValidationField = {
  path: string;
  code: string;
  message: string;
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields?: ApiValidationField[];
    currentVersion?: number;
  };
};

export type AcceptedOperation = {
  operationId: string;
  status: "queued";
  statusUrl: string;
};

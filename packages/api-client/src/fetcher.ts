import type { ApiErrorBody, ApiErrorBodyCode } from "./generated/model";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

/**
 * API が返したエラーかどうかを、`code` まで含めて確かめる。true なら `error.body` を型付きで読める。
 *
 * @example
 * if (isApiError(addTask.error, "WEIGHT_LIMIT_EXCEEDED")) {
 *   setMaxWeight(addTask.error.body.details?.remaining ?? 0);
 * }
 */
export const isApiError = <C extends ApiErrorBodyCode>(
  error: unknown,
  code?: C,
): error is ApiError & { body: ApiErrorBody & { code: C } } => {
  if (!(error instanceof ApiError)) return false;
  const { body } = error;
  if (typeof body !== "object" || body === null || !("code" in body)) return false;
  return code === undefined || body.code === code;
};

const parseBody = async (response: Response): Promise<unknown> => {
  if ([204, 205, 304].includes(response.status)) return null;
  const text = await response.text();
  if (!text) return null;
  return response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : text;
};

// Orval が生成する全リクエストはこの関数を通る。2xx 以外は ApiError を投げるので、
// TanStack Query の isError / error でまとめて扱える。
export const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return { data, status: response.status, headers: response.headers } as T;
};

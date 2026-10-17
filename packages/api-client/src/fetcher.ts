export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

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

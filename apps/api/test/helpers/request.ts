import { exports } from "cloudflare:workers";

/** Worker に対して API リクエストを送る。body を渡すと JSON として送る。 */
export const request = (
  path: string,
  { method = "GET", headers, body }: { method?: string; headers?: Headers; body?: unknown } = {},
) => {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return exports.default.fetch(`http://localhost${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

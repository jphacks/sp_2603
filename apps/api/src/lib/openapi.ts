import type { OpenAPIHonoOptions } from "@hono/zod-openapi";
import { requireAuth } from "../middleware/require-auth";
import type { AuthedEnv } from "../types";
import { errorBody, errorResponse } from "./errors";

export const SESSION_COOKIE_SCHEME = "cookieAuth";

// createRoute に展開して使う。ログイン必須にし、OpenAPI にもその旨を載せる。
export const authRequired = {
  security: [{ [SESSION_COOKIE_SCHEME]: [] }],
  middleware: [requireAuth],
};

export const unauthorizedResponse = {
  401: errorResponse("ログインしていない (UNAUTHORIZED)"),
};

export const validationErrorResponse = {
  400: errorResponse("入力の形が正しくない (VALIDATION_ERROR)"),
};

// ルーターを作るときに `new OpenAPIHono<AuthedEnv>({ defaultHook })` と渡す。
// zod の検証に落ちた入力を、ほかのエラーと同じ形の 400 で返す。
export const defaultHook: NonNullable<OpenAPIHonoOptions<AuthedEnv>["defaultHook"]> = (
  result,
  c,
) => {
  if (result.success) return;
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return c.json(errorBody("VALIDATION_ERROR", "Invalid request", { issues }), 400);
};

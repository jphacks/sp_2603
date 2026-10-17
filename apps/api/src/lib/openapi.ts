import { z } from "@hono/zod-openapi";
import { requireAuth } from "../middleware/require-auth";

export const ErrorSchema = z.object({ message: z.string() }).openapi("Error");

export const SESSION_COOKIE_SCHEME = "cookieAuth";

// createRoute に展開して使う。ログイン必須にし、OpenAPI にもその旨を載せる。
export const authRequired = {
  security: [{ [SESSION_COOKIE_SCHEME]: [] }],
  middleware: [requireAuth],
};

export const unauthorizedResponse = {
  401: {
    description: "Not signed in",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

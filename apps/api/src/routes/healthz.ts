import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../types";

const getHealthz = createRoute({
  method: "get",
  path: "/healthz",
  tags: ["healthz"],
  operationId: "getHealthz",
  responses: {
    200: {
      description: "API is up",
      content: {
        "application/json": { schema: z.object({ status: z.literal("ok") }).openapi("Healthz") },
      },
    },
  },
});

export const healthzRoutes = new OpenAPIHono<AppEnv>().openapi(getHealthz, (c) =>
  c.json({ status: "ok" as const }, 200),
);

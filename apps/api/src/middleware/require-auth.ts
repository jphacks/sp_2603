import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";
import type { AuthedEnv } from "../types";

export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  const result = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!result) return c.json({ message: "Unauthorized" }, 401);
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});

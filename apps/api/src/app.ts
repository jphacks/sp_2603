import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createAuth } from "./auth";
import { SESSION_COOKIE_SCHEME } from "./lib/openapi";
import { healthzRoutes } from "./routes/healthz";
import { meRoutes } from "./routes/me";
import { roomRoutes } from "./routes/rooms";
import type { AppEnv } from "./types";

export const app = new OpenAPIHono<AppEnv>().basePath("/api");

// サインイン、コールバック、サインアウトなどは Better Auth が処理する。OpenAPI には載せない。
app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.route("/", healthzRoutes);
app.route("/", meRoutes);
app.route("/", roomRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", SESSION_COOKIE_SCHEME, {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
});

export const openApiConfig = {
  openapi: "3.1.0",
  info: { title: "Fllooat API", version: "0.0.0" },
} as const;

app.doc31("/openapi.json", openApiConfig);
app.get("/docs", Scalar({ url: "/api/openapi.json" }));

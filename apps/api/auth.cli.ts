// `auth generate` 専用の設定。実際の値は使わないので、ダミーの Env で組み立てる。
import { createAuth } from "./src/auth";

export const auth = createAuth({
  BETTER_AUTH_URL: "http://localhost:5173",
  BETTER_AUTH_SECRET: "cli-only-dummy-secret-cli-only-dummy-secret",
} as Env);

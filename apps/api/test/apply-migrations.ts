import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// 未適用のマイグレーションだけが適用されるので、何度呼ばれても安全。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

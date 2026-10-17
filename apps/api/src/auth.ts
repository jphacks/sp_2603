import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "./db/client";
import * as schema from "./db/schema";

type SocialProviders = NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]>;

// クライアント ID が未設定のプロバイダは無効にする。OAuth アプリを登録していなくても API を起動できる。
const configuredProviders = (env: Env): SocialProviders => ({
  ...(env.GOOGLE_CLIENT_ID && {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  }),
  ...(env.GITHUB_CLIENT_ID && {
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
  }),
});

// テストでは、この設定にテスト用プラグインを足したインスタンスを作る (test/helpers/auth.ts)。
export const createAuthOptions = (env: Env) =>
  ({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }),
    socialProviders: configuredProviders(env),
    account: {
      // Google と GitHub で同じメールアドレスなら、同じユーザーとしてまとめる。
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
  }) satisfies BetterAuthOptions;

// Workers ではバインディングがリクエストごとに渡されるので、インスタンスもリクエストごとに作る。
export const createAuth = (env: Env) => betterAuth(createAuthOptions(env));

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth["$Infer"]["Session"]["user"];
export type AuthSession = Auth["$Infer"]["Session"]["session"];

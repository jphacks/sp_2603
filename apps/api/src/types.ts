import type { AuthSession, AuthUser } from "./auth";

export type AppEnv = { Bindings: Env };

// requireAuth を通ったルートで使う。user と session は必ず入っている。
export type AuthedEnv = {
  Bindings: Env;
  Variables: { user: AuthUser; session: AuthSession };
};

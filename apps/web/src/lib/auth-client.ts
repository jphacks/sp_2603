import { queryOptions } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";

// 同一オリジンの /api/auth を使う (開発時は Vite のプロキシ経由)。
export const authClient = createAuthClient();

export type SocialProvider = "google" | "github";

// セッションも TanStack Query のキャッシュで扱い、ルートのガードとヘッダー表示で共有する。
export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const { data, error } = await authClient.getSession();
    if (error) throw error;
    return data;
  },
});

// ログイン後の戻り先として、自サイト内の相対パスだけを受け付ける。
export const toSafeRedirect = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";

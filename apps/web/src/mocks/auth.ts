import { HttpResponse, http } from "msw";

// モックモードでのログイン状態。ログイン後のリダイレクトやリロードをまたいで保つため localStorage に置く。
// dev サーバーを起動し直すと、起動時の指定 (`pnpm dev:mock` か `pnpm dev:mock --logout`) に戻る。
const STORAGE_KEY = "mock:auth";
const sessionId = import.meta.env.VITE_MOCK_SESSION_ID ?? "default";
const signedInAtStartup = import.meta.env.VITE_MOCK_AUTH !== "signed-out";

type StoredAuth = { sessionId: string; signedIn: boolean };

const isSignedIn = () => {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as StoredAuth | null;
  return stored?.sessionId === sessionId ? stored.signedIn : signedInAtStartup;
};
const setSignedIn = (signedIn: boolean) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, signedIn } satisfies StoredAuth));

const now = new Date().toISOString();
const mockUser = {
  id: "mock-user",
  name: "モック ユーザー",
  email: "mock@example.com",
  emailVerified: true,
  image: null,
  createdAt: now,
  updatedAt: now,
};
const mockSession = {
  id: "mock-session",
  userId: mockUser.id,
  token: "mock-token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: now,
  updatedAt: now,
};

// Better Auth のエンドポイントは OpenAPI に載らないので、ここで手書きする。
export const authHandlers = [
  http.get("/api/auth/get-session", () =>
    HttpResponse.json(isSignedIn() ? { user: mockUser, session: mockSession } : null),
  ),
  http.post("/api/auth/sign-in/social", async ({ request }) => {
    const body = (await request.json()) as { callbackURL?: string };
    setSignedIn(true);
    return HttpResponse.json({ url: body.callbackURL ?? "/", redirect: true });
  }),
  http.post("/api/auth/sign-out", () => {
    setSignedIn(false);
    return HttpResponse.json({ success: true });
  }),
];

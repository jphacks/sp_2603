import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";

describe("ログイン状態", () => {
  it("ログインしていなければセッションは空", async () => {
    const response = await request("/api/auth/get-session");

    expect(await response.json()).toBeNull();
  });

  it("ログインしていればセッションから自分のユーザー情報を取得できる", async () => {
    const { headers } = await signInAsNewUser({ name: "Alice", email: "alice@example.com" });

    const response = await request("/api/auth/get-session", { headers });

    expect(await response.json()).toMatchObject({
      user: { name: "Alice", email: "alice@example.com" },
    });
  });
});

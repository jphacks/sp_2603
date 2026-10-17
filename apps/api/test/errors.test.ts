import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";

describe("エラーの形", () => {
  it("ログインしていない人が API を呼ぶと UNAUTHORIZED が返る", async () => {
    const response = await request("/api/me/tasks");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("前後の空白だけのタイトルでは乗せられず、どの項目が悪いかが返る", async () => {
    const { headers } = await signInAsNewUser();

    const response = await request("/api/me/tasks", {
      method: "POST",
      headers,
      body: { title: "   ", weight: 30 },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { issues: [{ path: "title" }] },
    });
  });

  it("6 桁の数字でない ID ではルームに入れない", async () => {
    const { headers } = await signInAsNewUser();

    const response = await request("/api/rooms/12ab/members", { method: "POST", headers });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

import { describe, expect, it } from "vitest";
import { request } from "./helpers/request";

describe("ヘルスチェック", () => {
  it("API が動いていれば status: ok を返す", async () => {
    const response = await request("/api/healthz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

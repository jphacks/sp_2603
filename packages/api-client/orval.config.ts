import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: "./openapi.json",
    output: {
      target: "./src/generated/api.ts",
      schemas: "./src/generated/model",
      mode: "tags-split",
      client: "react-query",
      httpClient: "fetch",
      mock: {
        indexMockFiles: true,
        generators: [{ type: "msw", delay: 300 }, { type: "faker" }],
      },
      clean: true,
      formatter: "biome",
      override: {
        mutator: { path: "./src/fetcher.ts", name: "apiFetch" },
        // apiFetch は 2xx 以外で例外を投げるので、戻り値の型は成功時だけにする。
        fetch: { forceSuccessResponse: true },
      },
    },
  },
});

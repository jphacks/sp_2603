import * as generatedMocks from "./generated/index.msw";

// 全タグのハンドラを自動で集めるので、`pnpm gen` すれば新しいエンドポイントにもモックが付く。
export const generatedHandlers = Object.values(generatedMocks).flatMap((createHandlers) =>
  createHandlers(),
);

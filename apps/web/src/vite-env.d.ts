/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `pnpm dev:mock` で設定される。`--logout` を付けると "signed-out" */
  readonly VITE_MOCK_AUTH?: "signed-in" | "signed-out";
  readonly VITE_MOCK_SESSION_ID?: string;
}

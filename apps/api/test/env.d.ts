declare namespace Cloudflare {
  interface Env {
    // vitest.config.ts で定義するテスト専用のバインディング
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

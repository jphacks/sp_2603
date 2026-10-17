import type { RequestHandler } from "msw";
import { authHandlers } from "./auth";

// 生成されたランダムなデータでは困る画面 (デモ用の固定データ、状態を持つ動作など) のハンドラをここに足す。
// 例: getGetHealthzMockHandler({ status: "ok" })
export const handlers: RequestHandler[] = [...authHandlers];

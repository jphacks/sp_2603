import { generatedHandlers } from "@sp-2603/api-client/mocks";
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// 手書きのハンドラを先に並べ、生成されたランダム応答より優先させる。
export const worker = setupWorker(...handlers, ...generatedHandlers);

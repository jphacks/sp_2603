// `pnpm dev:mock [--logout]` の入口。Vite の CLI は未知のオプションを受け付けないので、JS API で起動する。
import { createServer } from "vite";

process.env.VITE_MOCK_AUTH = process.argv.includes("--logout") ? "signed-out" : "signed-in";
// 起動ごとに変わる値。ブラウザに残ったモックのログイン状態を、再起動時にリセットするために使う。
process.env.VITE_MOCK_SESSION_ID = String(Date.now());

const server = await createServer({ mode: "mock" });
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });

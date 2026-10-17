// サーバーを起動せずに OpenAPI ドキュメントを書き出す。API を起動していなくても生成できる。
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { app, openApiConfig } from "../src/app";

const outPath = resolve(import.meta.dirname, "../../../packages/api-client/openapi.json");
const document = app.getOpenAPI31Document(openApiConfig);
writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${outPath}`);

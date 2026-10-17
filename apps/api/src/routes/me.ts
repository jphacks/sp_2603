import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { errorResponse } from "../lib/errors";
import {
  authRequired,
  defaultHook,
  unauthorizedResponse,
  validationErrorResponse,
} from "../lib/openapi";
import {
  DroppedTaskSchema,
  MyStatusSchema,
  RoomIdSchema,
  TaskTitleSchema,
  WeightSchema,
} from "../lib/schemas";
import type { AuthedEnv } from "../types";

const MeSchema = z
  .object({
    user: z.object({
      id: z.string().openapi({ example: "u_abc" }),
      name: z.string().openapi({ example: "Alice" }),
      image: z.string().nullable().openapi({ example: "https://example.com/alice.png" }),
    }),
    roomId: RoomIdSchema.nullable().openapi({ description: "ルームに入っていなければ null" }),
  })
  .openapi("Me");

const myStatusResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: MyStatusSchema } },
});

const weightLimitExceededResponse = {
  409: errorResponse("重さの合計が 100% を超える (WEIGHT_LIMIT_EXCEEDED)"),
} as const;

const getMe = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  operationId: "getMe",
  ...authRequired,
  responses: {
    200: {
      description: "ログイン中のユーザーと、今いるルーム",
      content: { "application/json": { schema: MeSchema } },
    },
    ...unauthorizedResponse,
  },
});

const getMyTasks = createRoute({
  method: "get",
  path: "/me/tasks",
  tags: ["me"],
  operationId: "getMyTasks",
  ...authRequired,
  responses: {
    200: myStatusResponse("自分の状態と乗っているタスク"),
    ...unauthorizedResponse,
  },
});

const addMyTask = createRoute({
  method: "post",
  path: "/me/tasks",
  tags: ["me"],
  operationId: "addMyTask",
  ...authRequired,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ title: TaskTitleSchema, weight: WeightSchema }).openapi("NewTask"),
        },
      },
    },
  },
  responses: {
    201: myStatusResponse("タスクを乗せた後の自分の状態"),
    ...validationErrorResponse,
    ...unauthorizedResponse,
    ...weightLimitExceededResponse,
  },
});

const dropMyTasks = createRoute({
  method: "post",
  path: "/me/tasks/drop",
  tags: ["me"],
  operationId: "dropMyTasks",
  ...authRequired,
  responses: {
    200: myStatusResponse("タスクをすべて落とした後の自分の状態"),
    ...unauthorizedResponse,
  },
});

const getMyHistory = createRoute({
  method: "get",
  path: "/me/history",
  tags: ["me"],
  operationId: "getMyHistory",
  ...authRequired,
  responses: {
    200: {
      description: "落としたタスクの履歴。落とした日時の新しい順に最新 50 件",
      content: {
        "application/json": {
          schema: z.object({ tasks: z.array(DroppedTaskSchema) }).openapi("History"),
        },
      },
    },
    ...unauthorizedResponse,
  },
});

const reloadMyTask = createRoute({
  method: "post",
  path: "/me/history/{taskId}/reload",
  tags: ["me"],
  operationId: "reloadMyTask",
  ...authRequired,
  request: {
    params: z.object({
      taskId: z.coerce
        .number()
        .int()
        .positive()
        .openapi({ param: { name: "taskId", in: "path" }, example: 9 }),
    }),
    body: {
      required: true,
      content: {
        "application/json": { schema: z.object({ weight: WeightSchema }).openapi("ReloadTask") },
      },
    },
  },
  responses: {
    200: myStatusResponse("乗せ直した後の自分の状態"),
    ...validationErrorResponse,
    ...unauthorizedResponse,
    404: errorResponse("自分の履歴にそのタスクがない (TASK_NOT_FOUND)"),
    ...weightLimitExceededResponse,
  },
});

// TODO: DB ができたら実装する。今はフロントが hooks をつなげるように仮の値を返す。
const emptyStatus = () => ({
  busy: 0,
  remaining: 100,
  statusUpdatedAt: new Date().toISOString(),
  tasks: [],
});

export const meRoutes = new OpenAPIHono<AuthedEnv>({ defaultHook })
  .openapi(getMe, (c) => {
    const { id, name, image } = c.get("user");
    return c.json({ user: { id, name, image: image ?? null }, roomId: null }, 200);
  })
  .openapi(getMyTasks, (c) => c.json(emptyStatus(), 200))
  .openapi(addMyTask, (c) => {
    const { title, weight } = c.req.valid("json");
    const now = new Date().toISOString();
    return c.json(
      {
        busy: weight,
        remaining: 100 - weight,
        statusUpdatedAt: now,
        tasks: [{ id: 1, title, weight, createdAt: now }],
      },
      201,
    );
  })
  .openapi(dropMyTasks, (c) => c.json(emptyStatus(), 200))
  .openapi(getMyHistory, (c) => c.json({ tasks: [] }, 200))
  .openapi(reloadMyTask, (c) => c.json(emptyStatus(), 200));

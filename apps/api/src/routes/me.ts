import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createDb } from "../db/client";
import { errorBody, errorResponse } from "../lib/errors";
import {
  dropAllTasks,
  getMyStatus,
  insertTaskWithinLimit,
  isInHistory,
  reloadTaskWithinLimit,
  selectHistory,
  touchStatus,
} from "../lib/my-status";
import {
  authRequired,
  defaultHook,
  unauthorizedResponse,
  validationErrorResponse,
} from "../lib/openapi";
import { findMyRoomId } from "../lib/rooms";
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
};

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

const weightLimitExceeded = (remaining: number) =>
  errorBody("WEIGHT_LIMIT_EXCEEDED", `Only ${remaining}% more can be added`, { remaining });

export const meRoutes = new OpenAPIHono<AuthedEnv>({ defaultHook })
  .openapi(getMe, async (c) => {
    const { id, name, image } = c.get("user");
    const roomId = await findMyRoomId(createDb(c.env.DB), id);
    return c.json({ user: { id, name, image: image ?? null }, roomId }, 200);
  })
  .openapi(getMyTasks, async (c) =>
    c.json(await getMyStatus(createDb(c.env.DB), c.get("user")), 200),
  )
  .openapi(addMyTask, async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const { title, weight } = c.req.valid("json");
    const now = new Date();

    if (!(await insertTaskWithinLimit(db, { userId: user.id, title, weight, now }))) {
      const { remaining } = await getMyStatus(db, user);
      return c.json(weightLimitExceeded(remaining), 409);
    }
    await touchStatus(db, user.id, now);
    return c.json(await getMyStatus(db, user), 201);
  })
  .openapi(dropMyTasks, async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    await dropAllTasks(db, user.id, new Date());
    return c.json(await getMyStatus(db, user), 200);
  })
  .openapi(getMyHistory, async (c) => {
    const rows = await selectHistory(createDb(c.env.DB), c.get("user").id);
    // state = 'dropped' の行は CHECK 制約で dropped_at を必ず持つ。
    const tasks = rows.map(({ droppedAt, ...row }) => ({
      ...row,
      droppedAt: (droppedAt as Date).toISOString(),
    }));
    return c.json({ tasks }, 200);
  })
  .openapi(reloadMyTask, async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const { taskId } = c.req.valid("param");
    const { weight } = c.req.valid("json");
    const now = new Date();

    if (!(await reloadTaskWithinLimit(db, { userId: user.id, taskId, weight, now }))) {
      if (!(await isInHistory(db, user.id, taskId))) {
        return c.json(errorBody("TASK_NOT_FOUND", "The task is not in your history"), 404);
      }
      const { remaining } = await getMyStatus(db, user);
      return c.json(weightLimitExceeded(remaining), 409);
    }
    await touchStatus(db, user.id, now);
    return c.json(await getMyStatus(db, user), 200);
  });

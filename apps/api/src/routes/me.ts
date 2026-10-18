import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createDb } from "../db/client";
import { errorBody, errorResponse } from "../lib/errors";
import {
  deleteTask,
  dropAllTasks,
  getMyStatus,
  insertPoolTask,
  isInPool,
  loadTaskWithinLimit,
} from "../lib/my-status";
import {
  authRequired,
  defaultHook,
  unauthorizedResponse,
  validationErrorResponse,
} from "../lib/openapi";
import { findMyRoomId } from "../lib/rooms";
import {
  MyStatusSchema,
  RoomIdSchema,
  TaskIdParamsSchema,
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
    200: myStatusResponse("自分の状態と、乗っているタスクとプールのタスク"),
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
    201: myStatusResponse("プールにタスクを作った後の自分の状態。重さの合計は確かめない"),
    ...validationErrorResponse,
    ...unauthorizedResponse,
  },
});

const dropMyTasks = createRoute({
  method: "post",
  path: "/me/tasks/drop",
  tags: ["me"],
  operationId: "dropMyTasks",
  ...authRequired,
  responses: {
    200: myStatusResponse("乗っているタスクをすべて消した後の自分の状態。プールには戻さない"),
    ...unauthorizedResponse,
  },
});

const loadMyTask = createRoute({
  method: "post",
  path: "/me/tasks/{taskId}/load",
  tags: ["me"],
  operationId: "loadMyTask",
  ...authRequired,
  request: { params: TaskIdParamsSchema },
  responses: {
    200: myStatusResponse("プールのタスクを気球に乗せた後の自分の状態"),
    ...validationErrorResponse,
    ...unauthorizedResponse,
    404: errorResponse("自分のプールにそのタスクがない (TASK_NOT_FOUND)"),
    ...weightLimitExceededResponse,
  },
});

const deleteMyTask = createRoute({
  method: "delete",
  path: "/me/tasks/{taskId}",
  tags: ["me"],
  operationId: "deleteMyTask",
  ...authRequired,
  request: { params: TaskIdParamsSchema },
  responses: {
    200: myStatusResponse("タスクを消した後の自分の状態"),
    ...validationErrorResponse,
    ...unauthorizedResponse,
    404: errorResponse("自分のタスクにそれがない (TASK_NOT_FOUND)"),
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
    c.json(await getMyStatus(createDb(c.env.DB), c.get("user").id), 200),
  )
  .openapi(addMyTask, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const { title, weight } = c.req.valid("json");

    await insertPoolTask(db, { userId, title, weight, now: new Date() });
    return c.json(await getMyStatus(db, userId), 201);
  })
  .openapi(dropMyTasks, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    await dropAllTasks(db, userId);
    return c.json(await getMyStatus(db, userId), 200);
  })
  .openapi(loadMyTask, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const { taskId } = c.req.valid("param");

    if (!(await loadTaskWithinLimit(db, { userId, taskId, now: new Date() }))) {
      if (!(await isInPool(db, userId, taskId))) {
        return c.json(errorBody("TASK_NOT_FOUND", "The task is not in your pool"), 404);
      }
      const { remaining } = await getMyStatus(db, userId);
      return c.json(weightLimitExceeded(remaining), 409);
    }
    return c.json(await getMyStatus(db, userId), 200);
  })
  .openapi(deleteMyTask, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const { taskId } = c.req.valid("param");

    if (!(await deleteTask(db, userId, taskId))) {
      return c.json(errorBody("TASK_NOT_FOUND", "You have no such task"), 404);
    }
    return c.json(await getMyStatus(db, userId), 200);
  });

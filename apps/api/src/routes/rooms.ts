import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { errorResponse } from "../lib/errors";
import {
  authRequired,
  defaultHook,
  unauthorizedResponse,
  validationErrorResponse,
} from "../lib/openapi";
import { MemberDetailSchema, RoomIdParamsSchema, RoomIdSchema, RoomSchema } from "../lib/schemas";
import type { AuthedEnv } from "../types";

const JoinedRoomSchema = z.object({ roomId: RoomIdSchema }).openapi("JoinedRoom");

const notRoomMemberResponse = {
  403: errorResponse("そのルームのメンバーではない (NOT_ROOM_MEMBER)"),
} as const;

const createRoom = createRoute({
  method: "post",
  path: "/rooms",
  tags: ["rooms"],
  operationId: "createRoom",
  ...authRequired,
  responses: {
    201: {
      description: "ルームを作って入った。前のルームにいれば抜ける",
      content: { "application/json": { schema: JoinedRoomSchema } },
    },
    ...unauthorizedResponse,
    503: errorResponse("空いているルーム ID が見つからなかった (ROOM_ID_EXHAUSTED)"),
  },
});

const joinRoom = createRoute({
  method: "post",
  path: "/rooms/{roomId}/members",
  tags: ["rooms"],
  operationId: "joinRoom",
  ...authRequired,
  request: { params: RoomIdParamsSchema },
  responses: {
    200: {
      description: "ルームに入った。前のルームにいれば抜ける",
      content: { "application/json": { schema: JoinedRoomSchema } },
    },
    ...validationErrorResponse,
    ...unauthorizedResponse,
    404: errorResponse("ルームがない (ROOM_NOT_FOUND)"),
    429: errorResponse("短い時間に入室を繰り返した (RATE_LIMITED)"),
  },
});

const getRoom = createRoute({
  method: "get",
  path: "/rooms/{roomId}",
  tags: ["rooms"],
  operationId: "getRoom",
  ...authRequired,
  request: { params: RoomIdParamsSchema },
  responses: {
    200: {
      description: "ルームのメンバーと気球の状態。数秒ごとにポーリングされる",
      content: { "application/json": { schema: RoomSchema } },
    },
    ...validationErrorResponse,
    ...unauthorizedResponse,
    ...notRoomMemberResponse,
    404: errorResponse("ルームがない (ROOM_NOT_FOUND)"),
  },
});

const getRoomMember = createRoute({
  method: "get",
  path: "/rooms/{roomId}/members/{userId}",
  tags: ["rooms"],
  operationId: "getRoomMember",
  ...authRequired,
  request: {
    params: RoomIdParamsSchema.extend({
      userId: z
        .string()
        .min(1)
        .openapi({ param: { name: "userId", in: "path" } }),
    }),
  },
  responses: {
    200: {
      description: "気球の詳細。タスクのタイトルを含む",
      content: { "application/json": { schema: MemberDetailSchema } },
    },
    ...validationErrorResponse,
    ...unauthorizedResponse,
    ...notRoomMemberResponse,
    404: errorResponse("その人は同じルームにいない (MEMBER_NOT_FOUND)"),
  },
});

// TODO: DB ができたら実装する。今はフロントが hooks をつなげるように仮の値を返す。
export const roomRoutes = new OpenAPIHono<AuthedEnv>({ defaultHook })
  .openapi(createRoom, (c) => c.json({ roomId: "012345" }, 201))
  .openapi(joinRoom, (c) => c.json({ roomId: c.req.valid("param").roomId }, 200))
  .openapi(getRoom, (c) => {
    const { id, name, image } = c.get("user");
    const now = new Date().toISOString();
    return c.json(
      {
        roomId: c.req.valid("param").roomId,
        serverTime: now,
        members: [
          { userId: id, name, image: image ?? null, busy: 0, statusUpdatedAt: now, isMe: true },
        ],
      },
      200,
    );
  })
  .openapi(getRoomMember, (c) => {
    const { id, name, image } = c.get("user");
    const now = new Date().toISOString();
    return c.json(
      {
        userId: c.req.valid("param").userId,
        name: c.req.valid("param").userId === id ? name : "Member",
        image: c.req.valid("param").userId === id ? (image ?? null) : null,
        busy: 0,
        statusUpdatedAt: now,
        serverTime: now,
        tasks: [],
      },
      200,
    );
  });

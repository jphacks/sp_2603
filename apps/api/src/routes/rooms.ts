import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createDb } from "../db/client";
import { errorBody, errorResponse } from "../lib/errors";
import { selectOnBoardTasks, toTaskResponse } from "../lib/my-status";
import {
  authRequired,
  defaultHook,
  unauthorizedResponse,
  validationErrorResponse,
} from "../lib/openapi";
import {
  checkRoomAccess,
  createAndJoinRoom,
  enterRoom,
  findRoomMember,
  leaveRoom,
  listRoomMembers,
  roomExists,
  toMemberProfile,
} from "../lib/rooms";
import { MemberDetailSchema, RoomIdParamsSchema, RoomIdSchema, RoomSchema } from "../lib/schemas";
import type { AuthedEnv } from "../types";

const JoinedRoomSchema = z.object({ roomId: RoomIdSchema }).openapi("JoinedRoom");

const notRoomMemberResponse = {
  403: errorResponse("そのルームのメンバーではない (NOT_ROOM_MEMBER)"),
};

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

const leaveMyRoom = createRoute({
  method: "delete",
  path: "/me/room",
  tags: ["rooms"],
  operationId: "leaveMyRoom",
  ...authRequired,
  responses: {
    204: { description: "今いるルームから抜けた。ルームに入っていなくても成功にする" },
    ...unauthorizedResponse,
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

const accessError = (code: "NOT_ROOM_MEMBER" | "ROOM_NOT_FOUND") =>
  code === "NOT_ROOM_MEMBER"
    ? ({ body: errorBody(code, "You are not a member of this room"), status: 403 } as const)
    : ({ body: errorBody(code, "The room does not exist"), status: 404 } as const);

export const roomRoutes = new OpenAPIHono<AuthedEnv>({ defaultHook })
  .openapi(createRoom, async (c) => {
    const roomId = await createAndJoinRoom(createDb(c.env.DB), c.get("user").id, new Date());
    if (roomId === null) {
      return c.json(errorBody("ROOM_ID_EXHAUSTED", "Could not find an unused room ID"), 503);
    }
    return c.json({ roomId }, 201);
  })
  .openapi(leaveMyRoom, async (c) => {
    await leaveRoom(createDb(c.env.DB), c.get("user").id);
    return c.body(null, 204);
  })
  .openapi(joinRoom, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const { roomId } = c.req.valid("param");

    // ID があるかを確かめる前に数えるので、ない ID を総当たりしても回数に入る。
    const { success } = await c.env.JOIN_RATE_LIMITER.limit({ key: userId });
    if (!success) return c.json(errorBody("RATE_LIMITED", "Too many attempts to join"), 429);
    if (!(await roomExists(db, roomId)) || !(await enterRoom(db, userId, roomId, new Date()))) {
      return c.json(errorBody("ROOM_NOT_FOUND", "The room does not exist"), 404);
    }
    return c.json({ roomId }, 200);
  })
  .openapi(getRoom, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const { roomId } = c.req.valid("param");

    const denied = await checkRoomAccess(db, userId, roomId);
    if (denied === "NOT_ROOM_MEMBER") return c.json(accessError(denied).body, 403);
    if (denied === "ROOM_NOT_FOUND") return c.json(accessError(denied).body, 404);
    const members = await listRoomMembers(db, roomId);
    return c.json(
      {
        roomId,
        serverTime: new Date().toISOString(),
        members: members.map((member) => ({
          ...toMemberProfile(member),
          isMe: member.userId === userId,
        })),
      },
      200,
    );
  })
  .openapi(getRoomMember, async (c) => {
    const db = createDb(c.env.DB);
    const { roomId, userId } = c.req.valid("param");

    const denied = await checkRoomAccess(db, c.get("user").id, roomId);
    if (denied === "NOT_ROOM_MEMBER") return c.json(accessError(denied).body, 403);
    // 自分がいたルームが消えることはないので、ROOM_NOT_FOUND はその人もいないものとして扱う。
    const member = denied === null ? await findRoomMember(db, roomId, userId) : undefined;
    if (member === undefined) {
      return c.json(errorBody("MEMBER_NOT_FOUND", "The user is not in this room"), 404);
    }
    const tasks = await selectOnBoardTasks(db, userId);
    return c.json(
      {
        ...toMemberProfile(member),
        serverTime: new Date().toISOString(),
        tasks: tasks.map(toTaskResponse),
      },
      200,
    );
  });

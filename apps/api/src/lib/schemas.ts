import { z } from "@hono/zod-openapi";

export const TITLE_MAX_LENGTH = 30;

export const RoomIdSchema = z
  .string()
  .regex(/^\d{6}$/)
  .openapi({
    description: "6 桁のルーム ID (000000 から 999999)。先頭の 0 を落とさないよう文字列で持つ",
    example: "012345",
  });

export const RoomIdParamsSchema = z.object({
  roomId: RoomIdSchema.openapi({ param: { name: "roomId", in: "path" } }),
});

const BusySchema = z
  .number()
  .int()
  .min(0)
  .max(100)
  .openapi({ description: "忙しさ。乗っているタスクの重さの合計 (%)", example: 60 });

export const WeightSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .openapi({ description: "タスクの重さ (%)", example: 30 });

export const TaskTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(TITLE_MAX_LENGTH)
  .openapi({ example: "API の実装" });

export const TaskSchema = z
  .object({
    id: z.number().int().openapi({ example: 12 }),
    title: z.string().openapi({ example: "API の実装" }),
    weight: WeightSchema,
    createdAt: z.iso.datetime(),
  })
  .openapi("Task");

export const DroppedTaskSchema = z
  .object({
    id: z.number().int().openapi({ example: 9 }),
    title: z.string().openapi({ example: "デザインの確認" }),
    weight: WeightSchema,
    droppedAt: z.iso.datetime(),
  })
  .openapi("DroppedTask");

export const MyStatusSchema = z
  .object({
    busy: BusySchema,
    remaining: z
      .number()
      .int()
      .min(0)
      .max(100)
      .openapi({ description: "あと何 % まで乗せられるか", example: 40 }),
    statusUpdatedAt: z.iso.datetime(),
    tasks: z.array(TaskSchema).openapi({ description: "乗っているタスク。乗せた日時の新しい順" }),
  })
  .openapi("MyStatus");

const MemberProfileSchema = z.object({
  userId: z.string().openapi({ example: "u_abc" }),
  name: z.string().openapi({ example: "Alice" }),
  image: z.string().nullable().openapi({ example: "https://example.com/alice.png" }),
  busy: BusySchema,
  statusUpdatedAt: z.iso.datetime(),
});

export const RoomMemberSchema = MemberProfileSchema.extend({
  isMe: z.boolean(),
}).openapi("RoomMember");

export const MemberDetailSchema = MemberProfileSchema.extend({
  serverTime: z.iso.datetime(),
  tasks: z.array(TaskSchema).openapi({ description: "乗っているタスク。乗せた日時の新しい順" }),
}).openapi("MemberDetail");

export const RoomSchema = z
  .object({
    roomId: RoomIdSchema,
    serverTime: z.iso.datetime(),
    members: z.array(RoomMemberSchema).openapi({ description: "メンバー。自分を含めて入室順" }),
  })
  .openapi("Room");

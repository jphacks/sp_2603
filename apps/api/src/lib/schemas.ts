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

export const TaskIdParamsSchema = z.object({
  taskId: z.coerce
    .number()
    .int()
    .positive()
    .openapi({ param: { name: "taskId", in: "path" }, example: 12 }),
});

const TaskFieldsSchema = z.object({
  id: z.number().int().openapi({ example: 12 }),
  title: z.string().openapi({ example: "API の実装" }),
  weight: WeightSchema,
});

export const TaskSchema = TaskFieldsSchema.extend({
  loadedAt: z.iso.datetime().openapi({ description: "気球に乗せた日時" }),
}).openapi("Task");

export const PoolTaskSchema = TaskFieldsSchema.extend({
  createdAt: z.iso.datetime().openapi({ description: "プールに作った日時" }),
}).openapi("PoolTask");

const OnBoardTasksSchema = z
  .array(TaskSchema)
  .openapi({ description: "気球に乗っているタスク。乗せた日時の新しい順" });

export const MyStatusSchema = z
  .object({
    busy: BusySchema,
    remaining: z
      .number()
      .int()
      .min(0)
      .max(100)
      .openapi({ description: "あと何 % まで乗せられるか", example: 40 }),
    tasks: OnBoardTasksSchema,
    pool: z
      .array(PoolTaskSchema)
      .openapi({ description: "プールにあるタスク。作った日時の新しい順" }),
  })
  .openapi("MyStatus");

const MemberProfileSchema = z.object({
  userId: z.string().openapi({ example: "u_abc" }),
  name: z.string().openapi({ example: "Alice" }),
  image: z.string().nullable().openapi({ example: "https://example.com/alice.png" }),
  busy: BusySchema,
  isAway: z.boolean().openapi({
    description: "最後に画面を開いてから、しきい値 (初期値 3 時間) より長くたっているか",
  }),
});

export const RoomMemberSchema = MemberProfileSchema.extend({
  isMe: z.boolean(),
}).openapi("RoomMember");

export const MemberDetailSchema = MemberProfileSchema.extend({
  tasks: OnBoardTasksSchema,
}).openapi("MemberDetail");

export const RoomSchema = z
  .object({
    roomId: RoomIdSchema,
    members: z.array(RoomMemberSchema).openapi({ description: "メンバー。自分を含めて入室順" }),
  })
  .openapi("Room");

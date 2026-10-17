import { z } from "@hono/zod-openapi";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "NOT_ROOM_MEMBER",
  "ROOM_NOT_FOUND",
  "MEMBER_NOT_FOUND",
  "TASK_NOT_FOUND",
  "WEIGHT_LIMIT_EXCEEDED",
  "RATE_LIMITED",
  "ROOM_ID_EXHAUSTED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ValidationIssueSchema = z
  .object({ path: z.string(), message: z.string() })
  .openapi("ValidationIssue");

// code ごとに使う項目だけが入る。VALIDATION_ERROR は issues、WEIGHT_LIMIT_EXCEEDED は remaining。
const ErrorDetailsSchema = z
  .object({
    issues: z.array(ValidationIssueSchema).optional(),
    remaining: z.number().int().min(0).max(99).optional(),
  })
  .openapi("ErrorDetails");

export const ErrorSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    // 開発者向け。画面にはそのまま出さない。
    message: z.string(),
    details: ErrorDetailsSchema.optional(),
  })
  .openapi("ApiErrorBody");

export type ErrorBody = z.infer<typeof ErrorSchema>;

export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorSchema } },
});

export const errorBody = (
  code: ErrorCode,
  message: string,
  details?: ErrorBody["details"],
): ErrorBody => (details === undefined ? { code, message } : { code, message, details });

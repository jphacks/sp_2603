import { and, asc, eq, lt, notExists, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { room, roomMember, task, user, userStatus } from "../db/schema";

type Db = ReturnType<typeof createDb>;

const ROOM_ID_ATTEMPTS = 5;

const generateRoomId = () => {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(value % 1_000_000).padStart(6, "0");
};

const isRoomIdConflict = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("UNIQUE constraint failed: room.id") || isRoomIdConflict(error.cause)
  );
};

// 空になったルームを消し、その ID をほかのルームで使えるようにする。作った人が抜けても、誰かが残っていれば消さない。
const deleteEmptyRooms = (db: Db) =>
  db
    .delete(room)
    .where(
      notExists(
        db
          .select({ userId: roomMember.userId })
          .from(roomMember)
          .where(eq(roomMember.roomId, room.id)),
      ),
    );

// 入室は 3 文を 1 つの batch で実行する。同じルームに入り直したときは joined_at を変えず、並び順を保つ。
const joinStatements = (db: Db, userId: string, roomId: string, now: Date) =>
  [
    db
      .insert(roomMember)
      .values({ userId, roomId, joinedAt: now })
      .onConflictDoUpdate({
        target: roomMember.userId,
        set: { roomId: sql`excluded.room_id`, joinedAt: sql`excluded.joined_at` },
        setWhere: sql`${roomMember.roomId} <> excluded.room_id`,
      }),
    // 最後に画面を開いていた時刻は人に付くので、ルームを移っただけでは変えない。
    db.insert(userStatus).values({ userId, lastSeenAt: now }).onConflictDoNothing(),
    deleteEmptyRooms(db),
  ] as const;

/** ルームを作って入る。空いている ID が見つからなければ null。 */
export const createAndJoinRoom = async (db: Db, userId: string, now: Date) => {
  for (let attempt = 0; attempt < ROOM_ID_ATTEMPTS; attempt++) {
    const roomId = generateRoomId();
    try {
      // room の追加が ID の衝突で失敗すると batch 全体が取り消されるので、他人のルームに入ってしまうことはない。
      await db.batch([
        db.insert(room).values({ id: roomId, createdBy: userId, createdAt: now }),
        ...joinStatements(db, userId, roomId, now),
      ]);
      return roomId;
    } catch (error) {
      if (!isRoomIdConflict(error)) throw error;
    }
  }
  return null;
};

export const roomExists = async (db: Db, roomId: string) =>
  (await db.select({ id: room.id }).from(room).where(eq(room.id, roomId)).get()) !== undefined;

const isMissingRoom = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return error.message.includes("FOREIGN KEY constraint failed") || isMissingRoom(error.cause);
};

/** ルームに入る。あると確かめた後に、最後の人が抜けてルームが消えていたら false。 */
export const enterRoom = async (db: Db, userId: string, roomId: string, now: Date) => {
  try {
    await db.batch([...joinStatements(db, userId, roomId, now)]);
    return true;
  } catch (error) {
    if (isMissingRoom(error)) return false;
    throw error;
  }
};

/** 今いるルームから抜ける。ルームに入っていなくても何もせずに終わる。 */
export const leaveRoom = (db: Db, userId: string) =>
  db.batch([db.delete(roomMember).where(eq(roomMember.userId, userId)), deleteEmptyRooms(db)]);

export const findMyRoomId = async (db: Db, userId: string) =>
  (
    await db
      .select({ roomId: roomMember.roomId })
      .from(roomMember)
      .where(eq(roomMember.userId, userId))
      .get()
  )?.roomId ?? null;

/** そのルームの情報を見てよいかを確かめる。見てよければ null、だめならエラーの code を返す。 */
export const checkRoomAccess = async (db: Db, userId: string, roomId: string) => {
  if ((await findMyRoomId(db, userId)) === roomId) return null;
  return (await roomExists(db, roomId)) ? "NOT_ROOM_MEMBER" : "ROOM_NOT_FOUND";
};

const memberColumns = {
  userId: user.id,
  name: user.name,
  image: user.image,
  joinedAt: roomMember.joinedAt,
  lastSeenAt: userStatus.lastSeenAt,
  busy: sql<number>`(select coalesce(sum(${task.weight}), 0) from ${task} where ${task.userId} = ${user.id} and ${task.state} = 'on')`.mapWith(
    Number,
  ),
};

const selectMembers = (db: Db) =>
  db
    .select(memberColumns)
    .from(roomMember)
    .innerJoin(user, eq(user.id, roomMember.userId))
    .leftJoin(userStatus, eq(userStatus.userId, roomMember.userId));

type MemberRow = Awaited<ReturnType<ReturnType<typeof selectMembers>["all"]>>[number];

// AWAY_THRESHOLD_MINUTES が空や数でないときだけ使う。ふだんの値は wrangler.jsonc の vars で決める。
const FALLBACK_AWAY_THRESHOLD_MINUTES = 30;

/** 離れているとみなすまでの時間 (ミリ秒)。環境変数 AWAY_THRESHOLD_MINUTES の値が正の数でなければ、フォールバックの値を使う。 */
export const awayThresholdMs = (env: Pick<Env, "AWAY_THRESHOLD_MINUTES">) => {
  const minutes = Number(env.AWAY_THRESHOLD_MINUTES);
  const valid = Number.isFinite(minutes) && minutes > 0;
  return (valid ? minutes : FALLBACK_AWAY_THRESHOLD_MINUTES) * 60_000;
};

/** 端末の時計がずれていても結果が変わらないよう、離れているかはサーバーの時計で決める。 */
export const toMemberProfile = (
  { joinedAt, lastSeenAt, ...row }: MemberRow,
  { now, awayThresholdMs }: { now: Date; awayThresholdMs: number },
) => ({
  ...row,
  // user_status の行は入室のときに作るので、ない場合はふつう起きない。念のため入室日時で埋める。
  isAway: now.getTime() - (lastSeenAt ?? joinedAt).getTime() >= awayThresholdMs,
});

// ポーリングのたびに書くと D1 の書き込みの無料枠を超えるので、前回から 1 分以上たったときだけ書く。
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

/** 最後に画面を開いていた時刻を今にする。 */
export const touchLastSeen = (db: Db, userId: string, now: Date) =>
  db
    .update(userStatus)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(userStatus.userId, userId),
        lt(userStatus.lastSeenAt, new Date(now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS)),
      ),
    );

/** ルームのメンバーを入室順に返す。 */
export const listRoomMembers = (db: Db, roomId: string) =>
  selectMembers(db)
    .where(eq(roomMember.roomId, roomId))
    .orderBy(asc(roomMember.joinedAt), asc(roomMember.userId));

export const findRoomMember = (db: Db, roomId: string, userId: string) =>
  selectMembers(db)
    .where(and(eq(roomMember.roomId, roomId), eq(roomMember.userId, userId)))
    .get();

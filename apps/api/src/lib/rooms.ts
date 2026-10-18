import { and, asc, eq, notExists, sql } from "drizzle-orm";
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
    // 最終更新は人に付くので、ルームを移っただけでは変えない。
    db.insert(userStatus).values({ userId, updatedAt: now }).onConflictDoNothing(),
    // 移る前のルームが空になったら消し、その ID をほかのルームで使えるようにする。作った人が抜けても、誰かが残っていれば消さない。
    db
      .delete(room)
      .where(
        notExists(
          db
            .select({ userId: roomMember.userId })
            .from(roomMember)
            .where(eq(roomMember.roomId, room.id)),
        ),
      ),
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
  statusUpdatedAt: userStatus.updatedAt,
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

export const toMemberProfile = ({ joinedAt, statusUpdatedAt, ...row }: MemberRow) => ({
  ...row,
  // 最終更新の行は入室のときに作るので、ない場合はふつう起きない。念のため入室日時で埋める。
  statusUpdatedAt: (statusUpdatedAt ?? joinedAt).toISOString(),
});

/** ルームのメンバーを入室順に返す。 */
export const listRoomMembers = (db: Db, roomId: string) =>
  selectMembers(db)
    .where(eq(roomMember.roomId, roomId))
    .orderBy(asc(roomMember.joinedAt), asc(roomMember.userId));

export const findRoomMember = (db: Db, roomId: string, userId: string) =>
  selectMembers(db)
    .where(and(eq(roomMember.roomId, roomId), eq(roomMember.userId, userId)))
    .get();

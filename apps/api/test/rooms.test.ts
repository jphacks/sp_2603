import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";
import { createRoom, joinRoom, leaveRoom } from "./helpers/room";

type RoomBody = { members: { userId: string; name: string; isMe: boolean }[] };

const getMembers = async (headers: Headers, roomId: string) => {
  const response = await request(`/api/rooms/${roomId}`, { headers });
  return ((await response.json()) as RoomBody).members;
};

describe("ルーム", () => {
  it("ルームに入っていない人の今いるルームは null", async () => {
    const { headers } = await signInAsNewUser();

    const response = await request("/api/me", { headers });

    expect(await response.json()).toMatchObject({ roomId: null });
  });

  it("ルームを作るとそのルームに入った状態になる", async () => {
    const { headers } = await signInAsNewUser();

    const response = await request("/api/rooms", { method: "POST", headers });

    expect(response.status).toBe(201);
    const { roomId } = (await response.json()) as { roomId: string };
    expect(roomId).toMatch(/^\d{6}$/);
    const me = await request("/api/me", { headers });
    expect(await me.json()).toMatchObject({ roomId });
  });

  it("6 桁の ID を入れると同じルームに入れる", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const roomId = await createRoom(alice.headers);

    const response = await joinRoom(bob.headers, roomId);

    expect(response.status).toBe(200);
    const members = await getMembers(alice.headers, roomId);
    expect(members.map(({ name }) => name)).toEqual(["Alice", "Bob"]);
  });

  it("ルームの一覧では自分だけが isMe になる", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);

    const members = await getMembers(bob.headers, roomId);

    expect(members.map(({ name, isMe }) => [name, isMe])).toEqual([
      ["Alice", false],
      ["Bob", true],
    ]);
  });

  it("ない ID のルームには入れない", async () => {
    const { headers } = await signInAsNewUser();
    const roomId = await createRoom(headers);
    const missingRoomId = roomId === "000000" ? "000001" : "000000";

    const response = await joinRoom(headers, missingRoomId);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("入室を短い時間に繰り返すと断られる", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await joinRoom(bob.headers, roomId)).status);

    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("別のルームに入ると、前のルームのメンバー一覧から消える", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const firstRoomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, firstRoomId);

    await createRoom(bob.headers);

    const members = await getMembers(alice.headers, firstRoomId);
    expect(members.map(({ name }) => name)).toEqual(["Alice"]);
  });

  it("ルームを作った人が抜けても、誰かが残っていればルームは残る", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const carol = await signInAsNewUser({ name: "Carol" });
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);

    await createRoom(alice.headers);

    expect((await joinRoom(carol.headers, roomId)).status).toBe(200);
    const members = await getMembers(bob.headers, roomId);
    expect(members.map(({ name }) => name)).toEqual(["Bob", "Carol"]);
  });

  it("全員が抜けたルームは消え、その ID では入れなくなる", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);

    await createRoom(alice.headers);

    const response = await joinRoom(bob.headers, roomId);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("ルームから抜けると、どのルームにも入っていない状態になり、メンバー一覧から消える", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);

    const response = await leaveRoom(bob.headers);

    expect(response.status).toBe(204);
    const me = await request("/api/me", { headers: bob.headers });
    expect(await me.json()).toMatchObject({ roomId: null });
    const members = await getMembers(alice.headers, roomId);
    expect(members.map(({ name }) => name)).toEqual(["Alice"]);
  });

  it("最後の人が抜けたルームは消え、その ID では入れなくなる", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);

    await leaveRoom(alice.headers);

    expect((await joinRoom(bob.headers, roomId)).status).toBe(404);
  });

  it("ルームに入っていなくても、抜ける操作は成功する", async () => {
    const { headers } = await signInAsNewUser();

    const response = await leaveRoom(headers);

    expect(response.status).toBe(204);
  });

  it("ログインしていない人はルームから抜けられない", async () => {
    const response = await leaveRoom(new Headers());

    expect(response.status).toBe(401);
  });

  it("同じルームに入り直しても並び順は変わらない", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);

    await joinRoom(alice.headers, roomId);

    const members = await getMembers(bob.headers, roomId);
    expect(members.map(({ name }) => name)).toEqual(["Alice", "Bob"]);
  });

  it("ルームを移っただけでは最終更新は変わらない", async () => {
    const { headers } = await signInAsNewUser();
    await createRoom(headers);
    const before = await request("/api/me/tasks", { headers });
    const { statusUpdatedAt } = (await before.json()) as { statusUpdatedAt: string };

    await createRoom(headers);

    const after = await request("/api/me/tasks", { headers });
    expect(await after.json()).toMatchObject({ statusUpdatedAt });
  });

  it("メンバーでないルームの情報は見られない", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);

    const response = await request(`/api/rooms/${roomId}`, { headers: bob.headers });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "NOT_ROOM_MEMBER" });
  });
});

import {
  getGetMeQueryKey,
  isApiError,
  useCreateRoom,
  useGetMe,
  useJoinRoom,
} from "@fllooat/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/user-menu";
import { isRoomId, ROOM_ID_LENGTH } from "@/lib/room-id";

export const Route = createFileRoute("/_authed/join")({
  // ルームの URL から招待されたとき、その ID を入力欄に入れた状態で開く。
  validateSearch: (search): { roomId?: string } =>
    typeof search.roomId === "string" && isRoomId(search.roomId) ? { roomId: search.roomId } : {},
  component: JoinPage,
});

/** ルームを移る操作。今のルームに入っている人には、抜けることを確認してから実行する。 */
type PendingAction = { kind: "join"; roomId: string } | { kind: "create" };

const errorMessageOf = (error: unknown) => {
  if (isApiError(error, "ROOM_NOT_FOUND")) return "ルームが見つかりません";
  if (isApiError(error, "RATE_LIMITED")) return "少し待ってからもう一度試してください";
  if (error) return "もう一度試してください";
  return null;
};

// TODO: デザインが来たら見た目を差し替える。
function JoinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [roomId, setRoomId] = useState(search.roomId ?? "");
  const [confirming, setConfirming] = useState<PendingAction>();

  const { data: me } = useGetMe();
  const currentRoomId = me?.data.roomId ?? null;

  const enterRoom = async ({ data }: { data: { roomId: string } }) => {
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    navigate({ to: "/rooms/$roomId", params: { roomId: data.roomId } });
  };
  const joinRoom = useJoinRoom({ mutation: { onSuccess: enterRoom } });
  const createRoom = useCreateRoom({ mutation: { onSuccess: enterRoom } });
  const isPending = joinRoom.isPending || createRoom.isPending;
  const errorMessage = errorMessageOf(joinRoom.error ?? createRoom.error);

  const run = (action: PendingAction) => {
    setConfirming(undefined);
    joinRoom.reset();
    createRoom.reset();
    if (action.kind === "join") joinRoom.mutate({ roomId: action.roomId });
    else createRoom.mutate();
  };
  // 別のルームに入っているときだけ確認する。同じルームに入り直すのは何も変わらない。
  const request = (action: PendingAction) => {
    const leavesCurrentRoom =
      currentRoomId !== null && !(action.kind === "join" && action.roomId === currentRoomId);
    if (leavesCurrentRoom) setConfirming(action);
    else run(action);
  };

  return (
    <section className="mx-auto flex h-full max-w-sm flex-col justify-center gap-6 px-4">
      <div className="self-end">
        <UserMenu />
      </div>
      <h1 className="text-2xl font-bold">ルームに入る</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isRoomId(roomId)) request({ kind: "join", roomId });
        }}
        className="flex gap-2"
      >
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={ROOM_ID_LENGTH}
          placeholder="6 桁のルーム ID"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" disabled={!isRoomId(roomId) || isPending}>
          入る
        </Button>
      </form>
      <Button variant="outline" disabled={isPending} onClick={() => request({ kind: "create" })}>
        ルームを新しく作る
      </Button>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {currentRoomId && (
        <Button variant="link" asChild>
          <Link to="/rooms/$roomId" params={{ roomId: currentRoomId }}>
            今のルーム ({currentRoomId}) に戻る
          </Link>
        </Button>
      )}
      <Dialog
        open={confirming !== undefined}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      >
        <DialogContent>
          <DialogTitle>今のルームから抜けます</DialogTitle>
          <DialogDescription>
            ルーム {currentRoomId} から抜けて、
            {confirming?.kind === "join"
              ? `ルーム ${confirming.roomId} に入ります。`
              : "新しいルームを作ります。"}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(undefined)}>
              やめる
            </Button>
            <Button onClick={() => confirming && run(confirming)}>抜けて進む</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

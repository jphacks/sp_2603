import {
  getGetMeQueryKey,
  isApiError,
  useCreateRoom,
  useGetMe,
  useJoinRoom,
} from "@fllooat/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth-client";
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

const fieldButtonClassName =
  "h-[35px] w-full rounded-[10px] bg-[#e6e6e6] text-lg font-normal text-[#0055dd] hover:bg-[#e6e6e6]/90";

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

  const handleSignOut = async () => {
    await signOut(queryClient);
    await navigate({ to: "/login" });
  };

  return (
    <main className="flex h-full flex-col items-center bg-[#0055dd] px-4 pb-22.5 text-[#e6e6e6]">
      <h1 className="mt-[28dvh] flex w-full justify-center">
        <Logo />
        <span className="sr-only">ルームに入る</span>
      </h1>
      <div className="mt-auto flex w-full max-w-70 flex-col gap-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isRoomId(roomId)) request({ kind: "join", roomId });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="room-id" className="text-sm text-[#e6e6e6]/90">
              ルーム番号を入力
            </label>
            {/* iOS は 16px 未満の入力欄にフォーカスすると画面を拡大するので、文字はデザインの 14px より大きくする。 */}
            <Input
              id="room-id"
              inputMode="numeric"
              autoComplete="off"
              maxLength={ROOM_ID_LENGTH}
              placeholder="000000"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value.replace(/\D/g, ""))}
              className="h-9 rounded-md border-none bg-[#cce2f4] px-3 text-base text-[#0055dd] placeholder:text-[#45aeef] focus-visible:ring-white/60 md:text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={!isRoomId(roomId) || isPending}
            className={fieldButtonClassName}
          >
            入室
          </Button>
        </form>
        <div className="flex items-center gap-4 text-sm">
          <span className="h-0 flex-1 border-t-[0.5px] border-white" />
          または
          <span className="h-0 flex-1 border-t-[0.5px] border-white" />
        </div>
        <Button
          disabled={isPending}
          onClick={() => request({ kind: "create" })}
          className={fieldButtonClassName}
        >
          新規ルーム作成
        </Button>
        {errorMessage && (
          <p role="alert" className="text-center text-sm text-white">
            {errorMessage}
          </p>
        )}
        <button type="button" className="self-center text-sm" onClick={handleSignOut}>
          ログアウト
        </button>
      </div>
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
    </main>
  );
}

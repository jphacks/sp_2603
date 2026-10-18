import {
  getGetMeQueryKey,
  getGetMeQueryOptions,
  isApiError,
  useCreateRoom,
  useJoinRoom,
} from "@fllooat/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth-client";
import { isRoomId, ROOM_ID_LENGTH } from "@/lib/room-id";

export const Route = createFileRoute("/_authed/join")({
  // ルームに入っている人は、URL を直接開いたり戻るボタンで来たりしても、ルームに戻す。
  // この画面に来られるのは、ルームの画面で退出したあとだけ。
  beforeLoad: async ({ context }) => {
    // 取れなかったときは入室の画面を出す。入室や作成のエラーで気づける。
    const me = await context.queryClient
      .fetchQuery({ ...getGetMeQueryOptions(), staleTime: 0 })
      .then(({ data }) => data)
      .catch(() => null);
    if (me?.roomId) {
      throw redirect({ to: "/rooms/$roomId", params: { roomId: me.roomId }, replace: true });
    }
  },
  component: JoinPage,
});

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
  const [roomId, setRoomId] = useState("");

  const enterRoom = async ({ data }: { data: { roomId: string } }) => {
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    navigate({ to: "/rooms/$roomId", params: { roomId: data.roomId } });
  };
  const joinRoom = useJoinRoom({ mutation: { onSuccess: enterRoom } });
  const createRoom = useCreateRoom({ mutation: { onSuccess: enterRoom } });
  const isPending = joinRoom.isPending || createRoom.isPending;
  const errorMessage = errorMessageOf(joinRoom.error ?? createRoom.error);

  const join = (id: string) => {
    createRoom.reset();
    joinRoom.mutate({ roomId: id });
  };
  const create = () => {
    joinRoom.reset();
    createRoom.mutate();
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
        {errorMessage && (
          <p role="alert" className="text-center text-sm text-white">
            {errorMessage}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isRoomId(roomId)) join(roomId);
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
        <Button disabled={isPending} onClick={create} className={fieldButtonClassName}>
          新規ルーム作成
        </Button>
        <button type="button" className="self-center text-sm" onClick={handleSignOut}>
          ログアウト
        </button>
      </div>
    </main>
  );
}

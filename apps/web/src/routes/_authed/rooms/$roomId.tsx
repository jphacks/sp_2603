import {
  getGetMeQueryKey,
  isApiError,
  type RoomMember,
  useAddMyTask,
  useDeleteMyTask,
  useDropMyTasks,
  useGetMyTasks,
  useGetRoom,
  useGetRoomMember,
  useLeaveMyRoom,
  useLoadMyTask,
} from "@fllooat/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { BalloonSky } from "@/components/balloon-sky";
import { MemberDetailDialog } from "@/components/member-detail-dialog";
import { useApplyMyStatus } from "@/hooks/use-apply-my-status";
import { useDeviceShake } from "@/hooks/use-device-shake";
import { isRoomId } from "@/lib/room-id";

/** 気球の空と、開いている気球の詳細を取り直す間隔。 */
const POLLING_INTERVAL_MS = 3_000;

export const Route = createFileRoute("/_authed/rooms/$roomId")({
  beforeLoad: ({ params }) => {
    if (!isRoomId(params.roomId)) throw redirect({ to: "/join" });
  },
  component: RoomPage,
});

const addTaskErrorMessageOf = (error: unknown) => {
  if (isApiError(error, "WEIGHT_LIMIT_EXCEEDED")) {
    return `あと ${error.body.details?.remaining ?? 0}% までしかのせられません`;
  }
  if (isApiError(error, "VALIDATION_ERROR")) return "タスク名と重さを確かめてください";
  if (error) return "もう一度試してください";
  return undefined;
};

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const applyMyStatus = useApplyMyStatus(roomId);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>();

  const room = useGetRoom(roomId, { query: { refetchInterval: POLLING_INTERVAL_MS } });
  const myTasks = useGetMyTasks();
  const memberDetail = useGetRoomMember(roomId, selectedUserId ?? "", {
    query: { enabled: selectedUserId !== undefined, refetchInterval: POLLING_INTERVAL_MS },
  });

  // 自分のルームではない URL を開いたときや、ほかの端末でルームを移ったり抜けたりしたとき。
  // /join は、ルームに入っていればそのルームへ、入っていなければ入室の画面を出す。
  useEffect(() => {
    if (isApiError(room.error, "NOT_ROOM_MEMBER") || isApiError(room.error, "ROOM_NOT_FOUND")) {
      navigate({ to: "/join", replace: true });
    }
  }, [room.error, navigate]);

  const queryClient = useQueryClient();
  const leaveRoom = useLeaveMyRoom({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        navigate({ to: "/join" });
      },
    },
  });

  // 開いている詳細の人がルームを抜けたら閉じる。
  useEffect(() => {
    if (isApiError(memberDetail.error, "MEMBER_NOT_FOUND")) setSelectedUserId(undefined);
  }, [memberDetail.error]);

  const createPoolTask = useAddMyTask();
  const loadPoolTask = useLoadMyTask();
  const deletePoolTask = useDeleteMyTask();
  // TODO: プールの画面ができるまでは、作ったタスクをすぐに気球へ乗せる。乗せられなければプールから消す。
  const addTask = useMutation({
    mutationFn: async ({ title, weight }: { title: string; weight: number }) => {
      const created = await createPoolTask.mutateAsync({ data: { title, weight } });
      const taskId = created.data.pool[0]?.id ?? 0;
      try {
        return await loadPoolTask.mutateAsync({ taskId });
      } catch (error) {
        await deletePoolTask.mutateAsync({ taskId }).catch(() => {});
        throw error;
      }
    },
    onSuccess: ({ data }) => {
      applyMyStatus(data);
      setIsAddTaskOpen(false);
    },
    // 上限を超えたときは、スライダーの上限を今の残りに合わせる。
    onError: (error) => {
      if (isApiError(error, "WEIGHT_LIMIT_EXCEEDED")) myTasks.refetch();
    },
  });
  const dropTasks = useDropMyTasks({ mutation: { onSuccess: ({ data }) => applyMyStatus(data) } });
  // 呼び出し中にもう一度揺れても、二重には落とさない。
  const dropAllTasks = () => {
    if (!dropTasks.isPending) dropTasks.mutate();
  };
  const { permission, requestPermission } = useDeviceShake(dropAllTasks);

  const selectMember = (member: RoomMember) => setSelectedUserId(member.userId);
  const selectedMember = room.data?.data.members.find((m) => m.userId === selectedUserId);

  return (
    <section className="relative flex h-full flex-col bg-linear-to-b from-[#0050DC] via-[#2B95EE] to-[#B4E1F7]">
      <div className="min-h-0 flex-1">
        {room.data ? (
          <BalloonSky
            roomId={roomId}
            members={room.data.data.members}
            onSelectMember={selectMember}
            onShakeMyBalloon={dropAllTasks}
          />
        ) : (
          // TODO: 読み込み中とエラーの見た目はデザイナーと決める。
          <p className="pt-24 text-center text-sm text-white">
            {room.isError ? "ルームを読み込めませんでした" : "読み込み中…"}
          </p>
        )}
      </div>
      {/* TODO: ルームのメニューのデザインが届いたら、そこに移す。 */}
      <button
        type="button"
        disabled={leaveRoom.isPending}
        onClick={() => leaveRoom.mutate()}
        className="absolute top-3 right-3 rounded-full bg-white/30 px-3 py-1 text-xs text-white backdrop-blur disabled:opacity-50"
      >
        ルームを出る
      </button>
      {permission === "prompt" && (
        <button
          type="button"
          onClick={requestPermission}
          className="mx-auto mb-3 rounded-full bg-white/30 px-4 py-1.5 text-xs text-white backdrop-blur"
        >
          スマホを振ってタスクを落とせるようにする
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          addTask.reset();
          setIsAddTaskOpen(true);
        }}
        className="flex h-[125px] shrink-0 flex-col items-center justify-center gap-2 rounded-t-[50%_48px] bg-[#0057E0] pt-4 pb-[env(safe-area-inset-bottom)] text-white"
      >
        <PlusIcon className="size-11" strokeWidth={2.5} />
        <span className="text-sm font-bold">タスクをのせる</span>
      </button>
      <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        remaining={myTasks.data?.data.remaining ?? 0}
        isPending={addTask.isPending}
        errorMessage={addTaskErrorMessageOf(addTask.error)}
        onAdd={(title, weight) => addTask.mutate({ title, weight })}
      />
      <MemberDetailDialog
        open={selectedUserId !== undefined}
        member={memberDetail.data?.data}
        isMe={selectedMember?.isMe ?? false}
        onClose={() => setSelectedUserId(undefined)}
      />
    </section>
  );
}

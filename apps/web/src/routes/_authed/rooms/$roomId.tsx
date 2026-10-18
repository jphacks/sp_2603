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
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { BalloonSheet } from "@/components/balloon-sheet";
import { BalloonSky } from "@/components/balloon-sky";
import { RoomMenu } from "@/components/room-menu";
import { useApplyMyStatus } from "@/hooks/use-apply-my-status";
import { useDeviceShake } from "@/hooks/use-device-shake";
import { signOut } from "@/lib/auth-client";
import { assignBalloonColors } from "@/lib/balloon-colors";
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
  if (isApiError(error, "VALIDATION_ERROR")) return "タスク名と重さを確かめてください";
  if (isApiError(error, "RATE_LIMITED")) return "少し待ってからもう一度試してください";
  if (error) return "もう一度試してください";
  return undefined;
};

const loadTaskErrorMessageOf = (error: unknown) => {
  if (isApiError(error, "WEIGHT_LIMIT_EXCEEDED")) {
    return `あと ${error.body.details?.remaining ?? 0}% までしかのせられません`;
  }
  // ほかの端末で乗せたか消したときは、取り直したプールを見ればわかるので出さない。
  if (isApiError(error, "TASK_NOT_FOUND")) return undefined;
  if (error) return "もう一度試してください";
  return undefined;
};

/** 下から伸びるシートで見ている気球。自分なら編集画面、他人ならタスクを見るだけの画面になる。 */
type SheetTarget = { kind: "mine" } | { kind: "member"; userId: string };

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const applyMyStatus = useApplyMyStatus(roomId);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // 閉じる動きの間も中身を出しておくため、閉じても最後に開いた気球を覚えておく。
  const [sheetTarget, setSheetTarget] = useState<SheetTarget>({ kind: "mine" });
  const selectedUserId = sheetTarget.kind === "member" ? sheetTarget.userId : undefined;

  const room = useGetRoom(roomId, { query: { refetchInterval: POLLING_INTERVAL_MS } });
  const myTasks = useGetMyTasks();
  const memberDetail = useGetRoomMember(roomId, selectedUserId ?? "", {
    query: {
      enabled: isSheetOpen && selectedUserId !== undefined,
      refetchInterval: POLLING_INTERVAL_MS,
    },
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut(queryClient);
    await navigate({ to: "/login" });
  };

  // 見ている人がルームを抜けたら閉じる。
  useEffect(() => {
    if (isApiError(memberDetail.error, "MEMBER_NOT_FOUND")) setIsSheetOpen(false);
  }, [memberDetail.error]);

  const addTask = useAddMyTask({
    mutation: {
      onSuccess: ({ data }) => {
        applyMyStatus(data);
        setIsAddTaskOpen(false);
      },
    },
  });
  const loadTask = useLoadMyTask({
    mutation: {
      onSuccess: ({ data }) => applyMyStatus(data),
      // 上限を超えたときやほかの端末で変わったときは、今の状態を取り直す。
      onError: (error) => {
        if (isApiError(error, "WEIGHT_LIMIT_EXCEEDED") || isApiError(error, "TASK_NOT_FOUND")) {
          myTasks.refetch();
        }
      },
    },
  });
  const deleteTask = useDeleteMyTask({
    mutation: {
      onSuccess: ({ data }) => applyMyStatus(data),
      // ほかの端末で消したか落としたときは、今の状態を取り直す。
      onError: (error) => {
        if (isApiError(error, "TASK_NOT_FOUND")) myTasks.refetch();
      },
    },
  });
  const dropTasks = useDropMyTasks({ mutation: { onSuccess: ({ data }) => applyMyStatus(data) } });
  // 呼び出し中にもう一度揺れても、二重には落とさない。
  const dropAllTasks = () => {
    if (!dropTasks.isPending) dropTasks.mutate();
  };
  const { permission, requestPermission } = useDeviceShake(dropAllTasks);

  const members = room.data?.data.members;
  const colors = useMemo(
    () =>
      assignBalloonColors(
        roomId,
        (members ?? []).map((m) => m.userId),
      ),
    [roomId, members],
  );

  const openSheet = (target: SheetTarget) => {
    loadTask.reset();
    setSheetTarget(target);
    setIsSheetOpen(true);
  };
  const selectMember = (member: RoomMember) =>
    openSheet(member.isMe ? { kind: "mine" } : { kind: "member", userId: member.userId });
  const openAddTask = () => {
    addTask.reset();
    setIsAddTaskOpen(true);
  };

  const sheetMember = members?.find((m) =>
    sheetTarget.kind === "mine" ? m.isMe : m.userId === sheetTarget.userId,
  );
  const centerAction = !isSheetOpen ? "edit" : sheetTarget.kind === "mine" ? "addTask" : "close";
  const onCenterClick = {
    edit: () => openSheet({ kind: "mine" }),
    addTask: openAddTask,
    close: () => setIsSheetOpen(false),
  }[centerAction];

  return (
    <section className="relative flex h-full flex-col bg-linear-to-b from-[#0050DC] via-[#2B95EE] to-[#B4E1F7]">
      <div className="min-h-0 flex-1">
        {room.data ? (
          <BalloonSky
            members={room.data.data.members}
            colors={colors}
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
      {permission === "prompt" && (
        <button
          type="button"
          onClick={requestPermission}
          className="mx-auto mb-3 rounded-full bg-white/30 px-4 py-1.5 text-xs text-white backdrop-blur"
        >
          スマホを振ってタスクを落とせるようにする
        </button>
      )}
      {/* シート (z-40) を開いている間も、メニューはその上に出したままにする。 */}
      <RoomMenu
        className="relative z-50"
        centerAction={centerAction}
        isPending={leaveRoom.isPending || isSigningOut}
        onSignOut={handleSignOut}
        onCenterClick={onCenterClick}
        onSwitchRoom={() => leaveRoom.mutate()}
      />
      {sheetMember && (
        <BalloonSheet
          open={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          isMine={sheetTarget.kind === "mine"}
          name={sheetMember.name}
          image={sheetMember.image}
          color={colors.get(sheetMember.userId) ?? "#FFFFFF"}
          {...(sheetTarget.kind === "mine"
            ? {
                busy: myTasks.data?.data.busy ?? sheetMember.busy,
                tasks: myTasks.data?.data.tasks,
                deletingTaskId: deleteTask.isPending ? deleteTask.variables.taskId : undefined,
                onDeleteTask: (taskId: number) => deleteTask.mutate({ taskId }),
                pool: {
                  tasks: myTasks.data?.data.pool,
                  onLoad: (taskId: number) => loadTask.mutate({ taskId }),
                  loadingTaskId: loadTask.isPending ? loadTask.variables.taskId : undefined,
                  errorMessage: loadTaskErrorMessageOf(loadTask.error),
                },
              }
            : {
                busy: memberDetail.data?.data.busy ?? sheetMember.busy,
                tasks: memberDetail.data?.data.tasks,
              })}
        />
      )}
      <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        isPending={addTask.isPending}
        errorMessage={addTaskErrorMessageOf(addTask.error)}
        onAdd={(title, weight) => addTask.mutate({ data: { title, weight } })}
      />
    </section>
  );
}

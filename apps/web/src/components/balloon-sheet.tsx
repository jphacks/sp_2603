import type { PoolTask } from "@fllooat/api-client";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { BalloonFigure } from "@/components/balloon-figure";
import { type DropPoint, TaskPool } from "@/components/task-pool";

/** シートの中の気球の直径。空の画面の 2 倍。 */
const ENVELOPE_SIZE_PX = 96;
/** つまみをこれより下まで引くか、速く引き下ろしたら閉じる。 */
const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY = 500;
/** iOS のシートに近い、出だしが速く最後がゆっくりな動き。 */
const SLIDE = { duration: 0.45, ease: [0.32, 0.72, 0, 1] } as const;
/** 気球の絵からこれだけ外れて離しても、気球に乗せる。 */
const DROP_MARGIN_PX = 40;

type SheetTask = { id: number; title: string; weight: number };

type BalloonSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 自分の気球の編集画面なら true。後ろの空を暗くする。 */
  isMine: boolean;
  name: string;
  image: string | null;
  color: string;
  busy: number;
  /** 乗っているタスク。読み込み中は undefined。 */
  tasks: SheetTask[] | undefined;
  /** 渡すと、タスクの右に消す × ボタンを出す。自分の気球にだけ渡す。 */
  onDeleteTask?: (taskId: number) => void;
  /** 消している途中のタスク。その × ボタンは押せなくする。 */
  deletingTaskId?: number;
  /** 渡すと、プールのブロックを並べる。気球へドロップすると乗る。自分の気球にだけ渡す。 */
  pool?: PoolEditing;
};

type PoolEditing = {
  tasks: PoolTask[] | undefined;
  onLoad: (taskId: number) => void;
  loadingTaskId: number | undefined;
  /** 乗せられなかったときに、プールの上に出す文言。 */
  errorMessage: string | undefined;
};

/**
 * 画面の下から伸びて、1 人の気球と乗っているタスクを見せるシート。上のつまみを下に引くと閉じる。
 * 下のメニューをシートの上に重ねて押せるままにしたいので、ルームの画面の中に置き、モーダルにはしない。
 */
export function BalloonSheet({
  open,
  onClose,
  isMine,
  name,
  image,
  color,
  busy,
  tasks,
  onDeleteTask,
  deletingTaskId,
  pool,
}: BalloonSheetProps) {
  const titleId = useId();
  const balloonRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const dropOnBalloon = (taskId: number, point: DropPoint) => {
    const rect = balloonRef.current?.getBoundingClientRect();
    const isOverBalloon =
      rect !== undefined &&
      point.x >= rect.left - DROP_MARGIN_PX &&
      point.x <= rect.right + DROP_MARGIN_PX &&
      point.y >= rect.top - DROP_MARGIN_PX &&
      point.y <= rect.bottom + DROP_MARGIN_PX;
    if (isOverBalloon) pool?.onLoad(taskId);
    return isOverBalloon;
  };

  return (
    <AnimatePresence>
      {open && isMine && (
        <motion.div
          key="overlay"
          aria-hidden="true"
          className="absolute inset-0 z-30 bg-[#222]/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={SLIDE}
          onClick={onClose}
        />
      )}
      {open && (
        <motion.div
          key="sheet"
          role="dialog"
          aria-labelledby={titleId}
          // ホーム画面から開いたときは、シートの上端をダイナミックアイランドより下に置く。
          className="absolute inset-x-0 top-[max(58px,calc(env(safe-area-inset-top)+8px))] bottom-0 z-40 flex flex-col items-center rounded-t-[50%_46px] bg-[#0055DD] text-[#E6E6E6]"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={SLIDE}
          // ブロックのドラッグ&ドロップとぶつからないよう、つまみをつかんだときだけ動かす。
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 1 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY) onClose();
          }}
        >
          <div
            aria-hidden="true"
            className="shrink-0 cursor-grab touch-none px-6 pt-[29px] pb-3"
            onPointerDown={(event) => dragControls.start(event)}
          >
            <div className="h-[5.16px] w-20 rounded-[10px] bg-[#E6E6E6]" />
          </div>
          <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-4 pb-[calc(114px+env(safe-area-inset-bottom))]">
            <h2
              id={titleId}
              className="mt-8 w-full max-w-70 truncate text-center text-[21px] font-bold tracking-[-0.04em]"
            >
              {name}
            </h2>
            <p className="text-[13px]">{busy}%</p>
            <div ref={balloonRef} className="mt-[34px]">
              <BalloonFigure size={ENVELOPE_SIZE_PX} image={image} color={color} busy={busy} />
            </div>
            <TaskList tasks={tasks} onDelete={onDeleteTask} deletingTaskId={deletingTaskId} />
            {pool && (
              <>
                <p role="alert" className="mt-2 min-h-4 text-[13px] text-[#FDE047]">
                  {pool.errorMessage}
                </p>
                {pool.tasks && onDeleteTask && (
                  <div className="mt-[31px] flex w-full justify-center">
                    <TaskPool
                      pool={pool.tasks}
                      onDrop={dropOnBalloon}
                      onDelete={onDeleteTask}
                      loadingTaskId={pool.loadingTaskId}
                      deletingTaskId={deletingTaskId}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TaskList({
  tasks,
  onDelete,
  deletingTaskId,
}: {
  tasks: SheetTask[] | undefined;
  onDelete?: (taskId: number) => void;
  deletingTaskId?: number;
}) {
  // TODO: 読み込み中の見た目はデザイナーと決める。
  if (!tasks) return <p className="mt-3.5 text-[13px]">読み込み中…</p>;
  if (tasks.length === 0) {
    return <p className="mt-3.5 text-[13px]">のっているタスクはありません</p>;
  }
  return (
    <ul className="mt-3.5 flex w-full max-w-[282px] flex-col gap-[21px]">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-[17px] text-[13px]">
          <span className="flex h-[37px] w-[60px] shrink-0 items-center justify-center rounded-[14px] bg-[#0088FF]">
            {task.weight}%
          </span>
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
          {onDelete && (
            <button
              type="button"
              aria-label={`${task.title}を消す`}
              disabled={task.id === deletingTaskId}
              onClick={() => onDelete(task.id)}
              // 見た目は 16px のまま、押せる範囲を広げる。
              className="-m-3 shrink-0 p-3 disabled:opacity-50"
            >
              <XIcon className="size-4" absoluteStrokeWidth />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

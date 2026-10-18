import type { PoolTask } from "@fllooat/api-client";
import { XIcon } from "lucide-react";
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect } from "react";

const RETURN_SPRING = { type: "spring", stiffness: 400, damping: 32 } as const;

/** 画面上の点 (px)。ドラッグで離した位置。 */
export type DropPoint = { x: number; y: number };

type TaskPoolProps = {
  pool: PoolTask[];
  /** ブロックを離した位置が気球の上なら乗せて true を返す。false ならブロックは元の位置に戻る。 */
  onDrop: (taskId: number, point: DropPoint) => boolean;
  onDelete: (taskId: number) => void;
  /** 乗せている途中のブロック。離した位置に置いたままにする。 */
  loadingTaskId: number | undefined;
  /** 消している途中のブロック。その × ボタンは押せなくする。 */
  deletingTaskId: number | undefined;
};

/** まだ気球に乗せないタスクのブロックを並べる置き場。ブロックをつかんで気球へドロップすると乗る。 */
export function TaskPool({ pool, onDrop, onDelete, loadingTaskId, deletingTaskId }: TaskPoolProps) {
  return (
    <section
      aria-label="プール"
      className="w-full max-w-[336px] rounded-[10px] bg-[#CCE2F4] p-[17px] text-[13px]"
    >
      {pool.length === 0 ? (
        <p className="py-8 text-center text-[#0055DD]">タスク追加でブロックを作れます</p>
      ) : (
        <ul className="grid grid-cols-2 gap-5">
          {pool.map((task) => (
            <PoolBlock
              key={task.id}
              task={task}
              isLoading={task.id === loadingTaskId}
              isDeleting={task.id === deletingTaskId}
              onDrop={(point) => onDrop(task.id, point)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PoolBlock({
  task,
  isLoading,
  isDeleting,
  onDrop,
  onDelete,
}: {
  task: PoolTask;
  isLoading: boolean;
  isDeleting: boolean;
  onDrop: (point: DropPoint) => boolean;
  onDelete: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const returnToPool = () => {
    animate(x, 0, RETURN_SPRING);
    animate(y, 0, RETURN_SPRING);
  };

  // 乗せられなかった (409 など) ときは、気球の上からプールの元の位置に戻す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: isLoading が false に戻ったときだけ動かす
  useEffect(() => {
    if (!isLoading) returnToPool();
  }, [isLoading]);

  return (
    <motion.li
      // スクロールではなくドラッグにするため、ブロックの上ではタッチでスクロールさせない。
      className="relative h-[99px] cursor-grab touch-none rounded-[10px] bg-[#0088FF] px-5 pt-[17px] text-[#E6E6E6] active:cursor-grabbing"
      style={{ x, y, zIndex: isLoading ? 20 : undefined }}
      drag={!isLoading}
      dragMomentum={false}
      whileDrag={{ scale: 1.05, zIndex: 20 }}
      animate={{ opacity: isLoading ? 0.6 : 1 }}
      onDragEnd={(_, info) => {
        if (!onDrop(info.point)) returnToPool();
      }}
    >
      <p className="line-clamp-2 break-all">{task.title}</p>
      <div className="absolute inset-x-5 bottom-[17px] flex items-center justify-between">
        <span>{task.weight}%</span>
        <button
          type="button"
          aria-label={`${task.title}を消す`}
          disabled={isDeleting || isLoading}
          onClick={onDelete}
          // 見た目は 16px のまま、押せる範囲を広げる。
          className="-m-3 p-3 disabled:opacity-50"
        >
          <XIcon className="size-4" absoluteStrokeWidth />
        </button>
      </div>
    </motion.li>
  );
}

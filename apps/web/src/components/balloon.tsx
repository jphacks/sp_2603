import { motion } from "motion/react";
import { useMemo } from "react";
import { createShakeDetector, DRAG_SHAKE } from "@/lib/shake-detector";

type BalloonProps = {
  /** 渡すと、気球をドラッグして強く揺らしたときに呼ばれる。自分の気球にだけ渡す。 */
  onShake?: () => void;
};

// TODO: デザインが来たら見た目を差し替える。今は揺れの判定を試すための仮の気球。
export function Balloon({ onShake }: BalloonProps) {
  const feed = useMemo(() => onShake && createShakeDetector(DRAG_SHAKE, onShake), [onShake]);

  return (
    <motion.div
      className="size-40 cursor-grab touch-none active:cursor-grabbing"
      drag={feed ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDrag={(_, info) => feed?.(info.velocity.x)}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 100 120" className="size-full" aria-hidden="true">
        <ellipse cx="50" cy="45" rx="38" ry="42" className="fill-sky-400" />
        <path d="M30 80 L42 100 M70 80 L58 100" className="stroke-neutral-500" strokeWidth="2" />
        <rect x="40" y="100" width="20" height="14" rx="2" className="fill-amber-700" />
      </svg>
    </motion.div>
  );
}

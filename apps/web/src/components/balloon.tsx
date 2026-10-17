import { motion } from "motion/react";
import { useMemo } from "react";
import type { BalloonDistance } from "@/lib/balloon-distance";
import { createShakeDetector, DRAG_SHAKE } from "@/lib/shake-detector";

/** 気球の上端からアイコンの中心までの距離。高さの目盛りにアイコンの中心を合わせるのに使う。 */
export const BALLOON_ANCHOR_PX = 24;

// TODO: 遠近の大きさと濃さはデザイナーと決める。今は仮の値。
const DISTANCE_STYLES: Record<BalloonDistance, { scale: number; opacity: number }> = {
  0: { scale: 1, opacity: 1 },
  1: { scale: 0.85, opacity: 0.85 },
  2: { scale: 0.7, opacity: 0.65 },
  3: { scale: 0.55, opacity: 0.45 },
};

type BalloonProps = {
  name: string;
  image: string | null;
  color: string;
  distance: BalloonDistance;
  onTap: () => void;
  /** 渡すと、気球をドラッグして強く揺らしたときに呼ばれる。自分の気球にだけ渡す。 */
  onShake?: () => void;
};

export function Balloon({ name, image, color, distance, onTap, onShake }: BalloonProps) {
  const feed = useMemo(() => onShake && createShakeDetector(DRAG_SHAKE, onShake), [onShake]);

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ transformOrigin: `50% ${BALLOON_ANCHOR_PX}px` }}
      initial={false}
      animate={DISTANCE_STYLES[distance]}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <motion.button
          type="button"
          aria-label={`${name}の気球`}
          // embla はこの属性がある要素の上で始まったドラッグではスクロールしない。
          data-shakeable={feed ? "" : undefined}
          className="flex flex-col items-center outline-none"
          style={feed && { touchAction: "none" }}
          drag={feed ? "x" : false}
          dragSnapToOrigin
          dragElastic={0.6}
          onDrag={(_, info) => feed?.(info.velocity.x)}
          onTap={onTap}
        >
          <span
            className="block size-12 overflow-hidden rounded-full border-[3px]"
            style={{ borderColor: color, backgroundColor: color }}
          >
            {image && (
              <img src={image} alt="" className="size-full object-cover" draggable={false} />
            )}
          </span>
          <svg viewBox="0 0 30 10" className="-mt-0.5 h-2.5 w-[30px]" aria-hidden="true">
            <path d="M9 0 L3 10 M21 0 L27 10" className="stroke-white" strokeWidth="1.5" />
          </svg>
          <span className="block h-[18px] w-[30px] rounded-[3px] rounded-b-md bg-[#7A2E14]" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

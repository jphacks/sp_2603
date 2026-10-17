export type ShakeOptions = {
  /** これより弱い動きは揺れとして数えない。単位は渡す値に合わせる (m/s² や px/s)。 */
  threshold: number;
  /** 何回向きが入れ替わったら揺れとみなすか。 */
  swings: number;
  /** swings 回の揺れをこの時間 (ms) 以内に収める。 */
  windowMs: number;
};

/** スマホの加速度。強めに左右へ振ったときだけ反応する値にしている。 */
export const DEVICE_SHAKE: ShakeOptions = { threshold: 12, swings: 4, windowMs: 1000 };

/** 気球をドラッグしたときの速さ。軽く触れたりスクロールしかけたりしただけでは反応しない値にしている。 */
export const DRAG_SHAKE: ShakeOptions = { threshold: 600, swings: 4, windowMs: 1000 };

/**
 * 左右の動きの値 (加速度や速度の x) を受け取り、強い動きの向きが短い時間に何度も入れ替わったら onShake を呼ぶ。
 *
 * @example
 * const feed = createShakeDetector(DRAG_SHAKE, dropAllTasks);
 * <motion.div drag onDrag={(_, info) => feed(info.velocity.x)} />
 */
export function createShakeDetector(options: ShakeOptions, onShake: () => void) {
  let lastDirection = 0;
  let swingTimes: number[] = [];

  return (value: number, now = performance.now()) => {
    if (Math.abs(value) < options.threshold) return;
    swingTimes = swingTimes.filter((time) => now - time <= options.windowMs);
    // 時間内の揺れが残っていなければ、前の向きも忘れて新しい揺れの 1 回目として数える。
    if (swingTimes.length === 0) lastDirection = 0;
    const direction = Math.sign(value);
    if (direction === lastDirection) return;

    lastDirection = direction;
    swingTimes.push(now);
    if (swingTimes.length < options.swings) return;

    lastDirection = 0;
    swingTimes = [];
    onShake();
  };
}

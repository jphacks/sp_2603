/** 忙しさ 0% のときの籠の幅。風船の直径に対する比。 */
const MIN_WIDTH_RATIO = 0.4;
/** 籠の高さを幅に対する比で決める。デザインの籠 (58 x 32) に合わせた。 */
const HEIGHT_RATIO = 0.55;

/**
 * 忙しさ (0〜100) から籠の大きさ (px) を決める。100% で風船の直径と同じ幅になり、それより大きくはしない。
 *
 * @example
 * basketSize(80, 48); // { width: 42.24, height: 23.232 }
 */
export const basketSize = (busy: number, envelopeSize: number) => {
  const ratio = Math.min(Math.max(busy, 0), 100) / 100;
  const width = envelopeSize * (MIN_WIDTH_RATIO + (1 - MIN_WIDTH_RATIO) * ratio);
  return { width, height: width * HEIGHT_RATIO };
};

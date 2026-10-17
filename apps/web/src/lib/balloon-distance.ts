const HOUR_MS = 60 * 60 * 1000;

/** 最終更新からの経過時間の区切り。境目の時刻はその段階に含める (ちょうど 1 時間前は 0)。 */
const DISTANCE_LIMITS_MS = [1 * HOUR_MS, 3 * HOUR_MS, 12 * HOUR_MS];

/** 0 が一番近く (1 時間以内)、3 が一番遠い (12 時間より前)。 */
export type BalloonDistance = 0 | 1 | 2 | 3;

/**
 * 最終更新からの経過時間で、気球の遠近の段階を決める。端末の時計がずれていても狂わないよう、サーバーの時刻と比べる。
 *
 * @example
 * balloonDistance(room.serverTime, member.statusUpdatedAt); // 0
 */
export function balloonDistance(serverTime: string, statusUpdatedAt: string): BalloonDistance {
  const elapsed = Date.parse(serverTime) - Date.parse(statusUpdatedAt);
  const level = DISTANCE_LIMITS_MS.findIndex((limit) => elapsed <= limit);
  return (level === -1 ? DISTANCE_LIMITS_MS.length : level) as BalloonDistance;
}

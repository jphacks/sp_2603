import {
  getGetMyHistoryQueryKey,
  getGetMyTasksQueryKey,
  getGetRoomQueryKey,
  type getMyTasksResponseSuccess,
  type getRoomResponseSuccess,
  type MyStatus,
} from "@fllooat/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * タスクを乗せる、落とす、乗せ直す API が返した自分の状態を、キャッシュに反映する関数を返す。
 *
 * ルームの取り直しを待たずに自分の気球を新しい高さへ動かす (揺らした直後に浮くのがデモの見せ場なので)。
 * そのうえで、ルームと履歴は取り直す。
 */
export function useApplyMyStatus(roomId: string) {
  const queryClient = useQueryClient();

  return useCallback(
    (status: MyStatus) => {
      queryClient.setQueryData<getMyTasksResponseSuccess>(
        getGetMyTasksQueryKey(),
        (old) => old && { ...old, data: status },
      );
      queryClient.setQueryData<getRoomResponseSuccess>(
        getGetRoomQueryKey(roomId),
        (old) =>
          old && {
            ...old,
            data: {
              ...old.data,
              members: old.data.members.map((member) =>
                member.isMe
                  ? { ...member, busy: status.busy, statusUpdatedAt: status.statusUpdatedAt }
                  : member,
              ),
            },
          },
      );
      queryClient.invalidateQueries({ queryKey: getGetRoomQueryKey(roomId) });
      queryClient.invalidateQueries({ queryKey: getGetMyHistoryQueryKey() });
    },
    [queryClient, roomId],
  );
}

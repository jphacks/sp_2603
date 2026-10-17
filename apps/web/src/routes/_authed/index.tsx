import { getGetMeQueryOptions } from "@fllooat/api-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

// 表示はなく、ルームに入っている人はそのルームへ、入っていない人は /join へ送る。
export const Route = createFileRoute("/_authed/")({
  beforeLoad: async ({ context }) => {
    const { data: me } = await context.queryClient.fetchQuery(getGetMeQueryOptions());
    if (me.roomId) throw redirect({ to: "/rooms/$roomId", params: { roomId: me.roomId } });
    throw redirect({ to: "/join" });
  },
});

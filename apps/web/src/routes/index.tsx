import { getGetMeQueryOptions } from "@fllooat/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions, signOut } from "@/lib/auth-client";

// 表示はなく、ログインしていない人は /login へ、ルームに入っている人はそのルームへ、入っていない人は /join へ送る。
export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    let destination: Awaited<ReturnType<typeof destinationOf>>;
    try {
      destination = await destinationOf(context.queryClient);
    } catch {
      // セッションや自分の情報が取れないときは、壊れた状態を引きずらないようログアウトしてからやり直してもらう。
      await signOut(context.queryClient).catch(() => {});
      destination = redirect({ to: "/login" });
    }
    throw destination;
  },
});

const destinationOf = async (queryClient: QueryClient) => {
  const session = await queryClient.fetchQuery(sessionQueryOptions);
  if (!session) return redirect({ to: "/login" });
  const { data: me } = await queryClient.fetchQuery(getGetMeQueryOptions());
  if (me.roomId) return redirect({ to: "/rooms/$roomId", params: { roomId: me.roomId } });
  return redirect({ to: "/join" });
};

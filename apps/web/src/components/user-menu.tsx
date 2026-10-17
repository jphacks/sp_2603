import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { authClient, sessionQueryOptions } from "@/lib/auth-client";

export function UserMenu() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session, isPending } = useQuery(sessionQueryOptions);

  const signOut = async () => {
    await authClient.signOut();
    // 前のユーザーのデータを残さないよう、キャッシュを丸ごと消す。
    queryClient.clear();
    await navigate({ to: "/" });
  };

  if (isPending) return null;
  if (!session) {
    return (
      <Link to="/login" className="rounded border px-3 py-1 text-sm">
        ログイン
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {session.user.image && (
        <img src={session.user.image} alt="" className="size-8 rounded-full" />
      )}
      <span className="text-sm">{session.user.name}</span>
      <button type="button" className="text-sm underline" onClick={signOut}>
        ログアウト
      </button>
    </div>
  );
}

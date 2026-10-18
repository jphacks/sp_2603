import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

// 気球の空を画面いっぱいに描くので、共通のヘッダーや幅の制限は置かない。
// ホーム画面から開いた iPhone では h-dvh がステータスバーの分だけ短くなり、下に白い帯が出るので、fixed で画面に合わせる。
function RootLayout() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <Outlet />
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}

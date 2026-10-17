import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { UserMenu } from "@/components/user-menu";

type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-semibold">
            sp-2603
          </Link>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}

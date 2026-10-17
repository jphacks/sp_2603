import { ApiError, isApiError } from "@fllooat/api-client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { sessionQueryOptions } from "@/lib/auth-client";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// セッションが切れたときは、どの API で起きてもログイン画面に送り、ログイン後に今の画面へ戻す。
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!isApiError(error, "UNAUTHORIZED")) return;
  queryClient.removeQueries({ queryKey: sessionQueryOptions.queryKey });
  router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx は取り直しても結果が変わらないので、すぐ画面に返して /join への移動などを遅らせない。
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
  queryCache: new QueryCache({ onError: redirectToLoginIfUnauthorized }),
  mutationCache: new MutationCache({ onError: redirectToLoginIfUnauthorized }),
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // キャッシュは TanStack Query に任せるので、loader 側ではキャッシュしない。
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function enableMocking() {
  if (import.meta.env.MODE !== "mock") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass" });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
});

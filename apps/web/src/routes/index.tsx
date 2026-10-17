import { useGetHealthz } from "@fllooat/api-client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const healthz = useGetHealthz();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Fllooat</h1>
      <p>
        API:{" "}
        {healthz.isPending ? "確認中..." : healthz.isError ? "応答なし" : healthz.data.data.status}
      </p>
    </section>
  );
}

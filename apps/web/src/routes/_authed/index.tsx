import { createFileRoute, redirect } from "@tanstack/react-router";

// TODO: GET /api/me ができたら、ルームに入っている人は /rooms/$roomId に送る。
export const Route = createFileRoute("/_authed/")({
  beforeLoad: () => {
    throw redirect({ to: "/join" });
  },
});

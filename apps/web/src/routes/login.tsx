import { createFileRoute, redirect } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { SiGithub } from "react-icons/si";
import skyTexture from "@/assets/sky-texture.webp";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  authClient,
  type SocialProvider,
  sessionQueryOptions,
  toSafeRedirect,
} from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  validateSearch: (search): { redirect?: string } =>
    search.redirect === undefined ? {} : { redirect: toSafeRedirect(search.redirect) },
  // ログイン済みならこの画面は要らないので、戻り先へそのまま進める。
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions).catch(() => null);
    if (session) throw redirect({ href: search.redirect ?? "/" });
  },
  component: LoginPage,
});

const providers: { id: SocialProvider; label: string; icon: ReactNode }[] = [
  {
    id: "google",
    label: "Google でログイン",
    icon: (
      <span className="flex size-6.5 items-center justify-center rounded-full border border-[#747775] bg-white">
        <FcGoogle className="size-4" />
      </span>
    ),
  },
  { id: "github", label: "GitHub でログイン", icon: <SiGithub className="size-6.5 text-white" /> },
];

function LoginPage() {
  const { redirect = "/" } = Route.useSearch();
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初回ログイン時はアカウントが自動で作成される。
  const signIn = async (provider: SocialProvider) => {
    setPendingProvider(provider);
    setErrorMessage(null);
    const { error } = await authClient.signIn.social({ provider, callbackURL: redirect });
    if (error) {
      setErrorMessage(error.message ?? "ログインに失敗しました");
      setPendingProvider(null);
    }
  };

  return (
    <main className="relative isolate flex h-full flex-col items-center overflow-hidden bg-[linear-gradient(180deg,#0055dd_0%,#2384f3_39.4%,#45aeef_72.6%,#cce2f4_100%)] px-4 pb-22.5">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-cover bg-[64%_center] opacity-75 mix-blend-soft-light"
        style={{ backgroundImage: `url(${skyTexture})` }}
      />
      <h1 className="mt-[28dvh] flex w-full justify-center">
        <Logo />
      </h1>
      <div className="mt-auto flex w-full max-w-[280px] flex-col gap-6">
        {providers.map(({ id, label, icon }) => (
          <Button
            key={id}
            className="h-15 gap-[13px] rounded-full bg-[#0055dd] px-10 text-[21px] font-normal tracking-[-0.04em] text-[#e6e6e6] drop-shadow-[0_0_2px_rgba(0,0,0,0.5)] hover:bg-[#0055dd]/90"
            disabled={pendingProvider !== null}
            onClick={() => signIn(id)}
          >
            {icon}
            {label}
          </Button>
        ))}
        {errorMessage && (
          <p role="alert" className="text-center text-sm text-white">
            {errorMessage}
          </p>
        )}
      </div>
    </main>
  );
}

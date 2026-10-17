import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, type SocialProvider, toSafeRedirect } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  validateSearch: (search): { redirect?: string } =>
    search.redirect === undefined ? {} : { redirect: toSafeRedirect(search.redirect) },
  component: LoginPage,
});

const providers: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google でログイン" },
  { id: "github", label: "GitHub でログイン" },
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
    <section className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">ログイン</h1>
      {providers.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="w-full rounded border px-4 py-2 disabled:opacity-50"
          disabled={pendingProvider !== null}
          onClick={() => signIn(id)}
        >
          {label}
        </button>
      ))}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </section>
  );
}

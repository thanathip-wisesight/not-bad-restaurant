import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff login · Not Bad Restaurant" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  // Only return to console pages, never to another site (no open redirect).
  const target = typeof next === "string" && next.startsWith("/console") ? next : "/console";
  return <LoginForm next={target} />;
}

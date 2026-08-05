import { LoginCard } from "@/components/login-card";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getAuthenticatedSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (session) redirect("/sistema");

  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col">
      <PublicHeader />
      <LoginCard error={error} />
      <PublicFooter />
    </main>
  );
}

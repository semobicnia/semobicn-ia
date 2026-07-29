import { LoginCard } from "@/components/login-card";
import { getAuthenticatedSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (session) redirect("/");

  const { error } = await searchParams;
  return <LoginCard error={error} />;
}

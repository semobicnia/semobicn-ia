import { Workspace } from "@/components/workspace";
import { getAuthenticatedSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getAuthenticatedSession();
  if (!session) redirect("/entrar");

  return (
    <Workspace
      currentUser={{
        name: session.user.name || "Servidor autorizado",
        email: session.user.email || "",
        role: session.user.role || "operator",
      }}
    />
  );
}

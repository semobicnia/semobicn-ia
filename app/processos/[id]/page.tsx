import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { getAuthenticatedSession } from "@/lib/auth";
import { getProcessDetail, getUrbanSketch } from "@/lib/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) redirect("/entrar");
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const process = await getProcessDetail({
    processId: id,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!process) notFound();
  const sketch = await getUrbanSketch(process.id);
  if (!sketch || sketch.status !== "finalized") {
    redirect(`/croquis/novo?processo=${process.id}`);
  }

  return (
    <Workspace
      currentUser={{
        name: session.user.name || "Servidor autorizado",
        email: session.user.email || "",
        role: session.user.role,
      }}
      initialProcess={{
        id: process.id,
        status: process.status,
        data: process.data,
        sourceAvailable: process.sourceAvailable,
        events: process.events,
      }}
    />
  );
}

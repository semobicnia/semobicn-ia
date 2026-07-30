import { notFound, redirect } from "next/navigation";
import { CroquiWorkspace } from "@/components/croqui-workspace";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  getDefaultMunicipalSecretary,
  getProcessDetail,
  getUrbanSketch,
} from "@/lib/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function UrbanSketchPage({
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

  const [sketch, municipalSecretary] = await Promise.all([
    getUrbanSketch(process.id),
    getDefaultMunicipalSecretary(),
  ]);

  return (
    <CroquiWorkspace
      currentUser={{
        name: session.user.name || "Servidor autorizado",
        email: session.user.email || "",
        role: session.user.role,
      }}
      processId={process.id}
      data={process.data}
      municipalSecretary={municipalSecretary}
      initialSettings={sketch?.settings}
      initialLocationImageUrl={
        sketch?.locationImageAvailable
          ? `/api/croquis/image?processo=${process.id}`
          : undefined
      }
    />
  );
}

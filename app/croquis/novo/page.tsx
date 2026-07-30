import { redirect } from "next/navigation";
import { CroquiWorkspace } from "@/components/croqui-workspace";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDefaultMunicipalSecretary } from "@/lib/database";
import { sampleTopographicData } from "@/lib/topographic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export default async function NewUrbanSketchPage({
  searchParams,
}: {
  searchParams: Promise<{ processo?: string; demonstracao?: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) redirect("/entrar");
  const { processo, demonstracao } = await searchParams;
  if (processo && uuidPattern.test(processo)) {
    redirect(`/croquis/${processo}`);
  }
  const municipalSecretary = await getDefaultMunicipalSecretary();
  if (demonstracao === "1") {
    return (
      <CroquiWorkspace
        currentUser={{
          name: session.user.name || "Servidor autorizado",
          email: session.user.email || "",
          role: session.user.role,
        }}
        data={sampleTopographicData}
        municipalSecretary={municipalSecretary}
      />
    );
  }
  redirect("/croquis");
}

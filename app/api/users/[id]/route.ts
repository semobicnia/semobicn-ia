import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { updateManagedUser, type UserRole } from "@/lib/users";
import type { SexCode, StaffRole } from "@/lib/topographic";

const roles = new Set<UserRole>(["admin", "operator", "reviewer"]);
const professionalRoles = new Set<StaffRole>([
  "technical_responsible",
  "works_inspector",
]);
const sexCodes = new Set<SexCode>(["female", "male", "not_informed"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      fullName?: string;
      role?: UserRole;
      active?: boolean;
      professionalRole?: StaffRole | null;
      sex?: SexCode;
      registration?: string;
    };
    if (
      !body.role ||
      !roles.has(body.role) ||
      typeof body.active !== "boolean" ||
      (body.professionalRole &&
        !professionalRoles.has(body.professionalRole)) ||
      !body.sex ||
      !sexCodes.has(body.sex)
    ) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const user = await updateManagedUser({
      id,
      currentUserId: session.user.id,
      fullName: body.fullName || "",
      role: body.role,
      active: body.active,
      professionalRole: body.professionalRole || null,
      sex: body.sex,
      registration: body.registration || "",
    });
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message === "CANNOT_CHANGE_SELF_ACCESS"
        ? "Você não pode remover o próprio acesso administrativo."
        : error instanceof Error &&
            error.message === "INVALID_PROFESSIONAL_DATA"
          ? "Informe o sexo e a matrícula ou registro profissional."
          : "Não foi possível atualizar este usuário.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { updateManagedUser, type UserRole } from "@/lib/users";

const roles = new Set<UserRole>(["admin", "operator", "reviewer"]);

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
    };
    if (
      !body.role ||
      !roles.has(body.role) ||
      typeof body.active !== "boolean"
    ) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const user = await updateManagedUser({
      id,
      currentUserId: session.user.id,
      fullName: body.fullName || "",
      role: body.role,
      active: body.active,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message === "CANNOT_CHANGE_SELF_ACCESS"
        ? "Você não pode remover o próprio acesso administrativo."
        : "Não foi possível atualizar este usuário.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  createManagedUser,
  listManagedUsers,
  type UserRole,
} from "@/lib/users";
import type { SexCode, StaffRole } from "@/lib/topographic";

const roles = new Set<UserRole>(["admin", "operator", "reviewer"]);
const professionalRoles = new Set<StaffRole>([
  "technical_responsible",
  "works_inspector",
]);
const sexCodes = new Set<SexCode>(["female", "male", "not_informed"]);

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  return NextResponse.json({ users: await listManagedUsers() });
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
      role?: UserRole;
      professionalRole?: StaffRole | null;
      sex?: SexCode;
      registration?: string;
    };
    if (!body.role || !roles.has(body.role)) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    }
    if (
      (body.professionalRole &&
        !professionalRoles.has(body.professionalRole)) ||
      !body.sex ||
      !sexCodes.has(body.sex)
    ) {
      return NextResponse.json({ error: "Cargo funcional inválido." }, { status: 400 });
    }
    const user = await createManagedUser({
      email: body.email || "",
      fullName: body.fullName || "",
      role: body.role,
      professionalRole: body.professionalRole || null,
      sex: body.sex,
      registration: body.registration || "",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "EMAIL_EXISTS"
        ? "Este e-mail já está cadastrado."
        : error instanceof Error &&
            error.message === "INVALID_PROFESSIONAL_DATA"
          ? "Informe o sexo e a matrícula ou registro profissional."
          : "Confira os dados informados.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

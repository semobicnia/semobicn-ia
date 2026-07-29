import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  createManagedUser,
  listManagedUsers,
  type UserRole,
} from "@/lib/users";

const roles = new Set<UserRole>(["admin", "operator", "reviewer"]);

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
    };
    if (!body.role || !roles.has(body.role)) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    }
    const user = await createManagedUser({
      email: body.email || "",
      fullName: body.fullName || "",
      role: body.role,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "EMAIL_EXISTS"
        ? "Este e-mail já está cadastrado."
        : "Confira o nome e o e-mail informados.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

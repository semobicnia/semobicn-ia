import { NextResponse } from "next/server";
import { createAccessRequest } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      registration?: string;
    };
    await createAccessRequest({
      fullName: body.fullName || "",
      email: body.email || "",
      phone: body.phone || "",
      jobTitle: body.jobTitle || "",
      registration: body.registration || "",
    });
    return NextResponse.json({ submitted: true }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message =
      code === "ALREADY_AUTHORIZED"
        ? "Esta conta já possui acesso. Use a página de login."
        : code === "DATABASE_UNAVAILABLE"
          ? "O cadastro está temporariamente indisponível. Tente novamente mais tarde."
          : "Confira os dados. Informe uma conta @gmail.com e um telefone válido.";
    return NextResponse.json(
      { error: message },
      { status: code === "ALREADY_AUTHORIZED" ? 409 : 400 },
    );
  }
}

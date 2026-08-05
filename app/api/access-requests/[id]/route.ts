import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { reviewAccessRequest } from "@/lib/users";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const body = (await request.json()) as { action?: "approve" | "reject" };
    if (!uuidPattern.test(id) || !body.action || !["approve", "reject"].includes(body.action)) {
      return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
    }
    await reviewAccessRequest({
      id,
      reviewerId: session.user.id,
      action: body.action,
    });
    return NextResponse.json({ reviewed: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar a solicitação." },
      { status: 400 },
    );
  }
}

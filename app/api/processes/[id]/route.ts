import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  deleteProcess,
  getProcessDetail,
  updateProcess,
  type ProcessStatus,
} from "@/lib/database";
import {
  isTopographicData,
  normalizeTopographicData,
} from "@/lib/topographic";

const statuses = new Set<ProcessStatus>([
  "review",
  "approved",
  "completed",
  "cancelled",
  "archived",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
  }
  const process = await getProcessDetail({
    processId: id,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!process) {
    return NextResponse.json(
      { error: "Processo não encontrado ou acesso não autorizado." },
      { status: 404 },
    );
  }
  return NextResponse.json({ process });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Somente administradores podem excluir croquis." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
  }

  const deleted = await deleteProcess({
    processId: id,
    userId: session.user.id,
  });
  if (!deleted) {
    return NextResponse.json(
      { error: "Croqui não encontrado ou já excluído." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    data?: unknown;
    status?: ProcessStatus;
  };
  if (
    !uuidPattern.test(id) ||
    !body.status ||
    !statuses.has(body.status) ||
    !isTopographicData(body.data)
  ) {
    return NextResponse.json(
      { error: "Dados do processo inválidos." },
      { status: 400 },
    );
  }
  if (
    session.user.role === "operator" &&
    !["review", "completed"].includes(body.status)
  ) {
    return NextResponse.json(
      { error: "Seu perfil não pode aplicar esta situação." },
      { status: 403 },
    );
  }
  const updated = await updateProcess({
    processId: id,
    userId: session.user.id,
    role: session.user.role,
    data: normalizeTopographicData(body.data),
    status: body.status,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Processo não encontrado ou acesso não autorizado." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { listProcesses } from "@/lib/database";

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 },
    );
  }

  const search = new URL(request.url).searchParams.get("busca") || "";
  const processes = await listProcesses({
    userId: session.user.id,
    role: session.user.role,
    search,
  });
  return NextResponse.json({ processes });
}

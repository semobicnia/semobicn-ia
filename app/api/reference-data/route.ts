import { NextResponse } from "next/server";
import { getReferenceData } from "@/lib/database";
import { getAuthenticatedSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const referenceData = await getReferenceData();
    return NextResponse.json(referenceData, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Falha ao carregar os dados de referência:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar as opções de cadastro." },
      { status: 500 },
    );
  }
}

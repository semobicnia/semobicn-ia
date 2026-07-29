import { NextResponse } from "next/server";
import { getReferenceData } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

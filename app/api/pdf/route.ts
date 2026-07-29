import { NextResponse } from "next/server";
import { createTopographicPdf } from "@/lib/pdf-document";
import {
  isTopographicData,
  normalizeTopographicData,
} from "@/lib/topographic";
import { getAuthenticatedSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json();
    if (!isTopographicData(body)) {
      return NextResponse.json(
        { error: "Os dados do documento estão incompletos." },
        { status: 400 },
      );
    }

    const data = normalizeTopographicData(body);
    const bytes = await createTopographicPdf(data);
    const safeName =
      data.claimantName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "imovel";

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="informacoes-topograficas-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Falha ao gerar o PDF de informações topográficas:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o PDF." },
      { status: 500 },
    );
  }
}

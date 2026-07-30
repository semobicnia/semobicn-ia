import { NextResponse } from "next/server";
import { createTopographicPdf } from "@/lib/pdf-document";
import {
  isTopographicData,
  normalizeTopographicData,
} from "@/lib/topographic";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  getProcessDetail,
  getUrbanSketch,
  markProcessCompleted,
} from "@/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session || !session.user.role) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json();
    const payload =
      body && typeof body === "object" && "data" in body
        ? (body as { data: unknown; processId?: unknown })
        : { data: body, processId: undefined };
    if (!isTopographicData(payload.data)) {
      return NextResponse.json(
        { error: "Os dados do documento estão incompletos." },
        { status: 400 },
      );
    }
    if (
      typeof payload.processId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.processId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Conclua o croqui antes de gerar as Informações Topográficas.",
        },
        { status: 409 },
      );
    }
    const [process, sketch] = await Promise.all([
      getProcessDetail({
        processId: payload.processId,
        userId: session.user.id,
        role: session.user.role,
      }),
      getUrbanSketch(payload.processId),
    ]);
    if (!process) {
      return NextResponse.json(
        { error: "Processo não encontrado ou acesso não autorizado." },
        { status: 404 },
      );
    }
    if (!sketch || sketch.status !== "finalized") {
      return NextResponse.json(
        {
          error:
            "Conclua o croqui antes de gerar as Informações Topográficas.",
        },
        { status: 409 },
      );
    }

    const data = normalizeTopographicData(payload.data);
    const bytes = await createTopographicPdf(data);
    await markProcessCompleted(payload.processId, session.user.id).catch(
      () => undefined,
    );
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

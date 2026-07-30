import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { getSignedPrivateSourceUrl } from "@/lib/cloudinary";
import { getProcessSource } from "@/lib/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

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
  const source = await getProcessSource({
    processId: id,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!source) {
    return NextResponse.json(
      { error: "Croqui não encontrado ou acesso não autorizado." },
      { status: 404 },
    );
  }
  const signedUrl = getSignedPrivateSourceUrl(source.publicId);
  if (!signedUrl) {
    return NextResponse.json(
      { error: "O armazenamento do croqui não está configurado." },
      { status: 503 },
    );
  }
  const response = await fetch(signedUrl, { cache: "no-store" });
  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: "Não foi possível abrir o croqui original." },
      { status: 502 },
    );
  }
  const safeName =
    source.claimantName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "imovel";
  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const extension =
    contentType.includes("pdf")
      ? "pdf"
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("jpeg")
            ? "jpg"
            : "bin";
  return new Response(response.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="croqui-${safeName}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

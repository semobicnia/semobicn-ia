import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  getUrbanSketchImage,
  saveUrbanSketchImage,
} from "@/lib/database";
import {
  getSignedPrivateImageUrl,
  storePrivateImage,
} from "@/lib/cloudinary";

export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maximumSize = 10 * 1024 * 1024;

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const processId = new URL(request.url).searchParams.get("processo");
  if (!processId || !uuidPattern.test(processId)) {
    return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
  }

  const stored = await getUrbanSketchImage({
    processId,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!stored) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  const signedUrl = getSignedPrivateImageUrl(stored.publicId, stored.format);
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Armazenamento de imagens não configurado." },
      { status: 503 },
    );
  }

  const response = await fetch(signedUrl, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Não foi possível carregar a imagem." },
      { status: 502 },
    );
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const processId = form.get("processId");
    const file = form.get("file");
    if (
      typeof processId !== "string" ||
      !uuidPattern.test(processId) ||
      !(file instanceof File) ||
      !allowedTypes.has(file.type) ||
      file.size <= 0 ||
      file.size > maximumSize
    ) {
      return NextResponse.json(
        { error: "Selecione uma imagem PNG, JPEG ou WebP de até 10 MB." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storePrivateImage(file, bytes);
    if (!stored) {
      return NextResponse.json(
        { error: "Cloudinary não configurado." },
        { status: 503 },
      );
    }

    const saved = await saveUrbanSketchImage({
      processId,
      userId: session.user.id,
      role: session.user.role,
      publicId: stored.publicId,
      format: stored.format,
    });
    if (!saved) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Falha ao armazenar imagem do croqui:", error);
    return NextResponse.json(
      { error: "Não foi possível armazenar a imagem." },
      { status: 500 },
    );
  }
}

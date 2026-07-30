import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  createPrivateSourceUploadSignature,
  createPrivateTestUploadSignature,
} from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    filename?: unknown;
    purpose?: unknown;
  } | null;
  const filename = String(body?.filename ?? "").slice(0, 255);
  if (!filename) {
    return NextResponse.json(
      { error: "Informe o nome do arquivo que será enviado." },
      { status: 400 },
    );
  }

  const testOnly = body?.purpose === "test";
  if (testOnly && session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem preparar arquivos de teste." },
      { status: 403 },
    );
  }
  const upload = testOnly
    ? createPrivateTestUploadSignature(filename)
    : createPrivateSourceUploadSignature(filename);
  if (!upload) {
    return NextResponse.json(
      { error: "O armazenamento de arquivos ainda não foi configurado." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ...upload,
    maxSizeBytes: 10_485_760,
  });
}

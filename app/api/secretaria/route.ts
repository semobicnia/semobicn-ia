import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  deletePrivateImage,
  storeInstitutionalLogo,
} from "@/lib/cloudinary";
import {
  getSecretariatSettings,
  saveSecretariatSettings,
} from "@/lib/secretariat";
import {
  institutionalLogoSchema,
  secretariatFormSchema,
} from "@/lib/secretariat-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const settings = await getSecretariatSettings();
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Somente administradores podem alterar os dados da Secretaria." },
      { status: 403 },
    );
  }

  let uploadedPublicId = "";
  try {
    const form = await request.formData();
    const parsed = secretariatFormSchema.safeParse({
      name: field(form, "name"),
      acronym: field(form, "acronym").toUpperCase(),
      secretaryName: field(form, "secretaryName"),
      email: field(form, "email").toLowerCase(),
      phone: field(form, "phone"),
      fullAddress: field(form, "fullAddress"),
      cityHallName: field(form, "cityHallName"),
      cnpj: field(form, "cnpj"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Revise os campos destacados antes de salvar.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const logo = form.get("logo");
    let storedLogo: Awaited<ReturnType<typeof storeInstitutionalLogo>> = null;
    if (logo instanceof File && logo.size > 0) {
      const parsedLogo = institutionalLogoSchema.safeParse(logo);
      if (!parsedLogo.success) {
        return NextResponse.json(
          {
            error: "Revise o arquivo da logo antes de salvar.",
            fieldErrors: { logo: parsedLogo.error.issues.map((issue) => issue.message) },
          },
          { status: 400 },
        );
      }
      storedLogo = await storeInstitutionalLogo(
        logo,
        new Uint8Array(await logo.arrayBuffer()),
      );
      if (!storedLogo) {
        throw new Error("O armazenamento de imagens não está configurado.");
      }
      uploadedPublicId = storedLogo.publicId;
    }

    const previous = await saveSecretariatSettings({
      ...input,
      logoPublicId: storedLogo?.publicId,
      logoFormat: storedLogo?.format,
    });
    if (
      storedLogo &&
      previous.previousLogoPublicId &&
      previous.previousLogoPublicId !== storedLogo.publicId
    ) {
      await deletePrivateImage(previous.previousLogoPublicId);
    }

    return NextResponse.json({
      message: "Dados da Secretaria atualizados com sucesso.",
      settings: await getSecretariatSettings(),
    });
  } catch (error) {
    if (uploadedPublicId) await deletePrivateImage(uploadedPublicId);
    console.error("Falha ao atualizar os dados da Secretaria:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar os dados da Secretaria.",
      },
      { status: 500 },
    );
  }
}

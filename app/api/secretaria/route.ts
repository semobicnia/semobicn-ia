import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  deletePrivateImage,
  storeInstitutionalLogo,
} from "@/lib/cloudinary";
import {
  getSecretariatSettings,
  saveSecretariatSettings,
  type SecretariatSettingsInput,
} from "@/lib/secretariat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculateDigit = (length: number) => {
    const numbers = digits.slice(0, length).split("").map(Number);
    let weight = length - 7;
    const sum = numbers.reduce((total, number) => {
      const result = total + number * weight;
      weight -= 1;
      if (weight === 1) weight = 9;
      return result;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculateDigit(12) === Number(digits[12]) &&
    calculateDigit(13) === Number(digits[13])
  );
}

function validate(input: SecretariatSettingsInput) {
  const phoneDigits = input.phone.replace(/\D/g, "");
  return (
    input.name.length >= 5 &&
    input.name.length <= 160 &&
    /^[\p{L}\d.-]{2,20}$/u.test(input.acronym) &&
    input.secretaryName.length >= 5 &&
    input.secretaryName.length <= 140 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) &&
    input.email.length <= 160 &&
    phoneDigits.length >= 10 &&
    phoneDigits.length <= 11 &&
    input.phone.length <= 25 &&
    input.fullAddress.length >= 8 &&
    input.fullAddress.length <= 260 &&
    input.cityHallName.length >= 5 &&
    input.cityHallName.length <= 160 &&
    validCnpj(input.cnpj)
  );
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
    const input: SecretariatSettingsInput = {
      name: field(form, "name"),
      acronym: field(form, "acronym").toUpperCase(),
      secretaryName: field(form, "secretaryName"),
      email: field(form, "email").toLowerCase(),
      phone: field(form, "phone"),
      fullAddress: field(form, "fullAddress"),
      cityHallName: field(form, "cityHallName"),
      cnpj: field(form, "cnpj"),
    };
    if (!validate(input)) {
      return NextResponse.json(
        { error: "Revise os campos. Informe e-mail, telefone e CNPJ válidos." },
        { status: 400 },
      );
    }

    const logo = form.get("logo");
    let storedLogo: Awaited<ReturnType<typeof storeInstitutionalLogo>> = null;
    if (logo instanceof File && logo.size > 0) {
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      if (!allowedTypes.has(logo.type) || logo.size > 3 * 1024 * 1024) {
        return NextResponse.json(
          { error: "A logo deve ser PNG, JPG ou WEBP e ter no máximo 3 MB." },
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

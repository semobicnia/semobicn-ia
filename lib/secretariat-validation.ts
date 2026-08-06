import { z } from "zod";

export function isValidCnpj(value: string) {
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

export const secretariatFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Informe o nome completo da Secretaria.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  acronym: z
    .string()
    .trim()
    .min(2, "Informe uma sigla com pelo menos 2 caracteres.")
    .max(20, "A sigla deve ter no máximo 20 caracteres.")
    .regex(/^[\p{L}\d.-]+$/u, "Use apenas letras, números, ponto ou hífen.")
    .transform((value) => value.toUpperCase()),
  secretaryName: z
    .string()
    .trim()
    .min(5, "Informe o nome completo do Secretário de Obras.")
    .max(140, "O nome deve ter no máximo 140 caracteres."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail institucional válido.")
    .max(160, "O e-mail deve ter no máximo 160 caracteres.")
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(25, "O telefone deve ter no máximo 25 caracteres.")
    .refine(
      (value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 11;
      },
      "Informe um telefone com DDD.",
    ),
  fullAddress: z
    .string()
    .trim()
    .min(8, "Informe o endereço completo da Secretaria.")
    .max(260, "O endereço deve ter no máximo 260 caracteres."),
  cityHallName: z
    .string()
    .trim()
    .min(5, "Informe o nome da Prefeitura.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  cnpj: z
    .string()
    .trim()
    .refine(isValidCnpj, "Informe um CNPJ válido."),
});

export const institutionalLogoSchema = z
  .custom<File>((value) => value instanceof File, "Selecione um arquivo de imagem.")
  .refine(
    (file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type),
    "A logo deve ser PNG, JPG ou WEBP.",
  )
  .refine(
    (file) => file.size <= 3 * 1024 * 1024,
    "A logo deve ter no máximo 3 MB.",
  );

export type SecretariatFormValues = z.infer<typeof secretariatFormSchema>;

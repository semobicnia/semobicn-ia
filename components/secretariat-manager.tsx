"use client";

import { AlertCircle, Building2, ImageUp, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretariatSettings } from "@/lib/secretariat";
import {
  institutionalLogoSchema,
  secretariatFormSchema,
} from "@/lib/secretariat-validation";
import { cn } from "@/lib/utils";

type Draft = Omit<SecretariatSettings, "logoUrl" | "updatedAt">;
type FieldName = keyof Draft | "logo";
type FieldErrors = Partial<Record<FieldName, string>>;

function phoneMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, "($1) $2-$3")
      .replace(/[- ]+$/, "");
  }
  return digits
    .replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3")
    .replace(/-$/, "");
}

function cnpjMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function SecretariatManager({ initial }: { initial: SecretariatSettings }) {
  const [draft, setDraft] = useState<Draft>({
    name: initial.name,
    acronym: initial.acronym,
    secretaryName: initial.secretaryName,
    email: initial.email,
    phone: initial.phone,
    fullAddress: initial.fullAddress,
    cityHallName: initial.cityHallName,
    cnpj: initial.cnpj,
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(initial.logoUrl);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!logo) return;
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setMessage("");
  }

  function errorFor(field: FieldName) {
    const currentError = fieldErrors[field];
    return currentError ? (
      <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
        <AlertCircle size={13} /> {currentError}
      </p>
    ) : null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = secretariatFormSchema.safeParse(draft);
    const nextErrors: FieldErrors = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof Draft | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      });
    }
    if (logo) {
      const parsedLogo = institutionalLogoSchema.safeParse(logo);
      if (!parsedLogo.success) nextErrors.logo = parsedLogo.error.issues[0]?.message;
    }
    if (!parsed.success || Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Revise os campos destacados antes de salvar.");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const form = new FormData();
      Object.entries(parsed.data).forEach(([key, value]) => form.append(key, value));
      if (logo) form.append("logo", logo);
      const response = await fetch("/api/secretaria", {
        method: "PUT",
        body: form,
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        settings?: SecretariatSettings;
        fieldErrors?: Partial<Record<FieldName, string[]>>;
      };
      if (!response.ok) {
        if (result.fieldErrors) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(result.fieldErrors).map(([key, value]) => [key, value?.[0]]),
            ) as FieldErrors,
          );
        }
        throw new Error(result.error || "Não foi possível salvar.");
      }
      setMessage(result.message || "Dados atualizados com sucesso.");
      setLogo(null);
      if (result.settings) setLogoPreview(result.settings.logoUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="grid items-start gap-7 xl:grid-cols-[360px_minmax(0,1fr)]"
      noValidate
      onSubmit={save}
    >
      <Card className="h-fit overflow-hidden border-zinc-200 bg-white/90 shadow-sm">
        <CardHeader className="border-b border-zinc-200 bg-zinc-50/70 px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageUp size={19} /> Identidade visual
          </CardTitle>
          <CardDescription>Envie a marca oficial usada nos documentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6 sm:p-7">
          <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
            {logoPreview ? (
              <img
                alt={`Logo ${draft.acronym || "da Secretaria"}`}
                className="max-h-36 max-w-full object-contain"
                src={logoPreview}
              />
            ) : (
              <div className="text-center text-zinc-500">
                <Building2 className="mx-auto mb-2" size={34} />
                <span className="text-sm">Nenhuma logo cadastrada</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretariat-logo">Logo da Secretaria</Label>
            <Input
              accept="image/png,image/jpeg,image/webp"
              aria-invalid={Boolean(fieldErrors.logo)}
              className={cn(
                "cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold",
                fieldErrors.logo && "border-red-500 focus:border-red-500 focus:ring-red-500/10",
              )}
              id="secretariat-logo"
              onChange={(event) => {
                setLogo(event.target.files?.[0] || null);
                setFieldErrors((current) => ({ ...current, logo: undefined }));
              }}
              type="file"
            />
            {errorFor("logo")}
            <p className="text-xs leading-5 text-zinc-500">
              PNG, JPG ou WEBP, com fundo transparente quando possível. Máximo de 3 MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-zinc-200 bg-white/90 shadow-sm">
        <CardHeader className="border-b border-zinc-200 bg-zinc-50/70 px-6 py-5 sm:px-7">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 size={19} /> Dados institucionais
          </CardTitle>
          <CardDescription>
            Informações oficiais de identificação, contato e representação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-7 p-6 sm:p-7">
          <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-name">Nome da Secretaria</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.name)}
                className={cn(fieldErrors.name && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-name"
                maxLength={160}
                onChange={(event) => change("name", event.target.value)}
                required
                value={draft.name}
              />
              {errorFor("name")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-acronym">Sigla</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.acronym)}
                className={cn(fieldErrors.acronym && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-acronym"
                maxLength={20}
                onChange={(event) => change("acronym", event.target.value.toUpperCase())}
                required
                value={draft.acronym}
              />
              {errorFor("acronym")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-cnpj">CNPJ</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.cnpj)}
                className={cn(fieldErrors.cnpj && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-cnpj"
                inputMode="numeric"
                onChange={(event) => change("cnpj", cnpjMask(event.target.value))}
                placeholder="00.000.000/0000-00"
                required
                value={draft.cnpj}
              />
              {errorFor("cnpj")}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-secretary">Secretário de Obras</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.secretaryName)}
                className={cn(fieldErrors.secretaryName && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-secretary"
                maxLength={140}
                onChange={(event) => change("secretaryName", event.target.value)}
                required
                value={draft.secretaryName}
              />
              {errorFor("secretaryName")}
              <p className="text-xs text-zinc-500">
                Este nome será utilizado na assinatura dos novos croquis.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-email">E-mail institucional</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.email)}
                className={cn(fieldErrors.email && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-email"
                maxLength={160}
                onChange={(event) => change("email", event.target.value)}
                required
                type="email"
                value={draft.email}
              />
              {errorFor("email")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-phone">Telefone</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.phone)}
                className={cn(fieldErrors.phone && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-phone"
                inputMode="tel"
                onChange={(event) => change("phone", phoneMask(event.target.value))}
                placeholder="(99) 99999-9999"
                required
                value={draft.phone}
              />
              {errorFor("phone")}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-address">Endereço completo</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.fullAddress)}
                className={cn(fieldErrors.fullAddress && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-address"
                maxLength={260}
                onChange={(event) => change("fullAddress", event.target.value)}
                placeholder="Rua, número, bairro, cidade, UF e CEP"
                required
                value={draft.fullAddress}
              />
              {errorFor("fullAddress")}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-city-hall">Prefeitura</Label>
              <Input
                aria-invalid={Boolean(fieldErrors.cityHallName)}
                className={cn(fieldErrors.cityHallName && "border-red-500 focus:border-red-500 focus:ring-red-500/10")}
                id="secretariat-city-hall"
                maxLength={160}
                onChange={(event) => change("cityHallName", event.target.value)}
                required
                value={draft.cityHallName}
              />
              {errorFor("cityHallName")}
            </div>
          </div>

          {message && <div className="admin-message success">{message}</div>}
          {error && <div className="admin-message error">{error}</div>}
          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
            <Button className="min-w-44 bg-zinc-950 text-white hover:bg-zinc-800" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

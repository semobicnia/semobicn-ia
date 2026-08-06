"use client";

import { Building2, ImageUp, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretariatSettings } from "@/lib/secretariat";

type Draft = Omit<SecretariatSettings, "logoUrl" | "updatedAt">;

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

  useEffect(() => {
    if (!logo) return;
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      Object.entries(draft).forEach(([key, value]) => form.append(key, value));
      if (logo) form.append("logo", logo);
      const response = await fetch("/api/secretaria", {
        method: "PUT",
        body: form,
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        settings?: SecretariatSettings;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
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
    <form className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]" onSubmit={save}>
      <Card className="h-fit border-zinc-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageUp size={19} /> Identidade visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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
              id="secretariat-logo"
              onChange={(event) => setLogo(event.target.files?.[0] || null)}
              type="file"
            />
            <p className="text-xs leading-5 text-zinc-500">
              PNG, JPG ou WEBP, com fundo transparente quando possível. Máximo de 3 MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 size={19} /> Dados institucionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-name">Nome da Secretaria</Label>
              <Input
                id="secretariat-name"
                maxLength={160}
                onChange={(event) => change("name", event.target.value)}
                required
                value={draft.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-acronym">Sigla</Label>
              <Input
                id="secretariat-acronym"
                maxLength={20}
                onChange={(event) => change("acronym", event.target.value.toUpperCase())}
                required
                value={draft.acronym}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-cnpj">CNPJ</Label>
              <Input
                id="secretariat-cnpj"
                inputMode="numeric"
                onChange={(event) => change("cnpj", cnpjMask(event.target.value))}
                placeholder="00.000.000/0000-00"
                required
                value={draft.cnpj}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-secretary">Secretário de Obras</Label>
              <Input
                id="secretariat-secretary"
                maxLength={140}
                onChange={(event) => change("secretaryName", event.target.value)}
                required
                value={draft.secretaryName}
              />
              <p className="text-xs text-zinc-500">
                Este nome será utilizado na assinatura dos novos croquis.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-email">E-mail institucional</Label>
              <Input
                id="secretariat-email"
                maxLength={160}
                onChange={(event) => change("email", event.target.value)}
                required
                type="email"
                value={draft.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretariat-phone">Telefone</Label>
              <Input
                id="secretariat-phone"
                inputMode="tel"
                onChange={(event) => change("phone", phoneMask(event.target.value))}
                placeholder="(99) 99999-9999"
                required
                value={draft.phone}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-address">Endereço completo</Label>
              <Input
                id="secretariat-address"
                maxLength={260}
                onChange={(event) => change("fullAddress", event.target.value)}
                placeholder="Rua, número, bairro, cidade, UF e CEP"
                required
                value={draft.fullAddress}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secretariat-city-hall">Prefeitura</Label>
              <Input
                id="secretariat-city-hall"
                maxLength={160}
                onChange={(event) => change("cityHallName", event.target.value)}
                required
                value={draft.cityHallName}
              />
            </div>
          </div>

          {message && <div className="admin-message success">{message}</div>}
          {error && <div className="admin-message error">{error}</div>}
          <div className="flex justify-end border-t border-zinc-200 pt-5">
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

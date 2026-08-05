"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RequestDraft = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  registration: string;
};

const emptyDraft: RequestDraft = {
  fullName: "",
  email: "",
  phone: "",
  jobTitle: "",
  registration: "",
};

export function AccessRequestForm() {
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function update(key: keyof RequestDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível enviar a solicitação.");
      }
      setSent(true);
      setDraft(emptyDraft);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="grid min-h-64 place-items-center px-6 py-9 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={24} />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950">
            Solicitação enviada
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Após a autorização, você poderá entrar usando exatamente a mesma
            conta Gmail informada no cadastro.
          </p>
          <Button className="mt-5" variant="outline" onClick={() => setSent(false)}>
            Enviar outra solicitação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7" onSubmit={submitRequest}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="request-name">Nome completo</Label>
        <Input
          id="request-name"
          required
          minLength={5}
          maxLength={120}
          autoComplete="name"
          value={draft.fullName}
          onChange={(event) => update("fullName", event.target.value)}
          placeholder="Nome completo do servidor"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="request-email">Conta Gmail</Label>
        <Input
          id="request-email"
          required
          type="email"
          maxLength={160}
          autoComplete="email"
          value={draft.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="nome@gmail.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="request-phone">Telefone</Label>
        <Input
          id="request-phone"
          required
          type="tel"
          maxLength={20}
          autoComplete="tel"
          value={draft.phone}
          onChange={(event) => update("phone", event.target.value)}
          placeholder="(99) 99999-9999"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="request-job">Cargo</Label>
        <Input
          id="request-job"
          required
          maxLength={100}
          value={draft.jobTitle}
          onChange={(event) => update("jobTitle", event.target.value)}
          placeholder="Ex.: Fiscal de Obras"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="request-registration">Matrícula</Label>
        <Input
          id="request-registration"
          required
          maxLength={50}
          value={draft.registration}
          onChange={(event) => update("registration", event.target.value)}
          placeholder="Número da matrícula funcional"
        />
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800 sm:col-span-2"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[11px] leading-5 text-zinc-500">
          O Gmail informado será usado posteriormente para o login com Google.
        </p>
        <Button type="submit" className="min-w-44" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />}
          {loading ? "Enviando..." : "Enviar solicitação"}
        </Button>
      </div>
    </form>
  );
}

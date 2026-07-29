"use client";

import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginCard({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);

  async function enterWithGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SEMOBICN IA</strong>
            <span>Prefeitura de Coelho Neto</span>
          </div>
        </div>

        <div className="login-icon">
          <LockKeyhole size={28} />
        </div>
        <p className="eyebrow">Acesso institucional</p>
        <h1>Entre para continuar</h1>
        <p className="login-description">
          Utilize a conta Google autorizada pela Secretaria Municipal de Obras
          e Infraestrutura.
        </p>

        {error ? (
          <div className="login-error" role="alert">
            Esta conta não está autorizada. Solicite acesso ao administrador.
          </div>
        ) : null}

        <button
          className="google-login-button"
          type="button"
          onClick={enterWithGoogle}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle className="spin" size={19} />
          ) : (
            <span className="google-symbol">G</span>
          )}
          {loading ? "Abrindo o Google..." : "Entrar com Google"}
        </button>

        <div className="login-security">
          <ShieldCheck size={17} />
          <span>Acesso restrito aos servidores autorizados.</span>
        </div>
      </section>
    </main>
  );
}

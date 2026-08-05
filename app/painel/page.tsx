import {
  CheckCircle2,
  Clock3,
  FileBarChart,
  Files,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getAuthenticatedSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect("/entrar");
  if (session.user.role !== "admin") redirect("/sistema");
  const stats = await getDashboardStats();

  const cards = [
    { label: "Total de processos", value: stats.total, icon: Files },
    { label: "Em revisão", value: stats.review, icon: Clock3 },
    { label: "Aprovados", value: stats.approved, icon: ShieldCheck },
    { label: "PDFs gerados", value: stats.completed, icon: CheckCircle2 },
  ];

  return (
    <main className="min-h-screen">
      <AppHeader
        currentUser={{
          name: session.user.name || "Servidor autorizado",
          email: session.user.email || "",
          role: session.user.role,
        }}
      />
      <div className="page-shell management-shell">
        <section className="management-heading">
          <span><FileBarChart size={24} /></span>
          <div>
            <p className="eyebrow">Visão administrativa</p>
            <h1>Painel de processos</h1>
            <p>
              Acompanhe a produção, as pendências e as atividades recentes.
            </p>
          </div>
        </section>

        <section className="dashboard-cards">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="dashboard-card" key={card.label}>
                <span><Icon size={20} /></span>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
              </article>
            );
          })}
          <article className="dashboard-card accent">
            <span><Files size={20} /></span>
            <small>Últimos 30 dias</small>
            <strong>{stats.last30Days}</strong>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="admin-card">
            <div className="admin-card-heading">
              <span><UsersRound size={19} /></span>
              <div>
                <h2>Produção por servidor</h2>
                <p>Quantidade de processos cadastrados.</p>
              </div>
            </div>
            {stats.byUser.length === 0 ? (
              <div className="compact-empty">Nenhum processo registrado.</div>
            ) : (
              <div className="production-list">
                {stats.byUser.map((user) => (
                  <div key={user.email || user.name}>
                    <span>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </span>
                    <b>{user.total}</b>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-card">
            <div className="admin-card-heading">
              <span><Clock3 size={19} /></span>
              <div>
                <h2>Atividades recentes</h2>
                <p>Alterações registradas automaticamente.</p>
              </div>
            </div>
            {stats.recentEvents.length === 0 ? (
              <div className="compact-empty">Nenhuma atividade registrada.</div>
            ) : (
              <div className="activity-list">
                {stats.recentEvents.map((event) => (
                  <Link href={`/processos/${event.processId}`} key={event.id}>
                    <span>
                      <strong>{event.description}</strong>
                      <small>
                        {event.claimantName} · {event.userName}
                      </small>
                    </span>
                    <time>{formatDate(event.createdAt)}</time>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { Check, Pencil, Plus, ShieldCheck, UserX, X } from "lucide-react";
import { useState } from "react";
import type { ManagedUser, UserRole } from "@/lib/users";
import type { SexCode, StaffRole } from "@/lib/topographic";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  operator: "Operador",
  reviewer: "Revisor",
};

const professionalRoleLabels: Record<StaffRole, string> = {
  technical_responsible: "Responsável Técnico",
  works_inspector: "Fiscal de Obras",
};

const sexLabels: Record<SexCode, string> = {
  female: "Feminino",
  male: "Masculino",
  not_informed: "Não informado",
};

type Draft = {
  fullName: string;
  email: string;
  role: UserRole;
  professionalRole: StaffRole | null;
  sex: SexCode;
  registration: string;
};

const emptyDraft: Draft = {
  fullName: "",
  email: "",
  role: "operator",
  professionalRole: null,
  sex: "not_informed",
  registration: "",
};

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRole, setEditingRole] = useState<UserRole>("operator");
  const [editingProfessionalRole, setEditingProfessionalRole] =
    useState<StaffRole | null>(null);
  const [editingSex, setEditingSex] = useState<SexCode>("not_informed");
  const [editingRegistration, setEditingRegistration] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as {
        user?: ManagedUser;
        error?: string;
      };
      if (!response.ok || !result.user) {
        throw new Error(result.error || "Não foi possível cadastrar o usuário.");
      }
      setUsers((current) => [...current, result.user!]);
      setDraft(emptyDraft);
      setMessage("Servidor autorizado com sucesso.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível cadastrar o usuário.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(
    user: ManagedUser,
    changes: {
      fullName: string;
      role: UserRole;
      active: boolean;
      professionalRole: StaffRole | null;
      sex: SexCode;
      registration: string;
    },
  ) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const result = (await response.json()) as {
        user?: ManagedUser;
        error?: string;
      };
      if (!response.ok || !result.user) {
        throw new Error(result.error || "Não foi possível atualizar o usuário.");
      }
      setUsers((current) =>
        current.map((item) => (item.id === result.user!.id ? result.user! : item)),
      );
      setEditingId(null);
      setMessage("Cadastro atualizado.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar o usuário.",
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing(user: ManagedUser) {
    setEditingId(user.id);
    setEditingName(user.fullName);
    setEditingRole(user.role);
    setEditingProfessionalRole(user.professionalRole);
    setEditingSex(user.sex);
    setEditingRegistration(user.registration);
    setError("");
    setMessage("");
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div className="admin-card-heading">
          <span><Plus size={19} /></span>
          <div>
            <h2>Autorizar servidor</h2>
            <p>O e-mail deve ser o mesmo utilizado na conta Google.</p>
          </div>
        </div>
        <form className="admin-form" onSubmit={createUser}>
          <label className="field">
            <span>Nome completo</span>
            <input
              required
              value={draft.fullName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>E-mail Google</span>
            <input
              required
              type="email"
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Perfil de acesso</span>
            <select
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                }))
              }
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Cargo funcional</span>
            <select
              value={draft.professionalRole || ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  professionalRole:
                    (event.target.value as StaffRole) || null,
                  registration:
                    event.target.value ? current.registration : "",
                }))
              }
            >
              <option value="">Sem cargo na assinatura</option>
              {Object.entries(professionalRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {draft.professionalRole && (
            <>
              <label className="field">
                <span>Sexo</span>
                <select
                  value={draft.sex}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sex: event.target.value as SexCode,
                    }))
                  }
                >
                  {Object.entries(sexLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  {draft.professionalRole === "technical_responsible"
                    ? "Registro profissional"
                    : "Matrícula"}
                </span>
                <input
                  required
                  placeholder={
                    draft.professionalRole === "technical_responsible"
                      ? "Ex.: CREA/CFT 123456"
                      : "Ex.: Mat. 110351"
                  }
                  value={draft.registration}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      registration: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          )}
          <button className="button primary" disabled={loading}>
            <Plus size={17} />
            Autorizar acesso
          </button>
        </form>
      </section>

      <section className="admin-card user-list-card">
        <div className="admin-card-heading">
          <span><ShieldCheck size={19} /></span>
          <div>
            <h2>Servidores cadastrados</h2>
            <p>{users.filter((user) => user.active).length} acesso(s) ativo(s)</p>
          </div>
        </div>
        {message && <div className="admin-message success">{message}</div>}
        {error && <div className="admin-message error">{error}</div>}
        <div className="user-list">
          {users.map((user) => {
            const editing = editingId === user.id;
            return (
              <article className={`user-row ${!user.active ? "inactive" : ""}`} key={user.id}>
                <span className="user-list-avatar">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <div className="user-details">
                  {editing ? (
                    <input
                      aria-label="Nome completo"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                  ) : (
                    <strong>{user.fullName}</strong>
                  )}
                  <small>{user.email}</small>
                  {editing ? (
                    <div className="user-professional-edit">
                      <select
                        aria-label="Cargo funcional"
                        value={editingProfessionalRole || ""}
                        onChange={(event) => {
                          const value =
                            (event.target.value as StaffRole) || null;
                          setEditingProfessionalRole(value);
                          if (!value) setEditingRegistration("");
                        }}
                      >
                        <option value="">Sem cargo na assinatura</option>
                        {Object.entries(professionalRoleLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ),
                        )}
                      </select>
                      {editingProfessionalRole && (
                        <>
                          <select
                            aria-label="Sexo"
                            value={editingSex}
                            onChange={(event) =>
                              setEditingSex(event.target.value as SexCode)
                            }
                          >
                            {Object.entries(sexLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <input
                            aria-label="Matrícula ou registro profissional"
                            placeholder="Matrícula ou registro"
                            value={editingRegistration}
                            onChange={(event) =>
                              setEditingRegistration(event.target.value)
                            }
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <small className="professional-badge">
                      {user.professionalRole
                        ? `${professionalRoleLabels[user.professionalRole]} · ${
                            user.registration
                          }`
                        : "Sem cargo na assinatura"}
                    </small>
                  )}
                </div>
                <div className="user-role">
                  {editing ? (
                    <select
                      aria-label="Perfil de acesso"
                      value={editingRole}
                      onChange={(event) =>
                        setEditingRole(event.target.value as UserRole)
                      }
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{roleLabels[user.role]}</span>
                  )}
                  <small>{user.active ? "Ativo" : "Desativado"}</small>
                </div>
                <div className="user-actions">
                  {editing ? (
                    <>
                      <button
                        aria-label="Salvar alterações"
                        disabled={loading}
                        onClick={() =>
                          updateUser(user, {
                            fullName: editingName,
                            role: editingRole,
                            active: user.active,
                            professionalRole: editingProfessionalRole,
                            sex: editingSex,
                            registration: editingRegistration,
                          })
                        }
                        type="button"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        aria-label="Cancelar edição"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        aria-label={`Editar ${user.fullName}`}
                        onClick={() => startEditing(user)}
                        type="button"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={
                          user.active
                            ? `Desativar ${user.fullName}`
                            : `Ativar ${user.fullName}`
                        }
                        className={user.active ? "danger" : "success"}
                        disabled={loading || user.id === currentUserId}
                        onClick={() =>
                          updateUser(user, {
                            fullName: user.fullName,
                            role: user.role,
                            active: !user.active,
                            professionalRole: user.professionalRole,
                            sex: user.sex,
                            registration: user.registration,
                          })
                        }
                        type="button"
                      >
                        {user.active ? <UserX size={15} /> : <Check size={15} />}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

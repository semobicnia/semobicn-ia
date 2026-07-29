import type { Sql } from "postgres";
import { createDatabaseClient } from "./database";

export type UserRole = "admin" | "operator" | "reviewer";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  pictureUrl: string | null;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  picture_url: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
    pictureUrl: row.picture_url,
  };
}

async function ensureInitialAdmin(sql: Sql, email: string) {
  const initialAdminEmail = normalizeEmail(
    process.env.INITIAL_ADMIN_EMAIL || "semobicn.ia@gmail.com",
  );
  if (email !== initialAdminEmail) return;

  await sql`
    insert into app_users (email, full_name, role)
    values (
      ${initialAdminEmail},
      'Administrador SEMOBICN IA',
      'admin'
    )
    on conflict do nothing
  `;
}

export async function findAuthorizedUser(
  emailValue: string | null | undefined,
): Promise<AppUser | null> {
  if (!emailValue) return null;
  const email = normalizeEmail(emailValue);
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    await ensureInitialAdmin(sql, email);
    const [row] = await sql<UserRow[]>`
      select id, email, full_name, role, active, picture_url
      from app_users
      where lower(email) = ${email}
      limit 1
    `;
    if (!row?.active) return null;
    return mapUser(row);
  } finally {
    await sql.end();
  }
}

export async function recordSuccessfulLogin(input: {
  email: string;
  fullName?: string | null;
  pictureUrl?: string | null;
}) {
  const sql = createDatabaseClient();
  if (!sql) return;
  const email = normalizeEmail(input.email);

  try {
    await sql`
      update app_users
      set
        full_name = coalesce(nullif(${input.fullName?.trim() || null}, ''), full_name),
        picture_url = coalesce(${input.pictureUrl || null}, picture_url),
        last_login_at = now(),
        updated_at = now()
      where lower(email) = ${email}
        and active
    `;
  } finally {
    await sql.end();
  }
}

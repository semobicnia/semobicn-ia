create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null default 'operator',
  active boolean not null default true,
  picture_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_role_check
    check (role in ('admin', 'operator', 'reviewer'))
);

create unique index if not exists app_users_email_idx
  on app_users (lower(email));

insert into app_users (email, full_name, role)
values (
  'semobicn.ia@gmail.com',
  'Administrador SEMOBICN IA',
  'admin'
)
on conflict do nothing;

create table if not exists sex_options (
  code text primary key,
  label text not null,
  sort_order smallint not null default 0,
  active boolean not null default true,
  constraint sex_options_code_check
    check (code in ('female', 'male', 'not_informed'))
);

insert into sex_options (code, label, sort_order)
values
  ('female', 'Feminino', 1),
  ('male', 'Masculino', 2),
  ('not_informed', 'Não informado', 3)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = true;

create table if not exists municipal_staff (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid references app_users (id) on delete cascade,
  full_name text not null,
  role text not null,
  sex_code text not null references sex_options (code),
  registration text not null,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint municipal_staff_role_check
    check (role in ('technical_responsible', 'works_inspector'))
);

alter table municipal_staff
  add column if not exists app_user_id uuid
    references app_users (id) on delete cascade;

create unique index if not exists municipal_staff_app_user_idx
  on municipal_staff (app_user_id);

drop index if exists municipal_staff_role_name_idx;

create index if not exists municipal_staff_role_name_idx
  on municipal_staff (role, full_name);

insert into municipal_staff (
  full_name,
  role,
  sex_code,
  registration,
  sort_order
)
values
  (
    'Gabriel de Araújo Ramos',
    'technical_responsible',
    'male',
    'CREA/CFT: 1909916552/23134151391',
    1
  ),
  (
    'Elesbão Pinto Magalhães Filho',
    'works_inspector',
    'male',
    'Mat. 110351',
    1
  )
on conflict (role, full_name) do update
set
  sex_code = excluded.sex_code,
  registration = excluded.registration,
  active = true,
  updated_at = now();

create table if not exists municipal_secretaries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  office_title text not null,
  appointment text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists municipal_secretaries_default_idx
  on municipal_secretaries (is_default)
  where is_default and active;

insert into municipal_secretaries (
  full_name,
  office_title,
  appointment,
  is_default
)
values (
  'Antonio Lustosa de Melo',
  'Sec. Mul de Obras e Infraestrutura',
  'Portaria: 029/2026-CC',
  true
)
on conflict (full_name) do update
set
  office_title = excluded.office_title,
  appointment = excluded.appointment,
  is_default = true,
  active = true,
  updated_at = now();

create table if not exists topographic_processes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'review',
  claimant_name text not null,
  claimant_sex_code text not null default 'not_informed'
    references sex_options (code),
  property_address text not null,
  block_number text,
  lot_number text,
  technical_responsible_id uuid references municipal_staff (id),
  works_inspector_id uuid references municipal_staff (id),
  created_by_user_id uuid references app_users (id),
  source_pdf_url text,
  source_public_id text,
  supplementary_message text,
  extracted_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table topographic_processes
  drop constraint if exists topographic_processes_status_check;

alter table topographic_processes
  add constraint topographic_processes_status_check
    check (status in ('review', 'approved', 'completed', 'cancelled', 'archived'));

alter table topographic_processes
  add column if not exists claimant_sex_code text not null
    default 'not_informed' references sex_options (code),
  add column if not exists technical_responsible_id uuid
    references municipal_staff (id),
  add column if not exists works_inspector_id uuid
    references municipal_staff (id),
  add column if not exists created_by_user_id uuid
    references app_users (id);

update topographic_processes
set technical_responsible_id = (
  select id
  from municipal_staff
  where role = 'technical_responsible' and active
  order by sort_order, full_name
  limit 1
)
where technical_responsible_id is null;

update topographic_processes
set works_inspector_id = (
  select id
  from municipal_staff
  where role = 'works_inspector' and active
  order by sort_order, full_name
  limit 1
)
where works_inspector_id is null;

create index if not exists topographic_processes_created_at_idx
  on topographic_processes (created_at desc);

create index if not exists topographic_processes_claimant_sex_idx
  on topographic_processes (claimant_sex_code);

create index if not exists topographic_processes_created_by_idx
  on topographic_processes (created_by_user_id);

create index if not exists topographic_processes_status_idx
  on topographic_processes (status, created_at desc);

create table if not exists process_events (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references topographic_processes (id) on delete cascade,
  user_id uuid references app_users (id),
  action text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint process_events_action_check
    check (action in (
      'created',
      'updated',
      'status_changed',
      'pdf_generated',
      'source_viewed',
      'sketch_saved'
    ))
);

alter table process_events
  drop constraint if exists process_events_action_check;

alter table process_events
  add constraint process_events_action_check
    check (action in (
      'created',
      'updated',
      'status_changed',
      'pdf_generated',
      'source_viewed',
      'sketch_saved'
    ));

create index if not exists process_events_process_idx
  on process_events (process_id, created_at desc);

insert into process_events (process_id, user_id, action, description)
select
  process.id,
  process.created_by_user_id,
  'created',
  'Processo iniciado a partir do desenho original.'
from topographic_processes process
where not exists (
  select 1 from process_events event
  where event.process_id = process.id and event.action = 'created'
);

create table if not exists urban_sketches (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null unique
    references topographic_processes (id) on delete cascade,
  created_by_user_id uuid references app_users (id),
  settings jsonb not null default '{}'::jsonb,
  location_image_public_id text,
  location_image_format text,
  status text not null default 'review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint urban_sketches_status_check
    check (status in ('review', 'finalized'))
);

create index if not exists urban_sketches_created_at_idx
  on urban_sketches (created_at desc);

alter table urban_sketches
  add column if not exists location_image_public_id text;

alter table urban_sketches
  add column if not exists location_image_format text;

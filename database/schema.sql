create extension if not exists pgcrypto;

create table if not exists topographic_processes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'review',
  claimant_name text not null,
  property_address text not null,
  block_number text,
  lot_number text,
  source_pdf_url text,
  source_public_id text,
  supplementary_message text,
  extracted_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists topographic_processes_created_at_idx
  on topographic_processes (created_at desc);

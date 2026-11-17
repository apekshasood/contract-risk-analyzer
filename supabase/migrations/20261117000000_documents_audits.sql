-- Documents (uploaded PDFs) and audits (one AI run on a document).
-- Run once in the Supabase SQL editor, or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  -- Path inside the `contracts` bucket: "<user_id>/<uuid>.pdf"
  storage_path text not null unique,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now()
);

create table public.audits (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null default 'buyer' check (role in ('buyer', 'seller', 'landlord', 'tenant')),
  context     text not null default '' check (char_length(context) <= 2000),
  status      text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  result      jsonb,  -- AuditResult from the AI engine, set when status = 'done'
  error       text,   -- set when status = 'failed'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint audits_done_has_result  check (status <> 'done'   or result is not null),
  constraint audits_failed_has_error check (status <> 'failed' or error  is not null)
);

-- Dashboard query: "my audits, newest first"
create index audits_user_created_idx on public.audits (user_id, created_at desc);
create index audits_document_idx on public.audits (document_id);
create index documents_user_created_idx on public.documents (user_id, created_at desc);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger audits_set_updated_at
  before update on public.audits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Users read and create their own rows. Only the backend (service_role key,
-- which bypasses RLS) moves an audit through processing -> done/failed.
-- `(select auth.uid())` is evaluated once per query, not once per row.
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;
alter table public.audits    enable row level security;

create policy "documents: read own" on public.documents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "documents: insert own" on public.documents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "documents: delete own" on public.documents
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "audits: read own" on public.audits
  for select to authenticated
  using (user_id = (select auth.uid()));

-- A user can only queue a new audit, on a document they own.
create policy "audits: queue own" on public.audits
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'queued'
    and result is null
    and error is null
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

-- No update/delete policy on audits: with RLS on, those are denied for users.

-- ---------------------------------------------------------------------------
-- Storage: private bucket, PDFs only, 10 MB max.
-- Each user can only touch files under their own folder "<user_id>/...".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "contracts: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "contracts: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "contracts: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Open source repositories a member has contributed to, or maintains.
--
-- This is what the directory's people badges are built from: "2 friends have
-- contributed" on a repo is the members who listed it here as contributors,
-- "maintainer in our group" is a member who listed it as a maintainer. A
-- member writes their own rows from the profile editor; nobody else can.
--
-- Self-declared on purpose. The profile shows each row beside a link to that
-- person's pull requests on the repository, so anybody can check the claim in
-- one click — the same evidence GitHub itself would give.
--
-- `repo` is `owner/name`, lower-cased by the app before it is written, so the
-- unique constraint is case-blind without an expression index.

create table public.oss_contributions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  repo       text not null,
  relation   text not null default 'contributor',
  created_at timestamptz not null default now(),
  constraint oss_contributions_repo_shape check (
    repo = lower(repo)
    and repo ~ '^[a-z0-9](?:[a-z0-9-]{0,38})/[a-z0-9._-]{1,100}$'
  ),
  constraint oss_contributions_relation check (relation in ('contributor', 'maintainer')),
  constraint oss_contributions_once unique (user_id, repo)
);

create index oss_contributions_repo on public.oss_contributions (repo);

comment on table public.oss_contributions is
  'Open source repositories a member says they contributed to or maintain; feeds the directory badges.';

alter table public.oss_contributions enable row level security;

create policy "open source contributions are public"
  on public.oss_contributions for select
  to anon, authenticated
  using (true);

create policy "people list their own contributions"
  on public.oss_contributions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "people remove their own contributions"
  on public.oss_contributions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- No update policy and no update grant: changing a row is removing it and
-- adding the right one, which keeps the two policies above the whole story.
grant select on public.oss_contributions to anon, authenticated;
grant insert, delete on public.oss_contributions to authenticated;

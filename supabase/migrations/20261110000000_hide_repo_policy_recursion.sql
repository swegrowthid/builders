-- Hiding a repository never worked: every insert into github_hidden_repos was
-- refused with 42P17, "infinite recursion detected in policy for relation
-- github_hidden_repos" (#237).
--
-- The insert policy from 20261105000000 caps a member's list by counting their
-- rows in the same table. A policy on a table may not read that table: the
-- read would be subject to the table's own policies again, and PostgreSQL
-- refuses the statement while rewriting it, before any row is looked at. So
-- the refusal did not depend on how many rows a member had, and the upsert the
-- app sends failed the same way as a plain insert.
--
-- The count moves into a function that runs as its owner, the same way
-- can_manage_project() reads seats for the seats policies (0004). It answers
-- only for the caller, so it tells nobody anything about another member.

create or replace function public.github_hidden_repo_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.github_hidden_repos h
  where h.user_id = (select auth.uid());
$$;

comment on function public.github_hidden_repo_count() is
  'How many repositories the caller keeps off the site. Used by the insert policy on github_hidden_repos, which cannot count its own table.';

revoke all on function public.github_hidden_repo_count() from public, anon;
grant execute on function public.github_hidden_repo_count() to authenticated;

alter policy "a member hides a repository"
  on public.github_hidden_repos
  with check (
    user_id = (select auth.uid())
    and public.github_hidden_repo_count() < 200
  );

revoke all on table public.work_items, public.library_items, public.business_context, public.intelligence_runs from anon;
grant select, insert, update, delete on table public.work_items, public.library_items, public.business_context to authenticated;
grant select, insert on table public.intelligence_runs to authenticated;

-- Server-side API routes call this SECURITY DEFINER RPC with the service role.
-- The trigger function has no direct public API use.
revoke execute on function public.bazaar_create_request(text,text,text,text,uuid,text,integer,text,text,date,date,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.bazaar_create_request(text,text,text,text,uuid,text,integer,text,text,date,date,text,text,integer,integer)
  to service_role;
revoke execute on function public.touch_tasks_updated_at()
  from public, anon, authenticated;

-- ============================================================
-- Make sure the OWNER of a shared challenge is also a member, so they can see
-- co-readers' progress (RLS for reading members requires membership).
-- ============================================================

insert into public.challenge_members (challenge_id, user_id, display_name, role)
select c.id, c.user_id, coalesce(p.display_name, 'Reader'), 'owner'
from public.challenges c
left join public.profiles p on p.id = c.user_id
where c.shared = true
on conflict (challenge_id, user_id) do nothing;

-- Joining now also guarantees the owner is a member.
create or replace function public.join_challenge(invite text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; owner_id uuid;
begin
  select id, user_id into cid, owner_id from public.challenges where invite_code = invite;
  if cid is null then raise exception 'invalid invite code'; end if;
  update public.challenges set shared = true where id = cid;
  insert into public.challenge_members (challenge_id, user_id, display_name, role)
    values (cid, owner_id, (select display_name from public.profiles where id = owner_id), 'owner')
    on conflict do nothing;
  insert into public.challenge_members (challenge_id, user_id, display_name)
    values (cid, auth.uid(), (select display_name from public.profiles where id = auth.uid()))
    on conflict do nothing;
  return cid;
end;
$$;

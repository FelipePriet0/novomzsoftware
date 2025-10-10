-- Promove um perfil existente a gestor caso não exista nenhum gestor
update public.profiles p
set role = 'gestor'
where p.id = (
  select p2.id from public.profiles p2
  where not exists (select 1 from public.profiles g where g.role = 'gestor')
  order by p2.created_at nulls last, p2.id asc
  limit 1
)
and not exists (select 1 from public.profiles g where g.role = 'gestor');

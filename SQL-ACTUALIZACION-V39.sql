-- ============================================================
-- SWEET BY SAMI · V39
-- Mega Caja separada + único WhatsApp de contacto
-- ============================================================

begin;

-- Mega Caja queda fuera de Scoops y en su propio apartado.
insert into public.categories (id,name,description,active,sort_order)
values (
  'boxes',
  'Mega Caja',
  'La Mega Caja tiene su propio apartado con productos completos, snacks, dulces y sorpresas.',
  true,
  2
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.products
set category_id = 'boxes',
    sort_order = 1,
    updated_at = now()
where id = 'mega-box';

-- Un solo WhatsApp oficial para coordinación.
insert into public.site_settings (id)
values ('main')
on conflict (id) do nothing;

update public.site_settings
set coordination_phone_1 = '59172751732',
    coordination_phone_2 = '',
    updated_at = now()
where id = 'main';

notify pgrst, 'reload schema';

commit;

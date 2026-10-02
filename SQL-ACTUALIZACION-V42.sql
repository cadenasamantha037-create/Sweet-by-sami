-- ============================================================
-- SWEET BY SAMI · V42
-- Días configurables de envíos nacionales desde Administración
-- ============================================================

begin;

alter table public.site_settings
  add column if not exists national_shipping_days text not null
  default 'Lunes,Miércoles,Viernes';

-- Si la columna acaba de crearse, el DEFAULT ya actualiza el registro main.
-- Esta línea cubre instalaciones antiguas con valor vacío.
update public.site_settings
set national_shipping_days = 'Lunes,Miércoles,Viernes',
    updated_at = now()
where id = 'main'
  and (national_shipping_days is null or trim(national_shipping_days) = '');

notify pgrst, 'reload schema';

commit;

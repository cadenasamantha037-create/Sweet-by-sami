-- ============================================================
-- SWEET BY SAMI · SUPABASE · INSTALACION COMPLETA V20
-- Catálogo + variantes + clientes + pedidos + pagos + QR
-- + ubicación delivery + dashboard admin + Storage + RLS
--
-- Ejecutar TODO este archivo de una sola vez en Supabase SQL Editor.
-- Es idempotente: puede volver a ejecutarse sin borrar pedidos existentes.
-- Admin autorizado: cadenasamantha037@gmail.com
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1) FUNCIONES AUXILIARES
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- Verificación centralizada de la única cuenta administradora.
-- Se consulta auth.users usando auth.uid(), evitando depender de que el claim
-- email del JWT esté disponible/fresco en cada petición.
create or replace function public.is_sweet_admin()
returns boolean
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email,'')) = 'cadenasamantha037@gmail.com'
  );
$$;

revoke all on function public.is_sweet_admin() from public;
grant execute on function public.is_sweet_admin() to authenticated;

-- ============================================================
-- 2) TABLAS
-- ============================================================

create table if not exists public.categories (
  id text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  category_id text,
  name text not null,
  short_name text,
  subtitle text,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  spoon_color text default '#e77b86',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null,
  name text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key default 'main',
  payment_qr_url text,
  pickup_address text,
  payment_instructions text,
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_order_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  tracking_token uuid not null default gen_random_uuid(),
  customer_id uuid,
  customer_name text not null,
  customer_phone text not null,
  total numeric(10,2) not null default 0,
  fulfillment_method text not null,
  department text,
  shipping_province text,
  city text,
  address text,
  reference text,
  shipping_recipient_name text,
  shipping_recipient_phone text,
  shipping_recipient_ci text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  delivery_accuracy_m double precision,
  payment_receipt_path text,
  payment_status text not null default 'pending_review',
  payment_confirmed_at timestamptz,
  order_status text not null default 'received',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  product_id text,
  product_name text not null,
  variant_id text,
  variant_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Compatibilidad si una ejecución anterior dejó tablas incompletas.
alter table public.products add column if not exists category_id text;
alter table public.products add column if not exists short_name text;
alter table public.products add column if not exists subtitle text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists price numeric(10,2) not null default 0;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists spoon_color text default '#e77b86';
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.product_variants add column if not exists product_id text;
alter table public.product_variants add column if not exists description text;
alter table public.product_variants add column if not exists image_url text;
alter table public.product_variants add column if not exists active boolean not null default true;
alter table public.product_variants add column if not exists sort_order integer not null default 0;
alter table public.product_variants add column if not exists created_at timestamptz not null default now();
alter table public.product_variants add column if not exists updated_at timestamptz not null default now();

alter table public.site_settings add column if not exists payment_qr_url text;
alter table public.site_settings add column if not exists pickup_address text;
alter table public.site_settings add column if not exists payment_instructions text;
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

alter table public.customers add column if not exists name text;
alter table public.customers add column if not exists phone text;
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists last_order_at timestamptz not null default now();

alter table public.orders add column if not exists tracking_token uuid not null default gen_random_uuid();
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists total numeric(10,2) not null default 0;
alter table public.orders add column if not exists fulfillment_method text;
alter table public.orders add column if not exists department text;
alter table public.orders add column if not exists shipping_province text;
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists reference text;
alter table public.orders add column if not exists shipping_recipient_name text;
alter table public.orders add column if not exists shipping_recipient_phone text;
alter table public.orders add column if not exists shipping_recipient_ci text;
alter table public.orders add column if not exists delivery_latitude double precision;
alter table public.orders add column if not exists delivery_longitude double precision;
alter table public.orders add column if not exists delivery_accuracy_m double precision;
alter table public.orders add column if not exists payment_receipt_path text;
alter table public.orders add column if not exists payment_status text not null default 'pending_review';
alter table public.orders add column if not exists payment_confirmed_at timestamptz;
alter table public.orders add column if not exists order_status text not null default 'received';
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists created_at timestamptz not null default now();
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.order_items add column if not exists product_id text;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists variant_id text;
alter table public.order_items add column if not exists variant_name text;
alter table public.order_items add column if not exists quantity integer not null default 1;
alter table public.order_items add column if not exists unit_price numeric(10,2);
alter table public.order_items add column if not exists subtotal numeric(10,2);
alter table public.order_items add column if not exists created_at timestamptz not null default now();

-- ============================================================
-- 3) CONSTRAINTS E INDICES
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_category_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_variants_product_id_fkey'
      and conrelid = 'public.product_variants'::regclass
  ) then
    alter table public.product_variants
      add constraint product_variants_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_order_id_fkey'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_product_id_fkey'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_product_id_fkey
      foreign key (product_id) references public.products(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_variant_id_fkey'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_variant_id_fkey
      foreign key (variant_id) references public.product_variants(id) on delete set null;
  end if;
end $$;

-- Constraints que podemos recrear con nombre conocido.
alter table public.products drop constraint if exists products_price_check;
alter table public.products add constraint products_price_check check (price >= 0);

alter table public.orders drop constraint if exists orders_total_check;
alter table public.orders add constraint orders_total_check check (total >= 0);

alter table public.orders drop constraint if exists orders_fulfillment_method_check;
alter table public.orders add constraint orders_fulfillment_method_check
  check (fulfillment_method in ('pickup','delivery','national'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending_review','confirmed','rejected'));

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('received','preparing','ready','shipped','completed','cancelled'));

alter table public.order_items drop constraint if exists order_items_quantity_check;
alter table public.order_items add constraint order_items_quantity_check check (quantity between 1 and 20);

alter table public.order_items drop constraint if exists order_items_unit_price_check;
alter table public.order_items add constraint order_items_unit_price_check check (unit_price >= 0);

alter table public.order_items drop constraint if exists order_items_subtotal_check;
alter table public.order_items add constraint order_items_subtotal_check check (subtotal >= 0);

create unique index if not exists uq_customers_phone on public.customers(phone);
create unique index if not exists uq_orders_order_code on public.orders(order_code);
create unique index if not exists uq_orders_tracking_token on public.orders(tracking_token);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_customers_last_order on public.customers(last_order_at desc);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

-- ============================================================
-- 4) TRIGGERS
-- ============================================================

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_variants_updated_at on public.product_variants;
create trigger trg_variants_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.site_settings;
create trigger trg_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.set_payment_confirmed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'confirmed' then
      new.payment_confirmed_at = now();
    else
      new.payment_confirmed_at = null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_payment_confirmed_at on public.orders;
create trigger trg_orders_payment_confirmed_at
before update of payment_status on public.orders
for each row execute function public.set_payment_confirmed_at();

-- ============================================================
-- 5) CONFIGURACION Y DATOS INICIALES
-- ============================================================

insert into public.site_settings (
  id,
  payment_qr_url,
  pickup_address,
  payment_instructions
)
values (
  'main',
  'assets/qr-banco-bisa.png',
  'Sweet by Sami · Cochabamba · ubicación exacta en Google Maps',
  'Escanea el QR, realiza el pago y luego adjunta una captura de tu comprobante.'
)
on conflict (id) do nothing;

insert into public.categories (id,name,description,active,sort_order)
values
  ('spoons','Scoops','Elige P, M o G y después selecciona la presentación disponible para tu cajita.',true,1),
  ('boxes','Cajas','Opciones especiales con productos completos y snacks variados para regalar o compartir.',true,2)
on conflict (id) do nothing;

-- Migra el nombre anterior si existiera.
update public.categories
set name = 'Scoops', updated_at = now()
where id = 'spoons' and lower(name) = 'cucharas';

insert into public.products (
  id,category_id,name,short_name,subtitle,description,price,image_url,spoon_color,active,sort_order
)
values
  ('p','spoons','Scoop P','P','La más pequeña','Pequeña, bonita y llena de dulces sorpresas.',45,'assets/cuchara-p.jpg','#eb7f93',true,1),
  ('m','spoons','Scoop M','M','Tamaño mediano','Más perlitas, más emoción y una cajita personalizada.',75,'assets/cuchara-m.jpg','#e5b43e',true,2),
  ('g','spoons','Scoop G','G','La más grande','La experiencia más grande para quienes quieren más sorpresa.',145,'assets/cuchara-g.jpg','#9fd8ef',true,3),
  ('mega-box','boxes','Mega Caja','MEGA','La experiencia completa','Una caja especial con paquetes de productos enteros y snacks variados, preparada para sorprender.',250,'assets/mega-caja.png','#ef7da5',true,1)
on conflict (id) do nothing;

update public.products set name='Scoop P' where id='p' and lower(name) like 'cuchara%';
update public.products set name='Scoop M' where id='m' and lower(name) like 'cuchara%';
update public.products set name='Scoop G' where id='g' and lower(name) like 'cuchara%';

insert into public.product_variants (id,product_id,name,description,active,sort_order)
values
  ('p-1','p','Diseño 1','Primera presentación disponible para el Scoop P.',true,1),
  ('p-2','p','Diseño 2','Segunda presentación disponible para el Scoop P.',true,2),
  ('p-3','p','Diseño 3','Tercera presentación disponible para el Scoop P.',true,3),
  ('m-1','m','Caja blanca personalizada','Presentación blanca lista para personalizar con lettering.',true,1),
  ('g-1','g','Diseño Sweet G','Presentación especial del Scoop G, ya personalizada.',true,1),
  ('mega-box-1','mega-box','Mega Caja Sweet','Presentación especial con productos completos y snacks variados. El contenido visual es referencial.',true,1)
on conflict (id) do nothing;

-- Imagen actual de Mega Caja.
update public.products
set image_url = 'assets/mega-caja.png', updated_at = now()
where id = 'mega-box';

update public.product_variants
set image_url = 'assets/mega-caja.png', updated_at = now()
where id = 'mega-box-1';

-- ============================================================
-- 6) STORAGE
-- ============================================================

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'product-images','product-images',true,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'site-assets','site-assets',true,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'payment-receipts','payment-receipts',false,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 7) RPC PUBLICA PARA CREAR PEDIDOS
-- ============================================================

create or replace function public.create_public_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_code text;
  v_tracking_token uuid := gen_random_uuid();
  v_phone text;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_receipt_path text;
  v_method text;
  v_lat double precision;
  v_lng double precision;
begin
  if p_payload is null then
    raise exception 'Datos de pedido inválidos';
  end if;

  if coalesce(length(trim(p_payload->>'customer_name')),0) < 2 then
    raise exception 'Nombre inválido';
  end if;

  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''), '\D', '', 'g');
  if length(v_phone) < 7 then
    raise exception 'Teléfono inválido';
  end if;

  v_method := coalesce(p_payload->>'fulfillment_method','');
  if v_method not in ('pickup','delivery','national') then
    raise exception 'Método de entrega inválido';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0
     or jsonb_array_length(p_payload->'items') > 50 then
    raise exception 'Pedido vacío o demasiado grande';
  end if;

  v_receipt_path := nullif(trim(coalesce(p_payload->>'payment_receipt_path','')),'');
  if v_receipt_path is null or v_receipt_path not like 'checkout/%' then
    raise exception 'Comprobante de pago inválido';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'payment-receipts'
      and name = v_receipt_path
  ) then
    raise exception 'No se encontró el comprobante de pago';
  end if;

  if nullif(p_payload->>'delivery_latitude','') is not null then
    v_lat := (p_payload->>'delivery_latitude')::double precision;
    if v_lat < -90 or v_lat > 90 then raise exception 'Latitud inválida'; end if;
  end if;

  if nullif(p_payload->>'delivery_longitude','') is not null then
    v_lng := (p_payload->>'delivery_longitude')::double precision;
    if v_lng < -180 or v_lng > 180 then raise exception 'Longitud inválida'; end if;
  end if;

  if v_method = 'delivery' then
    if nullif(trim(coalesce(p_payload->>'address','')),'') is null
       and (v_lat is null or v_lng is null) then
      raise exception 'Selecciona una ubicación o escribe una dirección para el delivery';
    end if;
  end if;

  if v_method = 'national' then
    if nullif(trim(coalesce(p_payload->>'city','')),'') is null then
      raise exception 'Selecciona la ciudad de destino';
    end if;
    if nullif(trim(coalesce(p_payload->>'address','')),'') is null then
      raise exception 'Ingresa la dirección o agencia de destino';
    end if;
  end if;

  -- Calcula el total únicamente con precios reales de la BD.
  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then
      v_qty := (v_item->>'quantity')::integer;
    else
      v_qty := 1;
    end if;
    v_qty := greatest(1, least(20, v_qty));

    select p.* into v_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = v_item->>'product_id'
      and p.active = true
      and c.active = true;

    if not found then
      raise exception 'Producto no disponible';
    end if;

    select * into v_variant
    from public.product_variants
    where id = v_item->>'variant_id'
      and product_id = v_product.id
      and active = true;

    if not found then
      raise exception 'Variante no disponible';
    end if;

    v_total := v_total + (v_product.price * v_qty);
  end loop;

  if v_total <= 0 then
    raise exception 'Total de pedido inválido';
  end if;

  v_order_code := 'SBS-'
    || to_char(now(),'YYMMDD')
    || '-'
    || upper(substr(encode(gen_random_bytes(5),'hex'),1,6));

  insert into public.customers(name,phone,last_order_at)
  values (trim(p_payload->>'customer_name'), v_phone, now())
  on conflict (phone) do update set
    name = excluded.name,
    last_order_at = now(),
    updated_at = now()
  returning id into v_customer_id;

  insert into public.orders(
    order_code,
    tracking_token,
    customer_id,
    customer_name,
    customer_phone,
    total,
    fulfillment_method,
    city,
    address,
    reference,
    delivery_latitude,
    delivery_longitude,
    delivery_accuracy_m,
    payment_receipt_path
  )
  values (
    v_order_code,
    v_tracking_token,
    v_customer_id,
    trim(p_payload->>'customer_name'),
    v_phone,
    v_total,
    v_method,
    nullif(trim(coalesce(p_payload->>'city','')),''),
    nullif(trim(coalesce(p_payload->>'address','')),''),
    nullif(trim(coalesce(p_payload->>'reference','')),''),
    v_lat,
    v_lng,
    case
      when nullif(p_payload->>'delivery_accuracy_m','') is null then null
      else greatest(0, (p_payload->>'delivery_accuracy_m')::double precision)
    end,
    v_receipt_path
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then
      v_qty := (v_item->>'quantity')::integer;
    else
      v_qty := 1;
    end if;
    v_qty := greatest(1, least(20, v_qty));

    select * into v_product
    from public.products
    where id = v_item->>'product_id';

    select * into v_variant
    from public.product_variants
    where id = v_item->>'variant_id'
      and product_id = v_product.id;

    insert into public.order_items(
      order_id,
      product_id,
      product_name,
      variant_id,
      variant_name,
      quantity,
      unit_price,
      subtotal
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_variant.id,
      v_variant.name,
      v_qty,
      v_product.price,
      v_product.price * v_qty
    );
  end loop;

  return jsonb_build_object(
    'order_code', v_order_code,
    'tracking_token', v_tracking_token,
    'total', v_total
  );
end;
$$;

-- El comprador consulta solamente el estado usando código + token privado.
create or replace function public.get_public_order_status(
  p_order_code text,
  p_tracking_token uuid
)
returns table(
  order_code text,
  payment_status text,
  order_status text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    o.order_code,
    o.payment_status,
    o.order_status,
    o.updated_at
  from public.orders o
  where o.order_code = p_order_code
    and o.tracking_token = p_tracking_token
  limit 1;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

revoke all on function public.get_public_order_status(text,uuid) from public;
grant execute on function public.get_public_order_status(text,uuid) to anon, authenticated;

-- ============================================================
-- 8) DATA API + ROW LEVEL SECURITY
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.site_settings to anon, authenticated;

grant select, insert, update, delete on
  public.categories,
  public.products,
  public.product_variants,
  public.site_settings,
  public.customers,
  public.orders,
  public.order_items
  to authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.site_settings enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Limpiamos políticas anteriores de este proyecto.
drop policy if exists "categories_public_read" on public.categories;
drop policy if exists "products_public_read" on public.products;
drop policy if exists "variants_public_read" on public.product_variants;
drop policy if exists "settings_public_read" on public.site_settings;
drop policy if exists "categories_admin_all" on public.categories;
drop policy if exists "products_admin_all" on public.products;
drop policy if exists "variants_admin_all" on public.product_variants;
drop policy if exists "settings_admin_all" on public.site_settings;
drop policy if exists "customers_admin_all" on public.customers;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "order_items_admin_all" on public.order_items;

-- Lectura pública únicamente de catálogo visible/configuración.
create policy "categories_public_read"
on public.categories
for select
to anon, authenticated
using (active = true);

create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (active = true);

create policy "variants_public_read"
on public.product_variants
for select
to anon, authenticated
using (active = true);

create policy "settings_public_read"
on public.site_settings
for select
to anon, authenticated
using (id = 'main');

-- Única cuenta administrativa autorizada.
create policy "categories_admin_all"
on public.categories
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "products_admin_all"
on public.products
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "variants_admin_all"
on public.product_variants
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "settings_admin_all"
on public.site_settings
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "customers_admin_all"
on public.customers
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "orders_admin_all"
on public.orders
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

create policy "order_items_admin_all"
on public.order_items
for all
to authenticated
using (public.is_sweet_admin())
with check (public.is_sweet_admin());

-- ============================================================
-- 9) STORAGE RLS
-- ============================================================

drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "site_assets_public_read" on storage.objects;
drop policy if exists "product_images_admin_all" on storage.objects;
drop policy if exists "site_assets_admin_all" on storage.objects;
drop policy if exists "receipts_admin_read" on storage.objects;
drop policy if exists "receipts_admin_delete" on storage.objects;
drop policy if exists "receipts_admin_all" on storage.objects;
drop policy if exists "receipts_public_upload" on storage.objects;

-- Los buckets product-images y site-assets son públicos para servir imágenes.
create policy "product_images_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "site_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-assets');

create policy "product_images_admin_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_sweet_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_sweet_admin()
);

create policy "site_assets_admin_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'site-assets'
  and public.is_sweet_admin()
)
with check (
  bucket_id = 'site-assets'
  and public.is_sweet_admin()
);

-- El comprobante permanece privado. Solo admin puede verlo/borrarlo.
create policy "receipts_admin_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.is_sweet_admin()
)
with check (
  bucket_id = 'payment-receipts'
  and public.is_sweet_admin()
);

-- Checkout anónimo: solamente INSERT en la carpeta checkout/.
create policy "receipts_public_upload"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = 'checkout'
);

-- Fuerza a Data API/PostgREST a refrescar tablas, columnas, funciones y
-- relaciones recién creadas o modificadas.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 10) FINAL
-- ============================================================

-- IMPORTANTE:
-- 1. Crea manualmente en Authentication > Users:
--    cadenasamantha037@gmail.com
-- 2. Luego desactiva el registro público de usuarios.
-- 3. NO pongas service_role/secret keys en el frontend.
-- ============================================================

-- ============================================================
-- ACTUALIZACIÓN V20 INTEGRADA
-- ============================================================

-- ============================================================
-- SWEET BY SAMI · ACTUALIZACIÓN V20
-- Ejecutar DESPUÉS del SQL V19 si la base ya existe.
-- No borra pedidos, clientes, productos ni comprobantes.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) CONFIGURACIÓN DE ENTREGA, HORARIOS Y CONTADOR
-- ------------------------------------------------------------
alter table public.site_settings add column if not exists pickup_map_url text;
alter table public.site_settings add column if not exists pickup_hours text;
alter table public.site_settings add column if not exists danae_map_url text;
alter table public.site_settings add column if not exists danae_location_name text;
alter table public.site_settings add column if not exists danae_hours text;
alter table public.site_settings add column if not exists coordination_phone_1 text;
alter table public.site_settings add column if not exists coordination_phone_2 text;
alter table public.site_settings add column if not exists historical_order_count integer not null default 500;
alter table public.site_settings add column if not exists milestone_target integer not null default 1000;

update public.site_settings
set
  pickup_address = case when pickup_address is null or trim(pickup_address) = '' or pickup_address = 'Cochabamba · dirección de recojo por confirmar' then 'Sweet by Sami · Cochabamba · ubicación exacta en Google Maps' else pickup_address end,
  pickup_map_url = 'https://maps.app.goo.gl/FsLshw8DKRAXytGF9',
  pickup_hours = coalesce(nullif(trim(pickup_hours),''), '7:30 a 9:00 am · 2:00 a 3:00 pm'),
  danae_map_url = coalesce(nullif(trim(danae_map_url),''), 'https://maps.app.goo.gl/YHXgj9gWhiJ3pkgH7?g_st=awb'),
  danae_location_name = coalesce(nullif(trim(danae_location_name),''), 'Paquetería DANAE · 1er piso · local 20'),
  danae_hours = coalesce(nullif(trim(danae_hours),''), 'Lunes a viernes · 8:00 am a 8:30 pm'),
  coordination_phone_1 = coalesce(nullif(trim(coordination_phone_1),''), '59172947659'),
  coordination_phone_2 = coalesce(nullif(trim(coordination_phone_2),''), '59164329209'),
  historical_order_count = greatest(0, coalesce(historical_order_count,500)),
  milestone_target = greatest(1, coalesce(milestone_target,1000))
where id = 'main';

-- ------------------------------------------------------------
-- 2) NUEVOS DATOS DEL PEDIDO
-- ------------------------------------------------------------
alter table public.orders add column if not exists department text;
alter table public.orders add column if not exists shipping_province text;
alter table public.orders add column if not exists preparation_mode text not null default 'live';
alter table public.orders add column if not exists payment_method text not null default 'qr';
alter table public.orders add column if not exists order_serial bigint;

-- Retiramos primero el constraint anterior para poder migrar el valor legacy `delivery`.
alter table public.orders drop constraint if exists orders_fulfillment_method_check;

update public.orders set fulfillment_method = 'customer_delivery' where fulfillment_method = 'delivery';
update public.orders set preparation_mode = 'live' where preparation_mode is null or preparation_mode not in ('live','tiktok');
update public.orders set payment_method = 'qr' where payment_method is null or payment_method not in ('qr','cash');

-- Secuencia interna para el contador de pedidos nuevos del sistema.
create sequence if not exists public.sweet_order_serial_seq start with 1 increment by 1;
alter table public.orders alter column order_serial set default nextval('public.sweet_order_serial_seq'::regclass);

-- Asigna serial a pedidos existentes que aún no lo tengan, respetando su orden temporal.
do $$
declare r record;
begin
  for r in
    select id from public.orders where order_serial is null order by created_at asc, id asc
  loop
    update public.orders set order_serial = nextval('public.sweet_order_serial_seq'::regclass) where id = r.id;
  end loop;
end $$;

do $$
declare v_max_serial bigint;
begin
  select max(order_serial) into v_max_serial from public.orders;
  if coalesce(v_max_serial,0) > 0 then
    perform setval('public.sweet_order_serial_seq'::regclass, v_max_serial, true);
  else
    -- `false` hace que el primer nextval() sea 1, no 2.
    perform setval('public.sweet_order_serial_seq'::regclass, 1, false);
  end if;
end $$;
alter table public.orders alter column order_serial set not null;
create unique index if not exists uq_orders_order_serial on public.orders(order_serial);

alter table public.orders add constraint orders_fulfillment_method_check
  check (fulfillment_method in ('pickup','customer_delivery','national','danae'));

alter table public.orders drop constraint if exists orders_preparation_mode_check;
alter table public.orders add constraint orders_preparation_mode_check
  check (preparation_mode in ('live','tiktok'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('qr','cash'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending_review','cash_pending','confirmed','rejected'));

-- ------------------------------------------------------------
-- 3) EFECTIVO SOLO PARA EL PRIMER PEDIDO
-- ------------------------------------------------------------
create or replace function public.check_cash_eligibility(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
begin
  v_phone := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  if length(v_phone) = 8 then v_phone := '591' || v_phone; end if;
  if length(v_phone) <> 11 or left(v_phone,3) <> '591' then return false; end if;
  return not exists (
    select 1 from public.orders o where o.customer_phone = v_phone
  );
end;
$$;

revoke all on function public.check_cash_eligibility(text) from public;
grant execute on function public.check_cash_eligibility(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) CREACIÓN PÚBLICA DE PEDIDOS V20
-- ------------------------------------------------------------
create or replace function public.create_public_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, extensions, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_code text;
  v_tracking_token uuid := gen_random_uuid();
  v_phone text;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_receipt_path text;
  v_method text;
  v_payment_method text;
  v_preparation_mode text;
  v_department text;
  v_shipping_province text;
  v_shipping_recipient_name text;
  v_shipping_recipient_phone text;
  v_shipping_recipient_ci text;
  v_order_serial bigint;
  v_historical_count integer := 0;
begin
  if p_payload is null then raise exception 'Datos de pedido inválidos'; end if;
  if coalesce(length(trim(p_payload->>'customer_name')),0) < 2 then raise exception 'Nombre inválido'; end if;

  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''), '\D', '', 'g');
  if length(v_phone) = 8 then v_phone := '591' || v_phone; end if;
  if length(v_phone) <> 11 or left(v_phone,3) <> '591' then
    raise exception 'Teléfono inválido. Escribe los 8 dígitos de tu celular.';
  end if;

  -- Evita dos primeros pedidos en efectivo simultáneos con el mismo número.
  perform pg_advisory_xact_lock(hashtext(v_phone));

  v_method := coalesce(p_payload->>'fulfillment_method','');
  if v_method not in ('pickup','customer_delivery','national','danae') then raise exception 'Método de entrega inválido'; end if;

  v_preparation_mode := coalesce(p_payload->>'preparation_mode','live');
  if v_preparation_mode not in ('live','tiktok') then raise exception 'Tipo de armado inválido'; end if;

  v_payment_method := coalesce(p_payload->>'payment_method','qr');
  if v_payment_method not in ('qr','cash') then raise exception 'Método de pago inválido'; end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0
     or jsonb_array_length(p_payload->'items') > 50 then
    raise exception 'Pedido vacío o demasiado grande';
  end if;

  v_receipt_path := nullif(trim(coalesce(p_payload->>'payment_receipt_path','')),'');
  if v_payment_method = 'qr' then
    if v_receipt_path is null or v_receipt_path not like 'checkout/%' then raise exception 'Comprobante de pago inválido'; end if;
    if not exists (select 1 from storage.objects where bucket_id='payment-receipts' and name=v_receipt_path) then
      raise exception 'No se encontró el comprobante de pago';
    end if;
  else
    if exists (select 1 from public.orders o where o.customer_phone = v_phone) then
      raise exception 'El pago en efectivo solo está disponible para el primer pedido';
    end if;
    v_receipt_path := null;
  end if;

  if v_method = 'national' then
    v_department := nullif(trim(coalesce(p_payload->>'department','')),'');
    if v_department is null or v_department not in ('Beni','Chuquisaca','Cochabamba','La Paz','Oruro','Potosí','Santa Cruz','Tarija') then
      raise exception 'Selecciona un departamento habilitado para envíos nacionales';
    end if;
    if v_department = 'Cochabamba' then
      v_shipping_province := nullif(trim(coalesce(p_payload->>'shipping_province','')),'');
      if v_shipping_province is null or v_shipping_province not in ('Ivirgarzama','Eterazama','Mariposas') then
        raise exception 'Selecciona un destino habilitado para Cochabamba';
      end if;
    else
      -- Ningún departamento fuera de Cochabamba admite envíos a provincias.
      if nullif(trim(coalesce(p_payload->>'shipping_province','')),'') is not null
         or nullif(trim(coalesce(p_payload->>'city','')),'') is not null then
        raise exception 'Fuera de Cochabamba no realizamos envíos a provincias';
      end if;
      v_shipping_province := null;
    end if;

    if nullif(trim(coalesce(p_payload->>'address','')),'') is null then
      raise exception 'Ingresa la dirección o agencia de destino';
    end if;

    v_shipping_recipient_name := nullif(trim(coalesce(p_payload->>'shipping_recipient_name','')),'');
    if v_shipping_recipient_name is null or length(v_shipping_recipient_name) < 3 then
      raise exception 'Ingresa el nombre completo del destinatario';
    end if;

    v_shipping_recipient_phone := regexp_replace(coalesce(p_payload->>'shipping_recipient_phone',''), '\D', '', 'g');
    if length(v_shipping_recipient_phone) = 8 then v_shipping_recipient_phone := '591' || v_shipping_recipient_phone; end if;
    if length(v_shipping_recipient_phone) <> 11 or left(v_shipping_recipient_phone,3) <> '591' then
      raise exception 'Celular del destinatario inválido. Escribe los 8 dígitos.';
    end if;

    v_shipping_recipient_ci := nullif(trim(coalesce(p_payload->>'shipping_recipient_ci','')),'');
    if v_shipping_recipient_ci is null or length(v_shipping_recipient_ci) < 4 or length(v_shipping_recipient_ci) > 20 then
      raise exception 'Ingresa un número de carnet válido para el destinatario';
    end if;
  else
    v_department := null;
    v_shipping_province := null;
    v_shipping_recipient_name := null;
    v_shipping_recipient_phone := null;
    v_shipping_recipient_ci := null;
  end if;

  -- Total calculado únicamente con precios reales de la base.
  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then v_qty := (v_item->>'quantity')::integer; else v_qty := 1; end if;
    v_qty := greatest(1,least(20,v_qty));

    select p.* into v_product
    from public.products p
    join public.categories c on c.id=p.category_id
    where p.id=v_item->>'product_id' and p.active=true and c.active=true;
    if not found then raise exception 'Producto no disponible'; end if;

    select * into v_variant from public.product_variants
    where id=v_item->>'variant_id' and product_id=v_product.id and active=true;
    if not found then raise exception 'Variante no disponible'; end if;

    v_total := v_total + (v_product.price*v_qty);
  end loop;
  if v_total <= 0 then raise exception 'Total de pedido inválido'; end if;

  v_order_code := 'SBS-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,6));

  insert into public.customers(name,phone,last_order_at)
  values(trim(p_payload->>'customer_name'),v_phone,now())
  on conflict(phone) do update set name=excluded.name,last_order_at=now(),updated_at=now()
  returning id into v_customer_id;

  insert into public.orders(
    order_code,tracking_token,customer_id,customer_name,customer_phone,total,
    fulfillment_method,department,shipping_province,city,address,reference,
    shipping_recipient_name,shipping_recipient_phone,shipping_recipient_ci,
    preparation_mode,payment_method,payment_receipt_path,payment_status
  ) values (
    v_order_code,v_tracking_token,v_customer_id,trim(p_payload->>'customer_name'),v_phone,v_total,
    v_method,v_department,v_shipping_province,
    case when v_method='national' then null else nullif(trim(coalesce(p_payload->>'city','')),'') end,
    nullif(trim(coalesce(p_payload->>'address','')),''),nullif(trim(coalesce(p_payload->>'reference','')),''),
    v_shipping_recipient_name,v_shipping_recipient_phone,v_shipping_recipient_ci,
    v_preparation_mode,v_payment_method,v_receipt_path,
    case when v_payment_method='cash' then 'cash_pending' else 'pending_review' end
  ) returning id,order_serial into v_order_id,v_order_serial;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then v_qty := (v_item->>'quantity')::integer; else v_qty := 1; end if;
    v_qty := greatest(1,least(20,v_qty));
    select * into v_product from public.products where id=v_item->>'product_id';
    select * into v_variant from public.product_variants where id=v_item->>'variant_id' and product_id=v_product.id;
    insert into public.order_items(order_id,product_id,product_name,variant_id,variant_name,quantity,unit_price,subtotal)
    values(v_order_id,v_product.id,v_product.name,v_variant.id,v_variant.name,v_qty,v_product.price,v_product.price*v_qty);
  end loop;

  select coalesce(historical_order_count,0) into v_historical_count from public.site_settings where id='main';

  return jsonb_build_object(
    'order_code',v_order_code,
    'tracking_token',v_tracking_token,
    'total',v_total,
    'order_serial',v_order_serial,
    'display_order_number',v_historical_count+v_order_serial,
    'payment_method',v_payment_method
  );
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) ESTADO PÚBLICO DEL PEDIDO
-- ------------------------------------------------------------
drop function if exists public.get_public_order_status(text,uuid);
create function public.get_public_order_status(p_order_code text,p_tracking_token uuid)
returns table(
  order_code text,
  payment_status text,
  order_status text,
  payment_method text,
  order_serial bigint,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select o.order_code,o.payment_status,o.order_status,o.payment_method,o.order_serial,o.updated_at
  from public.orders o
  where o.order_code=p_order_code and o.tracking_token=p_tracking_token
  limit 1;
$$;

revoke all on function public.get_public_order_status(text,uuid) from public;
grant execute on function public.get_public_order_status(text,uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 6) REALTIME DE PEDIDOS PARA LAS ALERTAS DEL ADMIN
-- ------------------------------------------------------------
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
exception when duplicate_object then null;
end $$;

commit;

-- Fuerza a PostgREST a refrescar el esquema.
notify pgrst, 'reload schema';


-- ============================================================
-- V26 · reglas finales de envíos nacionales
-- Pando no está habilitado. Solo Cochabamba admite destinos provinciales:
-- Ivirgarzama, Eterazama y Mariposas. Ningún otro departamento admite provincia.
-- ============================================================


-- ============================================================
-- V33 · adelanto de Bs. 20 para envíos provinciales de Cochabamba
-- Ivirgarzama, Eterazama y Mariposas. Si el costo real es menor,
-- la diferencia se reembolsa al cliente.
-- ============================================================
-- Sweet by Sami · V33 · adelanto de envío provincial Cochabamba
-- Ejecuta este archivo UNA VEZ sobre la base actual.
-- No borra pedidos, clientes, productos ni comprobantes.



alter table public.orders add column if not exists shipping_fee numeric(10,2) not null default 0;

create or replace function public.create_public_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, extensions, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_code text;
  v_tracking_token uuid := gen_random_uuid();
  v_phone text;
  v_total numeric(10,2) := 0;
  v_shipping_fee numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_receipt_path text;
  v_method text;
  v_payment_method text;
  v_preparation_mode text;
  v_department text;
  v_shipping_province text;
  v_shipping_recipient_name text;
  v_shipping_recipient_phone text;
  v_shipping_recipient_ci text;
  v_order_serial bigint;
  v_historical_count integer := 0;
begin
  if p_payload is null then raise exception 'Datos de pedido inválidos'; end if;
  if coalesce(length(trim(p_payload->>'customer_name')),0) < 2 then raise exception 'Nombre inválido'; end if;

  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''), '\D', '', 'g');
  if length(v_phone) = 8 then v_phone := '591' || v_phone; end if;
  if length(v_phone) <> 11 or left(v_phone,3) <> '591' then
    raise exception 'Teléfono inválido. Escribe los 8 dígitos de tu celular.';
  end if;

  -- Evita dos primeros pedidos en efectivo simultáneos con el mismo número.
  perform pg_advisory_xact_lock(hashtext(v_phone));

  v_method := coalesce(p_payload->>'fulfillment_method','');
  if v_method not in ('pickup','customer_delivery','national','danae') then raise exception 'Método de entrega inválido'; end if;

  v_preparation_mode := coalesce(p_payload->>'preparation_mode','live');
  if v_preparation_mode not in ('live','tiktok') then raise exception 'Tipo de armado inválido'; end if;

  v_payment_method := coalesce(p_payload->>'payment_method','qr');
  if v_payment_method not in ('qr','cash') then raise exception 'Método de pago inválido'; end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0
     or jsonb_array_length(p_payload->'items') > 50 then
    raise exception 'Pedido vacío o demasiado grande';
  end if;

  v_receipt_path := nullif(trim(coalesce(p_payload->>'payment_receipt_path','')),'');
  if v_payment_method = 'qr' then
    if v_receipt_path is null or v_receipt_path not like 'checkout/%' then raise exception 'Comprobante de pago inválido'; end if;
    if not exists (select 1 from storage.objects where bucket_id='payment-receipts' and name=v_receipt_path) then
      raise exception 'No se encontró el comprobante de pago';
    end if;
  else
    if exists (select 1 from public.orders o where o.customer_phone = v_phone) then
      raise exception 'El pago en efectivo solo está disponible para el primer pedido';
    end if;
    v_receipt_path := null;
  end if;

  if v_method = 'national' then
    v_department := nullif(trim(coalesce(p_payload->>'department','')),'');
    if v_department is null or v_department not in ('Beni','Chuquisaca','Cochabamba','La Paz','Oruro','Potosí','Santa Cruz','Tarija') then
      raise exception 'Selecciona un departamento habilitado para envíos nacionales';
    end if;
    if v_department = 'Cochabamba' then
      v_shipping_province := nullif(trim(coalesce(p_payload->>'shipping_province','')),'');
      if v_shipping_province is null or v_shipping_province not in ('Ivirgarzama','Eterazama','Mariposas') then
        raise exception 'Selecciona un destino habilitado para Cochabamba';
      end if;
      v_shipping_fee := 20;
    else
      -- Ningún departamento fuera de Cochabamba admite envíos a provincias.
      if nullif(trim(coalesce(p_payload->>'shipping_province','')),'') is not null
         or nullif(trim(coalesce(p_payload->>'city','')),'') is not null then
        raise exception 'Fuera de Cochabamba no realizamos envíos a provincias';
      end if;
      v_shipping_province := null;
      v_shipping_fee := 0;
    end if;

    if nullif(trim(coalesce(p_payload->>'address','')),'') is null then
      raise exception 'Ingresa la dirección o agencia de destino';
    end if;

    v_shipping_recipient_name := nullif(trim(coalesce(p_payload->>'shipping_recipient_name','')),'');
    if v_shipping_recipient_name is null or length(v_shipping_recipient_name) < 3 then
      raise exception 'Ingresa el nombre completo del destinatario';
    end if;

    v_shipping_recipient_phone := regexp_replace(coalesce(p_payload->>'shipping_recipient_phone',''), '\D', '', 'g');
    if length(v_shipping_recipient_phone) = 8 then v_shipping_recipient_phone := '591' || v_shipping_recipient_phone; end if;
    if length(v_shipping_recipient_phone) <> 11 or left(v_shipping_recipient_phone,3) <> '591' then
      raise exception 'Celular del destinatario inválido. Escribe los 8 dígitos.';
    end if;

    v_shipping_recipient_ci := nullif(trim(coalesce(p_payload->>'shipping_recipient_ci','')),'');
    if v_shipping_recipient_ci is null or length(v_shipping_recipient_ci) < 4 or length(v_shipping_recipient_ci) > 20 then
      raise exception 'Ingresa un número de carnet válido para el destinatario';
    end if;
  else
    v_department := null;
    v_shipping_province := null;
    v_shipping_recipient_name := null;
    v_shipping_recipient_phone := null;
    v_shipping_recipient_ci := null;
    v_shipping_fee := 0;
  end if;

  -- Total calculado únicamente con precios reales de la base.
  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then v_qty := (v_item->>'quantity')::integer; else v_qty := 1; end if;
    v_qty := greatest(1,least(20,v_qty));

    select p.* into v_product
    from public.products p
    join public.categories c on c.id=p.category_id
    where p.id=v_item->>'product_id' and p.active=true and c.active=true;
    if not found then raise exception 'Producto no disponible'; end if;

    select * into v_variant from public.product_variants
    where id=v_item->>'variant_id' and product_id=v_product.id and active=true;
    if not found then raise exception 'Variante no disponible'; end if;

    v_total := v_total + (v_product.price*v_qty);
  end loop;
  if v_total <= 0 then raise exception 'Total de pedido inválido'; end if;
  -- En los tres destinos provinciales de Cochabamba el envío se cobra por adelantado.
  v_total := v_total + v_shipping_fee;

  v_order_code := 'SBS-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,6));

  insert into public.customers(name,phone,last_order_at)
  values(trim(p_payload->>'customer_name'),v_phone,now())
  on conflict(phone) do update set name=excluded.name,last_order_at=now(),updated_at=now()
  returning id into v_customer_id;

  insert into public.orders(
    order_code,tracking_token,customer_id,customer_name,customer_phone,total,shipping_fee,
    fulfillment_method,department,shipping_province,city,address,reference,
    shipping_recipient_name,shipping_recipient_phone,shipping_recipient_ci,
    preparation_mode,payment_method,payment_receipt_path,payment_status
  ) values (
    v_order_code,v_tracking_token,v_customer_id,trim(p_payload->>'customer_name'),v_phone,v_total,v_shipping_fee,
    v_method,v_department,v_shipping_province,
    case when v_method='national' then null else nullif(trim(coalesce(p_payload->>'city','')),'') end,
    nullif(trim(coalesce(p_payload->>'address','')),''),nullif(trim(coalesce(p_payload->>'reference','')),''),
    v_shipping_recipient_name,v_shipping_recipient_phone,v_shipping_recipient_ci,
    v_preparation_mode,v_payment_method,v_receipt_path,
    case when v_payment_method='cash' then 'cash_pending' else 'pending_review' end
  ) returning id,order_serial into v_order_id,v_order_serial;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    if coalesce(v_item->>'quantity','') ~ '^\d+$' then v_qty := (v_item->>'quantity')::integer; else v_qty := 1; end if;
    v_qty := greatest(1,least(20,v_qty));
    select * into v_product from public.products where id=v_item->>'product_id';
    select * into v_variant from public.product_variants where id=v_item->>'variant_id' and product_id=v_product.id;
    insert into public.order_items(order_id,product_id,product_name,variant_id,variant_name,quantity,unit_price,subtotal)
    values(v_order_id,v_product.id,v_product.name,v_variant.id,v_variant.name,v_qty,v_product.price,v_product.price*v_qty);
  end loop;

  select coalesce(historical_order_count,0) into v_historical_count from public.site_settings where id='main';

  return jsonb_build_object(
    'order_code',v_order_code,
    'tracking_token',v_tracking_token,
    'total',v_total,
    'shipping_fee',v_shipping_fee,
    'order_serial',v_order_serial,
    'display_order_number',v_historical_count+v_order_serial,
    'payment_method',v_payment_method
  );
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

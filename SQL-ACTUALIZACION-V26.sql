-- Sweet by Sami · V26 · actualización final
-- Ejecuta este archivo UNA VEZ sobre la base V25 actual.
-- No borra pedidos, clientes, productos ni comprobantes.

begin;

alter table public.orders add column if not exists shipping_province text;

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
    v_method,v_department,v_shipping_province,nullif(trim(coalesce(p_payload->>'city','')),''),
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

notify pgrst, 'reload schema';
commit;

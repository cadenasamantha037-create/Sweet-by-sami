
## V29 · Responsive final

Esta versión refuerza el responsive de inicio, catálogo, checkout, modales y administración. También añade el botón **“Mira cómo se prepara”** en Mega Caja hacia TikTok. No requiere SQL adicional.

# Sweet by Sami · V28

**Cambio V28:** el panel administrador se sincroniza automáticamente con pedidos nuevos. Realtime actualiza al instante y existe un respaldo cada 3 segundos; no requiere SQL nuevo.

# Sweet by Sami · V27 Final

Versión consolidada del sitio público, catálogo/checkout y panel administrativo conectados a Supabase.

## Para actualizar el Supabase que ya estás usando
Ejecuta **solo** `SQL-ACTUALIZACION-V27.sql` en Supabase → SQL Editor. Esta actualización no borra pedidos, clientes, productos ni comprobantes.

Si algún día se crea un proyecto de Supabase totalmente nuevo desde cero, usa `SQL-SUPABASE-COMPLETO.sql` (también disponible como `supabase/schema.sql`).

## Cambios V27
- Mega Caja añadida a la página principal debajo de los Scoops y actualizada con la imagen final.
- Envíos nacionales: **Pando no está habilitado** y **Beni sí está habilitado**.
- Si se selecciona Cochabamba, aparece una lista exclusiva de destinos/provincias: **Ivirgarzama, Eterazama y Mariposas**. En otros departamentos no aparece la opción de provincia.
- Botones de **Instagram** y **TikTok** en el pie de página.
- El QR de pago continúa visible y ahora incluye el botón **Descargar QR de pago**.
- Admin: filtro de pedidos por tipo de entrega: recojo en local, correo/DANAE, envío nacional y manda tu delivery.
- Admin: selector de mes y botón para descargar el **registro mensual de clientes en PDF**.
- Refuerzo responsive para teléfono, tablet y escritorio en inicio, catálogo, checkout y administración.

## Funciones que se mantienen
- Supabase Auth para el administrador.
- Pedidos QR con comprobante privado.
- Pago en efectivo únicamente para primera compra.
- Recojo en Sweet by Sami y ubicación en Google Maps.
- Manda tu delivery con ubicación del punto de recojo.
- Paquetería DANAE.
- Armado en LIVE o Video para TikTok.
- Seguimiento del estado de pago.
- Alertas de nuevos pedidos en el panel mientras la página esté abierta.
- Contador acumulado y meta del pedido #1000.

## Prueba recomendada
1. Ejecutar `SQL-ACTUALIZACION-V27.sql`.
2. Abrir la carpeta con Live Server; no abrir `catalogo.html` directamente con `file:///`.
3. Probar un envío nacional a Beni.
4. Probar Cochabamba y confirmar que solo aparezcan Ivirgarzama, Eterazama y Mariposas.
5. Confirmar que Pando no aparezca.
6. Descargar el QR desde checkout.
7. Crear pedidos de cada tipo y probar los filtros del Admin.
8. En Clientes, elegir un mes y descargar el PDF.
9. Revisar inicio, catálogo y admin desde un celular antes del deploy.

Consulta `DEPLOYMENT.md` para el paso final GitHub + Netlify.


## Regla de provincias V27
En envíos nacionales, la opción de destino provincial solo se habilita al seleccionar Cochabamba y permite únicamente Ivirgarzama, Eterazama o Mariposas. Los demás departamentos no admiten envíos a provincias.

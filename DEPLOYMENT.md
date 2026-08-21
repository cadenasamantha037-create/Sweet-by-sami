# Sweet by Sami V26 · Deploy

## 1. Actualizar Supabase
Para la base actual, ejecutar en **Supabase → SQL Editor**:

```text
SQL-ACTUALIZACION-V26.sql
```

No vuelvas a ejecutar migraciones viejas. La actualización V26 conserva la información existente y añade `shipping_province`, además de actualizar la validación de envíos nacionales.

Para un Supabase completamente nuevo, utilizar `SQL-SUPABASE-COMPLETO.sql`.

## 2. Probar con Live Server
Abrir el proyecto desde VS Code con Live Server y revisar:
- Mega Caja en inicio.
- Beni habilitado y Pando excluido.
- Cochabamba → Ivirgarzama / Eterazama / Mariposas.
- Botones Instagram y TikTok.
- QR visible + descarga.
- Filtros de pedidos por entrega.
- PDF mensual de clientes.
- Responsive en móvil/tablet/PC.

## 3. GitHub
Sube toda la carpeta del proyecto al repositorio. La Publishable Key de Supabase puede estar en el frontend; nunca añadas una `service_role`, secret key ni contraseña administrativa.

## 4. Netlify
Conecta el repositorio a Netlify. El proyecto es estático, por lo que no necesita comando de build; publica la raíz del proyecto.

Después del deploy prueba otra vez el flujo completo desde la URL pública: catálogo → carrito → checkout → pedido → alerta en Admin → confirmación del pago.

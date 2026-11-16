# Sistema de Taller Mecánico e Inventario

Sistema web para la gestión de un taller mecánico y su inventario, construido con **React**, **TypeScript**, **Vite** y **Supabase** en el backend.

## 🚀 Características Principales

1. **Gestión de Seguridad y Usuarios**
   - Autenticación segura.
   - Roles y permisos granulares.
   - Acceso dinámico a módulos y pantallas según permisos.

2. **Catálogos y Parametrización**
   - **Configuración Global:** Logo y nombre de la empresa parametrizables.
   - **Íconos Dinámicos:** Mapeo de íconos estáticos para mejorar rendimiento.
   - **Vehículos:** Catálogos de Marcas y Modelos de vehículos (`cat_vehicle_brands`, `cat_vehicle_models`).
   - **Inventario:** Unidades de Medida y Marcas de repuestos/insumos (`cat_measurement_units`, `cat_parts_brands`).
   - **Documentos:** Secuenciales y tipos de documentos autogenerables (`sys_document_types`).

3. **Módulo de Transacciones (Punto de Venta)**
   - Ventas e ingresos con emisión automática de secuenciales de facturación/recibos.
   - Selección rápida de productos, sucursales y bodegas.
   - Descarga automática de stock y registro en el Kardex.

## 🛠️ Tecnologías

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React
- **Backend (BaaS):** Supabase (PostgreSQL)

## 📋 Configuración Inicial y Base de Datos

Para levantar el proyecto y la base de datos, debes ejecutar los siguientes scripts SQL en tu consola de **Supabase**, en orden:

1. `database/updates/01_dynamic_icons.sql`
2. `database/updates/02_update_rpc_icons.sql`
3. `database/updates/03_sys_settings.sql`
4. `database/updates/04_automotive_catalogs.sql`
5. `database/updates/05_inventory_catalogs.sql`
6. `database/updates/06_document_types.sql`
7. `database/updates/07_default_consumidor_final.sql`
8. `database/updates/08_oil_changes.sql`

## 💻 Desarrollo Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar entorno de desarrollo:
   ```bash
   npm run dev
   ```

3. Verificar tipos de TypeScript:
   ```bash
   npx tsc --noEmit
   ```

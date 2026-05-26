-- ==========================================
-- SCRIPT DE INICIALIZACIÓN DE DATOS (SEED)
-- ==========================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para poblar tu base de datos con los catálogos y 
-- configuraciones iniciales del sistema Mechanic.

-- 1. Insertar Módulos
INSERT INTO seg_modules (id, name, description) VALUES
(1, 'Seguridad', 'Gestión de usuarios, roles y accesos al sistema'),
(2, 'Catálogos', 'Administración de clientes, productos e inventario base'),
(3, 'Transacciones', 'Módulo operativo de compras, ventas y movimientos de Kardex')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Reiniciar la secuencia de seg_modules
SELECT setval(pg_get_serial_sequence('seg_modules', 'id'), coalesce(max(id), 0) + 1, false) FROM seg_modules;

-- 2. Insertar Pantallas (Screens)
INSERT INTO seg_screens (id, module_id, name, route) VALUES
-- Pantallas de Seguridad (module_id = 1)
(1, 1, 'Usuarios', '/security/users'),
(2, 1, 'Roles', '/security/roles'),
(3, 1, 'Módulos', '/security/modules'),

-- Pantallas de Catálogos (module_id = 2)
(4, 2, 'Clientes', '/catalogs/clients'),
(5, 2, 'Productos', '/catalogs/products'),

-- Pantallas de Transacciones (module_id = 3)
(6, 3, 'Ventas', '/transactions/sales'),
(7, 3, 'Compras', '/transactions/purchases'),
(8, 3, 'Kardex', '/transactions/kardex')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, route = EXCLUDED.route;

-- Reiniciar la secuencia de seg_screens
SELECT setval(pg_get_serial_sequence('seg_screens', 'id'), coalesce(max(id), 0) + 1, false) FROM seg_screens;

-- 3. Insertar Acciones Base para las pantallas principales (CRUD Completo)
INSERT INTO seg_actions (screen_id, name, code) VALUES
-- Pantalla Usuarios (1)
(1, 'Ver Usuarios', 'USR_VIEW'),
(1, 'Crear Usuarios', 'USR_CREATE'),
(1, 'Editar Usuarios', 'USR_UPDATE'),
(1, 'Eliminar Usuarios', 'USR_DELETE'),
-- Pantalla Roles (2)
(2, 'Ver Roles', 'ROL_VIEW'),
(2, 'Crear Roles', 'ROL_CREATE'),
(2, 'Editar Roles', 'ROL_UPDATE'),
(2, 'Eliminar Roles', 'ROL_DELETE'),
-- Pantalla Módulos (3)
(3, 'Ver Módulos', 'MOD_VIEW'),
(3, 'Crear Módulos', 'MOD_CREATE'),
(3, 'Editar Módulos', 'MOD_UPDATE'),
(3, 'Eliminar Módulos', 'MOD_DELETE'),
-- Pantalla Clientes (4)
(4, 'Ver Clientes', 'CLI_VIEW'),
(4, 'Crear Clientes', 'CLI_CREATE'),
(4, 'Editar Clientes', 'CLI_UPDATE'),
(4, 'Eliminar Clientes', 'CLI_DELETE'),
-- Pantalla Productos (5)
(5, 'Ver Productos', 'PROD_VIEW'),
(5, 'Crear Productos', 'PROD_CREATE'),
(5, 'Editar Productos', 'PROD_UPDATE'),
(5, 'Eliminar Productos', 'PROD_DELETE'),
-- Pantalla Ventas (6)
(6, 'Ver Ventas', 'SALE_VIEW'),
(6, 'Crear Ventas', 'SALE_CREATE'),
(6, 'Editar Ventas', 'SALE_UPDATE'),
(6, 'Eliminar Ventas', 'SALE_DELETE'),
-- Pantalla Compras (7)
(7, 'Ver Compras', 'PURCH_VIEW'),
(7, 'Crear Compras', 'PURCH_CREATE'),
(7, 'Editar Compras', 'PURCH_UPDATE'),
(7, 'Eliminar Compras', 'PURCH_DELETE'),
-- Pantalla Kardex (8)
(8, 'Ver Kardex', 'KRDX_VIEW'),
(8, 'Crear Kardex', 'KRDX_CREATE'),
(8, 'Editar Kardex', 'KRDX_UPDATE'),
(8, 'Eliminar Kardex', 'KRDX_DELETE')
ON CONFLICT (code) DO NOTHING;

-- 4. Insertar Roles Base
INSERT INTO seg_roles (id, name, is_active) VALUES
(1, 'Super Admin', true),
(2, 'Vendedor / Cajero', true),
(3, 'Mecánico', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Reiniciar la secuencia de seg_roles
SELECT setval(pg_get_serial_sequence('seg_roles', 'id'), coalesce(max(id), 0) + 1, false) FROM seg_roles;

-- 5. Asignar todos los permisos al rol 'Super Admin' (role_id = 1)
INSERT INTO seg_role_permissions (role_id, action_id)
SELECT 1, id FROM seg_actions
ON CONFLICT (role_id, action_id) DO NOTHING;

-- 6. Insertar Tipos de Movimiento de Kardex
INSERT INTO tra_movement_types (id, name, multiplier) VALUES
(1, 'Ingreso por Compra', 1),
(2, 'Salida por Venta', -1),
(3, 'Ajuste de Inventario (Ingreso)', 1),
(4, 'Ajuste de Inventario (Merma/Pérdida)', -1)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, multiplier = EXCLUDED.multiplier;

-- Reiniciar la secuencia
SELECT setval(pg_get_serial_sequence('tra_movement_types', 'id'), coalesce(max(id), 0) + 1, false) FROM tra_movement_types;

-- 7. Insertar Impuestos por Defecto (Ej: IVA)
INSERT INTO cat_taxes (id, name, percentage, is_active) VALUES
(1, 'IVA 12%', 12.00, true),
(2, 'IVA 15%', 15.00, true),
(3, 'Exento (0%)', 0.00, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percentage = EXCLUDED.percentage;

-- Reiniciar la secuencia
SELECT setval(pg_get_serial_sequence('cat_taxes', 'id'), coalesce(max(id), 0) + 1, false) FROM cat_taxes;

-- 8. Tipos de Producto
INSERT INTO cat_product_types (id, name, description) VALUES
(1, 'Repuestos', 'Piezas de recambio mecánicas'),
(2, 'Insumos', 'Aceites, líquidos de frenos, refrigerantes'),
(3, 'Servicios', 'Mano de obra, alineación, balanceo')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Reiniciar la secuencia
SELECT setval(pg_get_serial_sequence('cat_product_types', 'id'), coalesce(max(id), 0) + 1, false) FROM cat_product_types;

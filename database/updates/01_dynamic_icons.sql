-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: Íconos Dinámicos
-- ==========================================
-- Ejecuta este script en el SQL Editor de Supabase.

-- 1. Agregar columnas a las tablas
ALTER TABLE seg_modules ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE seg_screens ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- 2. Actualizar Íconos de Módulos Base
UPDATE seg_modules SET icon = 'ShieldCheck' WHERE name = 'Seguridad';
UPDATE seg_modules SET icon = 'Contact' WHERE name = 'Catálogos';
UPDATE seg_modules SET icon = 'Receipt' WHERE name = 'Transacciones';

-- 3. Actualizar Íconos de Pantallas Base
UPDATE seg_screens SET icon = 'UsersRound' WHERE name = 'Usuarios';
UPDATE seg_screens SET icon = 'ShieldCheck' WHERE name = 'Roles';
UPDATE seg_screens SET icon = 'Blocks' WHERE name = 'Módulos';

UPDATE seg_screens SET icon = 'Contact' WHERE name = 'Clientes';
UPDATE seg_screens SET icon = 'Wrench' WHERE name = 'Productos';
UPDATE seg_screens SET icon = 'Store' WHERE name = 'Sucursales';
UPDATE seg_screens SET icon = 'Warehouse' WHERE name = 'Bodegas';

UPDATE seg_screens SET icon = 'Receipt' WHERE name = 'Ventas';
UPDATE seg_screens SET icon = 'ShoppingBasket' WHERE name = 'Compras';
UPDATE seg_screens SET icon = 'ClipboardList' WHERE name = 'Kardex';

-- Los registros que no coincidan mantendrán NULL y el frontend usará un ícono por defecto (ej. CircleDot).

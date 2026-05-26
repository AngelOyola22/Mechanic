-- ==========================================
-- SCRIPT: PRUEBA DE STOCK SÓLO SUCURSAL QUITO
-- ==========================================
-- Ejecuta este script para inyectar inventario de prueba ÚNICAMENTE 
-- a la nueva sucursal de Quito.

DO $$ 
DECLARE
    prod_rep_id BIGINT;
    prod_ins_id BIGINT;
    prod_srv_id BIGINT;
    branch_quito_id BIGINT;
    wh_quito_id BIGINT;
BEGIN
    -- 1. Obtener IDs de los productos de prueba
    SELECT id INTO prod_rep_id FROM cat_products WHERE sku = 'REP-001' LIMIT 1;
    SELECT id INTO prod_ins_id FROM cat_products WHERE sku = 'INS-001' LIMIT 1;
    SELECT id INTO prod_srv_id FROM cat_products WHERE sku = 'SRV-001' LIMIT 1;

    -- 2. CREAR BODEGA EN QUITO (Si no existe)
    SELECT id INTO branch_quito_id FROM cat_branches WHERE code = 'SUC' LIMIT 1;
    
    IF branch_quito_id IS NOT NULL THEN
        -- Insertamos una bodega para Quito si no existiera
        INSERT INTO cat_warehouses (code, name, location, branch_id)
        VALUES ('QUI-01', 'Bodega Principal Quito', 'Av. Shyris', branch_quito_id)
        ON CONFLICT (code) DO NOTHING;

        -- Obtenemos su ID
        SELECT id INTO wh_quito_id FROM cat_warehouses WHERE code = 'QUI-01' LIMIT 1;

        -- 3. INYECTAR STOCK EXCLUSIVO PARA QUITO
        IF wh_quito_id IS NOT NULL THEN
            INSERT INTO tra_product_stock (product_id, warehouse_id, quantity) 
            VALUES (prod_rep_id, wh_quito_id, 300)
            ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = 300;

            INSERT INTO tra_product_stock (product_id, warehouse_id, quantity) 
            VALUES (prod_ins_id, wh_quito_id, 15)
            ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = 15;
            
            INSERT INTO tra_product_stock (product_id, warehouse_id, quantity) 
            VALUES (prod_srv_id, wh_quito_id, 999)
            ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = 999;
        END IF;
    END IF;

END $$;

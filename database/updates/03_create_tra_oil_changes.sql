-- ==============================================================================
-- SCRIPT DE ACTUALIZACIÓN: Tabla de Historial y Recordatorios de Cambio de Aceite
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase para que
-- todos los registros de cambio de aceite y kilometraje se guarden permanentemente
-- en la nube y estén disponibles desde cualquier dispositivo, navegador o usuario.

CREATE TABLE IF NOT EXISTS tra_oil_changes (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT REFERENCES tra_sales(id) ON DELETE SET NULL,
    client_id BIGINT REFERENCES cat_clients(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) NOT NULL,
    vehicle_brand VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INTEGER,
    current_mileage INTEGER NOT NULL DEFAULT 0,
    next_change_mileage INTEGER NOT NULL DEFAULT 0,
    oil_type VARCHAR(100) DEFAULT 'Sintético 5W-30',
    notes TEXT,
    service_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas ultra rápidas por placa, cliente y fecha
CREATE INDEX IF NOT EXISTS idx_tra_oil_changes_plate ON tra_oil_changes(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_tra_oil_changes_client ON tra_oil_changes(client_id);
CREATE INDEX IF NOT EXISTS idx_tra_oil_changes_date ON tra_oil_changes(service_date);
CREATE INDEX IF NOT EXISTS idx_tra_oil_changes_sale ON tra_oil_changes(sale_id);

-- Políticas de Seguridad (RLS) para permitir lectura, inserción y actualización
ALTER TABLE tra_oil_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura completa de cambios de aceite" ON tra_oil_changes;
CREATE POLICY "Permitir lectura completa de cambios de aceite" 
ON tra_oil_changes FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Permitir insercion de cambios de aceite" ON tra_oil_changes;
CREATE POLICY "Permitir insercion de cambios de aceite" 
ON tra_oil_changes FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de cambios de aceite" ON tra_oil_changes;
CREATE POLICY "Permitir actualizacion de cambios de aceite" 
ON tra_oil_changes FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de cambios de aceite" ON tra_oil_changes;
CREATE POLICY "Permitir eliminacion de cambios de aceite" 
ON tra_oil_changes FOR DELETE 
TO public 
USING (true);

-- Otorgar permisos a los roles estándar de Supabase
GRANT ALL ON TABLE tra_oil_changes TO authenticated;
GRANT ALL ON TABLE tra_oil_changes TO anon;
GRANT ALL ON TABLE tra_oil_changes TO service_role;
GRANT ALL ON SEQUENCE tra_oil_changes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE tra_oil_changes_id_seq TO anon;
GRANT ALL ON SEQUENCE tra_oil_changes_id_seq TO service_role;

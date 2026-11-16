-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: Cliente Consumidor Final por Defecto
-- ==========================================

INSERT INTO cat_clients (document_id, name, email, phone, address, is_customer, is_supplier)
VALUES ('9999999999999', 'Consumidor Final', 'consumidorfinal@mechanic.local', '9999999999', 'S/N', true, false)
ON CONFLICT (document_id) DO NOTHING;

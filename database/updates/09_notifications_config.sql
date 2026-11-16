-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: Configuración de Notificaciones (Email & WhatsApp)
-- ==========================================

ALTER TABLE sys_settings
ADD COLUMN IF NOT EXISTS email_provider VARCHAR(50) DEFAULT 'resend',
ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
ADD COLUMN IF NOT EXISTS resend_from_email VARCHAR(255) DEFAULT 'onboarding@resend.dev',
ADD COLUMN IF NOT EXISTS resend_from_name VARCHAR(255) DEFAULT 'Taller Mecánico',
ADD COLUMN IF NOT EXISTS whatsapp_provider VARCHAR(50) DEFAULT 'ultramsg',
ADD COLUMN IF NOT EXISTS ultramsg_instance_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS ultramsg_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS whatsapp_cloud_phone_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS whatsapp_cloud_token TEXT,
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

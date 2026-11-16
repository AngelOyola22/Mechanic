import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Settings, Save, AlertCircle, Building2, Bell, Mail, MessageCircle, Send, CheckCircle2, ExternalLink } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  sendOilReminderEmail,
  sendWhatsAppNotification
} from '../../../services/notificationService';

interface SysSettings {
  id: number;
  company_name: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  currency_symbol: string;
}

export const SettingsPage = () => {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<'company' | 'notifications'>('company');
  const [settings, setSettings] = useState<SysSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State: Empresa
  const [formData, setFormData] = useState({
    company_name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    currency_symbol: '$'
  });

  // Form State: Notificaciones
  const [notificationConfig, setNotificationConfig] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testWhatsAppResult, setTestWhatsAppResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('sys_settings').select('*').single();
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found, safe to ignore
        } else {
          throw error;
        }
      }

      if (data) {
        setSettings(data);
        setFormData({
          company_name: data.company_name || '',
          ruc: data.ruc || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          logo_url: data.logo_url || '',
          currency_symbol: data.currency_symbol || '$'
        });
      }

      // Cargar configuraciones de notificaciones
      const notifData = await getNotificationSettings();
      setNotificationConfig(notifData);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('SET_UPDATE')) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (settings?.id) {
        const { error } = await supabase.from('sys_settings').update(formData).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sys_settings').insert([formData]);
        if (error) throw error;
        await fetchSettings();
      }

      setSuccess('Configuración de la empresa guardada exitosamente.');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveNotificationSettings(notificationConfig);
      setSuccess('Configuración de notificaciones y mensajería guardada exitosamente.');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar las credenciales de mensajería.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const testTo = window.prompt('Ingrese un correo de prueba para enviar el recordatorio:', formData.email || 'correo@ejemplo.com');
    if (!testTo || !testTo.includes('@')) return;

    try {
      setTestingEmail(true);
      setTestEmailResult('Enviando correo de prueba con Resend...');

      // Guardar la configuración activa para probar
      await saveNotificationSettings(notificationConfig);

      const result = await sendOilReminderEmail({
        toEmail: testTo.trim(),
        toName: 'Cliente de Prueba',
        vehiclePlate: 'ABC-1234',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Hilux 2.8',
        currentKm: 85000,
        nextKm: 90000,
        oilType: 'Sintético 5W-30',
        serviceDate: new Date().toISOString(),
        companyName: formData.company_name || 'Taller Mecánico'
      });

      if (result.success) {
        setTestEmailResult(`✅ ¡Éxito! ${result.message}`);
      } else {
        setTestEmailResult(`❌ ${result.message}`);
      }
    } catch (e: any) {
      setTestEmailResult(`❌ Error: ${e.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestWhatsApp = async () => {
    const testPhone = window.prompt('Ingrese el número de WhatsApp para la prueba (Ej. 0991234567):', formData.phone || '');
    if (!testPhone) return;

    try {
      setTestingWhatsApp(true);
      setTestWhatsAppResult('Enviando mensaje de prueba...');

      await saveNotificationSettings(notificationConfig);

      const result = await sendWhatsAppNotification({
        phone: testPhone.trim(),
        message: `🚗 *MENSAJE DE PRUEBA - ${formData.company_name || 'Taller Mecánico'}*\n\n¡La conexión automática de WhatsApp se ha configurado con éxito!`
      });

      if (result.success) {
        setTestWhatsAppResult(`✅ ¡Éxito! ${result.message}`);
      } else {
        setTestWhatsAppResult(`❌ ${result.message}`);
      }
    } catch (e: any) {
      setTestWhatsAppResult(`❌ Error: ${e.message}`);
    } finally {
      setTestingWhatsApp(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;
  }

  const canEdit = hasPermission('SET_UPDATE');

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto w-full">
      <PageHeader
        title="Configuración del Sistema"
        description="Ajusta los parámetros globales del negocio, preferencias y servicios de mensajería automática."
        icon={<Settings />}
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          <p>{success}</p>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'company'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Datos de la Empresa
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'notifications'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bell className="w-4 h-4" />
          Notificaciones y Mensajería (Email & WhatsApp)
        </button>
      </div>

      {/* TAB 1: DATOS DE LA EMPRESA */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <form onSubmit={handleSaveCompany} className="p-6 md:p-8 space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Datos Principales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Nombre Comercial / Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">RUC / Documento *</label>
                  <input
                    type="text"
                    required
                    value={formData.ruc}
                    onChange={e => setFormData({ ...formData, ruc: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Contacto y Ubicación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Dirección Matriz</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Teléfono</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Preferencias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Símbolo de Moneda</label>
                  <input
                    type="text"
                    value={formData.currency_symbol}
                    onChange={e => setFormData({ ...formData, currency_symbol: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">URL del Logo (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.logo_url}
                    onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
                    disabled={!canEdit}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20 cursor-pointer"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: NOTIFICACIONES Y MENSAJERÍA */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <form onSubmit={handleSaveNotifications} className="p-6 md:p-8 space-y-8">
            
            {/* SECCIÓN CORREO: RESEND */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Servicio de Correo Electrónico Automático (Resend)</h3>
                    <p className="text-xs text-slate-500">Envía correos en segundo plano directamente al buzón del cliente sin abrir Outlook.</p>
                  </div>
                </div>

                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 py-1.5 px-3 rounded-lg transition-colors"
                >
                  Obtener API Key Gratis <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Resend API Key *
                  </label>
                  <input
                    type="password"
                    placeholder="re_123456789abcdef..."
                    value={notificationConfig.resend_api_key}
                    onChange={e => setNotificationConfig({ ...notificationConfig, resend_api_key: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm font-mono focus:border-blue-500 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Crea una cuenta gratuita en resend.com, genera una API Key y pégala aquí.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nombre del Remitente (From Name)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Taller Mecánico"
                    value={notificationConfig.resend_from_name}
                    onChange={e => setNotificationConfig({ ...notificationConfig, resend_from_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Correo del Remitente (From Email)
                  </label>
                  <input
                    type="text"
                    placeholder="onboarding@resend.dev o notificaciones@tudominio.com"
                    value={notificationConfig.resend_from_email}
                    onChange={e => setNotificationConfig({ ...notificationConfig, resend_from_email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-blue-500 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 block">
                    Para pruebas rápidas puedes usar <strong>onboarding@resend.dev</strong>.
                  </span>
                </div>
              </div>

              {/* Botón de Prueba de Correo */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail || !notificationConfig.resend_api_key}
                  className="py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingEmail ? 'Enviando...' : 'Probar Envío de Correo Ahora'}
                </button>
                {testEmailResult && (
                  <span className="text-xs font-medium text-slate-700">{testEmailResult}</span>
                )}
              </div>
            </div>

            {/* SECCIÓN WHATSAPP: ULTRAMSG / META CLOUD API */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Servicio de WhatsApp Automático</h3>
                    <p className="text-xs text-slate-500">Envía recordatorios transparentes a los teléfonos de tus clientes sin abrir WhatsApp Web.</p>
                  </div>
                </div>

                <a
                  href="https://ultramsg.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 py-1.5 px-3 rounded-lg transition-colors"
                >
                  Ver UltraMsg <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Proveedor de WhatsApp
                </label>
                <select
                  value={notificationConfig.whatsapp_provider}
                  onChange={e => setNotificationConfig({ ...notificationConfig, whatsapp_provider: e.target.value as any })}
                  className="w-full md:w-1/2 rounded-xl border border-slate-300 py-2 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none bg-white font-medium"
                >
                  <option value="ultramsg">UltraMsg (Recomendado - Vinculación QR instantánea)</option>
                  <option value="cloud_api">Meta WhatsApp Cloud API (Oficial de Meta para Desarrolladores)</option>
                  <option value="manual">Modo Enlace (Abrir WhatsApp Web con mensaje listo)</option>
                </select>
              </div>

              {notificationConfig.whatsapp_provider === 'ultramsg' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      UltraMsg Instance ID *
                    </label>
                    <input
                      type="text"
                      placeholder="instance12345"
                      value={notificationConfig.ultramsg_instance_id}
                      onChange={e => setNotificationConfig({ ...notificationConfig, ultramsg_instance_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500 outline-none bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      UltraMsg Token *
                    </label>
                    <input
                      type="password"
                      placeholder="token_abc123..."
                      value={notificationConfig.ultramsg_token}
                      onChange={e => setNotificationConfig({ ...notificationConfig, ultramsg_token: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500 outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {notificationConfig.whatsapp_provider === 'cloud_api' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Meta Phone Number ID *
                    </label>
                    <input
                      type="text"
                      placeholder="1000123456789"
                      value={notificationConfig.whatsapp_cloud_phone_id}
                      onChange={e => setNotificationConfig({ ...notificationConfig, whatsapp_cloud_phone_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500 outline-none bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Meta Access Token *
                    </label>
                    <input
                      type="password"
                      placeholder="EAA..."
                      value={notificationConfig.whatsapp_cloud_token}
                      onChange={e => setNotificationConfig({ ...notificationConfig, whatsapp_cloud_token: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-2 px-3 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500 outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Botón de Prueba de WhatsApp */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestWhatsApp}
                  disabled={
                    testingWhatsApp ||
                    (notificationConfig.whatsapp_provider === 'ultramsg' && (!notificationConfig.ultramsg_instance_id || !notificationConfig.ultramsg_token)) ||
                    (notificationConfig.whatsapp_provider === 'cloud_api' && (!notificationConfig.whatsapp_cloud_phone_id || !notificationConfig.whatsapp_cloud_token))
                  }
                  className="py-2 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testingWhatsApp ? 'Enviando...' : 'Probar Envío de WhatsApp Ahora'}
                </button>
                {testWhatsAppResult && (
                  <span className="text-xs font-medium text-slate-700">{testWhatsAppResult}</span>
                )}
              </div>
            </div>

            {/* BOTÓN GUARDAR CONFIGURACIÓN */}
            <div className="pt-4 flex justify-end border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20 cursor-pointer"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar Credenciales de Mensajería'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

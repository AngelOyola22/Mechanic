import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';

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
  const [settings, setSettings] = useState<SysSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    currency_symbol: '$'
  });

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
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
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

      setSuccess('Configuración guardada exitosamente.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando configuración...</div>;
  }

  const canEdit = hasPermission('SET_UPDATE');

  return (
    <div className="flex flex-col h-full space-y-6 max-w-4xl mx-auto w-full">
      <PageHeader 
        title="Configuración de la Empresa"
        description="Ajusta los parámetros globales del sistema, información del negocio y preferencias visuales."
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
          <div className="w-5 h-5 shrink-0 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-8">
          
          {/* SECCIÓN: Datos Principales */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Datos Principales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nombre Comercial / Razón Social *</label>
                <input 
                  type="text" 
                  required
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">RUC / Documento *</label>
                <input 
                  type="text" 
                  required
                  value={formData.ruc}
                  onChange={e => setFormData({...formData, ruc: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: Contacto */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Contacto y Ubicación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Dirección Matriz</label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Teléfono</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN: Visuales y Preferencias */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Preferencias</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Símbolo de Moneda</label>
                <input 
                  type="text" 
                  value={formData.currency_symbol}
                  onChange={e => setFormData({...formData, currency_symbol: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">URL del Logo (Opcional)</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={formData.logo_url}
                  onChange={e => setFormData({...formData, logo_url: e.target.value})}
                  disabled={!canEdit}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="pt-4 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-blue-600/20"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

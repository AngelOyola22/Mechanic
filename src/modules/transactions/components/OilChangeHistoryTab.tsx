import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabase';
import {
  Car, Search, Calendar, Phone, Mail, Clock, AlertTriangle, CheckCircle2,
  Send, Copy, Check, Plus, MessageCircle, FileText, ArrowRight, Gauge, Wrench, RefreshCw,
  Pencil, Save, ExternalLink, Settings as SettingsIcon, Loader2, Filter, Eye, X, ChevronDown, ChevronUp,
  LayoutGrid, List
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import {
  sendOilReminderEmail,
  sendWhatsAppNotification,
  getNotificationSettings
} from '../../../services/notificationService';

export interface OilChangeRecord {
  id: string | number;
  sale_id?: number | null;
  invoice_number?: string;
  client_id: number;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_document_id?: string;
  vehicle_plate: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number | null;
  current_mileage: number;
  next_change_mileage: number;
  oil_type?: string;
  notes?: string;
  service_date: string;
  status?: string;
}

const LOCAL_STORAGE_KEY = 'sys_tra_oil_changes_backup';

export const OilChangeHistoryTab: React.FC = () => {
  const [records, setRecords] = useState<OilChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'SOON' | 'OK'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filtros Avanzados (Fecha, Cliente, Cédula, Placa)
  const [filterClientName, setFilterClientName] = useState('');
  const [filterClientDoc, setFilterClientDoc] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modal de Detalle Completo y Odómetro
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<OilChangeRecord | null>(null);

  // Real-time mileage input simulator per record ID: recordId -> entered mileage
  const [customMileages, setCustomMileages] = useState<Record<string | number, number>>({});
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Direct sending background states & notifications
  const navigate = useNavigate();
  const [sendingEmailId, setSendingEmailId] = useState<string | number | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | number | null>(null);
  const [notificationAlert, setNotificationAlert] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  // Missing API configuration helper modal
  const [missingConfigModal, setMissingConfigModal] = useState<{
    isOpen: boolean;
    type: 'email' | 'whatsapp';
    record: OilChangeRecord | null;
  }>({ isOpen: false, type: 'email', record: null });

  // Manual Creation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<{ id: number; name: string; document_id: string; phone?: string; email?: string }[]>([]);
  const [vehicleBrands, setVehicleBrands] = useState<{ id: number; name: string }[]>([]);
  const [vehicleModels, setVehicleModels] = useState<{ id: number; brand_id: number; name: string }[]>([]);

  // Form State (Nuevo Registro)
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [formPlate, setFormPlate] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formCurrentKm, setFormCurrentKm] = useState('');
  const [formInterval, setFormInterval] = useState<number>(5000);
  const [formNextKm, setFormNextKm] = useState('');
  const [formOilType, setFormOilType] = useState('Sintético 5W-30');
  const [formNotes, setFormNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal State (Editar Registro Existente)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OilChangeRecord | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editCurrentKm, setEditCurrentKm] = useState('');
  const [editNextKm, setEditNextKm] = useState('');
  const [editOilType, setEditOilType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Email Modal State (Registrar y Enviar Correo de Recordatorio)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecord, setEmailRecord] = useState<OilChangeRecord | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailModalError, setEmailModalError] = useState<string | null>(null);

  // Estado si la tabla tra_oil_changes no existe en Supabase
  const [isTableMissingInDb, setIsTableMissingInDb] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const CREATE_TABLE_SQL = `-- Ejecutar en Supabase > SQL Editor:
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
ALTER TABLE tra_oil_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo tra_oil_changes" ON tra_oil_changes FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON TABLE tra_oil_changes TO authenticated, anon, service_role;
GRANT ALL ON SEQUENCE tra_oil_changes_id_seq TO authenticated, anon, service_role;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(CREATE_TABLE_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  useEffect(() => {
    loadOilChanges();
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    try {
      const [clientsRes, brandsRes, modelsRes] = await Promise.all([
        supabase.from('cat_clients').select('id, name, document_id, phone, email').eq('is_customer', true),
        supabase.from('cat_vehicle_brands').select('id, name').eq('is_active', true),
        supabase.from('cat_vehicle_models').select('id, brand_id, name').eq('is_active', true)
      ]);
      setClients(clientsRes.data || []);
      setVehicleBrands(brandsRes.data || []);
      setVehicleModels(modelsRes.data || []);
    } catch (e) {
      console.warn('Error loading catalogs for oil change modal:', e);
    }
  };

  const loadOilChanges = async () => {
    try {
      setLoading(true);
      let dbData: OilChangeRecord[] = [];

      try {
        // Consulta directa a tra_oil_changes sin joins frágiles de PostgREST
        const { data: rawOil, error: oilError } = await supabase
          .from('tra_oil_changes')
          .select('*')
          .order('id', { ascending: false });

        if (oilError) {
          if (oilError.code === '42P01' || oilError.message?.toLowerCase().includes('does not exist')) {
            setIsTableMissingInDb(true);
            console.warn('tra_oil_changes no existe en Supabase aún.');
          }
        } else {
          setIsTableMissingInDb(false);
          if (rawOil && rawOil.length > 0) {
            // Enriquecer con cat_clients y tra_sales en memoria
            const [clientsRes, salesRes] = await Promise.all([
              supabase.from('cat_clients').select('id, name, document_id, phone, email'),
              supabase.from('tra_sales').select('id, invoice_number')
            ]);
            const clientsMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
            const salesMap = new Map((salesRes.data || []).map((s: any) => [s.id, s.invoice_number]));

            dbData = rawOil.map((d: any) => {
              const cl = clientsMap.get(d.client_id);
              return {
                id: d.id,
                sale_id: d.sale_id,
                invoice_number: d.sale_id ? (salesMap.get(d.sale_id) || 'FAC-VENTA') : (d.invoice_number || 'MANUAL'),
                client_id: d.client_id,
                client_name: cl?.name || d.client_name || 'Cliente',
                client_phone: cl?.phone || d.client_phone || '',
                client_email: cl?.email || d.client_email || '',
                client_document_id: cl?.document_id || d.client_document_id || '',
                vehicle_plate: d.vehicle_plate,
                vehicle_brand: d.vehicle_brand || '',
                vehicle_model: d.vehicle_model || '',
                vehicle_year: d.vehicle_year,
                current_mileage: d.current_mileage,
                next_change_mileage: d.next_change_mileage,
                oil_type: d.oil_type || 'Estándar',
                notes: d.notes || '',
                service_date: d.service_date,
                status: d.status || 'ACTIVE'
              };
            });
          }
        }
      } catch (err) {
        console.warn('Error al consultar tra_oil_changes:', err);
      }

      // Escaneo secundario: buscar en tra_sale_details si hay facturas con cambio de aceite no registradas
      try {
        const { data: saleItems } = await supabase
          .from('tra_sale_details')
          .select(`
            id, sale_id,
            cat_products (id, name, sku),
            tra_sales (
              id, invoice_number, created_at, client_id,
              cat_clients (id, name, document_id, phone, email)
            )
          `)
          .order('id', { ascending: false });

        if (saleItems && saleItems.length > 0) {
          saleItems.forEach((si: any) => {
            const prod = si.cat_products;
            const pName = (prod?.name || '').toLowerCase();
            const pSku = (prod?.sku || '').toLowerCase();

            if (pSku === 'srv-002' || pName.includes('aceite') || pName.includes('oil')) {
              const sale = si.tra_sales;
              if (sale) {
                const alreadyRecorded = dbData.some(item => item.sale_id === sale.id || item.invoice_number === sale.invoice_number);
                if (!alreadyRecorded) {
                  const client = sale.cat_clients;
                  dbData.push({
                    id: `sale-${sale.id}`,
                    sale_id: sale.id,
                    invoice_number: sale.invoice_number,
                    client_id: sale.client_id || client?.id || 0,
                    client_name: client?.name || 'Cliente',
                    client_phone: client?.phone || '',
                    client_email: client?.email || '',
                    client_document_id: client?.document_id || '',
                    vehicle_plate: 'AUT-SRV',
                    vehicle_brand: 'Servicio',
                    vehicle_model: 'Cambio de Aceite',
                    current_mileage: 0,
                    next_change_mileage: 5000,
                    oil_type: prod?.name || 'Cambio de Aceite',
                    notes: `Facturado en ${sale.invoice_number}`,
                    service_date: sale.created_at,
                    status: 'ACTIVE'
                  });
                }
              }
            }
          });
        }
      } catch (salesScanErr) {
        console.warn('Notice scanning sales details:', salesScanErr);
      }

      // Mezclar con respaldo local persistente
      const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localData: OilChangeRecord[] = [];
      if (localStr) {
        try {
          localData = JSON.parse(localStr);
        } catch (e) {
          localData = [];
        }
      }

      // Combinar asegurando registros únicos
      const combined = [...dbData];
      localData.forEach(item => {
        const exists = combined.some(c =>
          c.id === item.id ||
          (c.sale_id && item.sale_id && c.sale_id === item.sale_id) ||
          (c.vehicle_plate === item.vehicle_plate && c.service_date === item.service_date)
        );
        if (!exists) {
          combined.push(item);
        }
      });

      // Sincronizar teléfonos y correos actualizados desde cat_clients
      try {
        const { data: clientsData } = await supabase
          .from('cat_clients')
          .select('id, name, document_id, phone, email');

        if (clientsData && clientsData.length > 0) {
          combined.forEach(record => {
            const matched = clientsData.find((c: any) =>
              (record.client_id && c.id === record.client_id) ||
              (record.client_document_id && c.document_id === record.client_document_id) ||
              (record.client_name && c.name?.trim().toLowerCase() === record.client_name?.trim().toLowerCase())
            );
            if (matched) {
              if (!record.client_id) record.client_id = matched.id;
              if (matched.name) record.client_name = matched.name;
              if (matched.phone) record.client_phone = matched.phone;
              if (matched.email) record.client_email = matched.email;
              if (matched.document_id) record.client_document_id = matched.document_id;
            }
          });
        }
      } catch (clientErr) {
        console.warn('Could not enrich oil change clients from cat_clients:', clientErr);
      }

      // Guardar respaldo actualizado para garantizar que nunca se pierda
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
      } catch (e) {}

      setRecords(combined);
    } catch (err) {
      console.error('Error general loading oil changes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate next km when current km or interval changes in modal
  const handleCurrentKmChange = (val: string) => {
    setFormCurrentKm(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setFormNextKm((num + formInterval).toString());
    }
  };

  const handleIntervalSelect = (interval: number) => {
    setFormInterval(interval);
    const num = parseInt(formCurrentKm, 10);
    if (!isNaN(num)) {
      setFormNextKm((num + interval).toString());
    }
  };

  const handleSaveManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !formPlate.trim() || !formCurrentKm || !formNextKm) {
      setFormError('Cliente, Placa, Kilometraje Actual y Próximo Cambio son requeridos.');
      return;
    }

    try {
      setSavingRecord(true);
      setFormError(null);

      const clientObj = clients.find(c => c.id === Number(selectedClient));
      const recordPayload = {
        client_id: Number(selectedClient),
        vehicle_plate: formPlate.trim().toUpperCase(),
        vehicle_brand: formBrand.trim(),
        vehicle_model: formModel.trim(),
        vehicle_year: formYear ? parseInt(formYear, 10) : null,
        current_mileage: parseInt(formCurrentKm, 10),
        next_change_mileage: parseInt(formNextKm, 10),
        oil_type: formOilType,
        notes: formNotes,
        service_date: new Date().toISOString(),
        status: 'ACTIVE'
      };

      let insertedId = Date.now();
      try {
        const { data, error } = await supabase.from('tra_oil_changes').insert([recordPayload]).select().single();
        if (!error && data) {
          insertedId = data.id;
        }
      } catch (e) {
        console.warn('Saving oil change locally:', e);
      }

      // Save to local backup as well
      const newRecord: OilChangeRecord = {
        id: insertedId,
        ...recordPayload,
        client_name: clientObj?.name || 'Cliente',
        client_phone: clientObj?.phone || '',
        client_email: clientObj?.email || '',
        client_document_id: clientObj?.document_id || '',
        invoice_number: 'MANUAL'
      };

      const existingLocal = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      existingLocal.unshift(newRecord);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingLocal));

      setRecords(prev => [newRecord, ...prev]);
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar registro.');
    } finally {
      setSavingRecord(false);
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    setFormCurrentKm('');
    setFormNextKm('');
    setFormNotes('');
    setFormError(null);
  };

  // Generate WhatsApp Reminder URL
  const getWhatsAppReminderUrl = (record: OilChangeRecord) => {
    let cleanPhone = (record.client_phone || '').replace(/\D/g, '');
    if (!cleanPhone) cleanPhone = '593999999999';
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '593' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('593') && cleanPhone.length === 9) {
      cleanPhone = '593' + cleanPhone;
    }

    const vehicleText = [record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'su vehículo';
    const message = `🚗 *RECORDATORIO DE MANTENIMIENTO - TALLER MECÁNICO* 🚗\n\n` +
      `Hola *${record.client_name || 'Estimado Cliente'}*, le saludamos de *Taller Mecánico*.\n\n` +
      `Le recordamos el historial de servicio para su vehículo *${vehicleText}* (Placa: *${record.vehicle_plate}*):\n` +
      `• Último cambio: *${new Date(record.service_date).toLocaleDateString()}* a los *${record.current_mileage.toLocaleString()} km*\n` +
      `• Próximo cambio recomendado: *${record.next_change_mileage.toLocaleString()} km*\n` +
      `• Aceite: *${record.oil_type || 'Sintético'}*\n\n` +
      `¿Desea revisar su kilometraje actual o agendar su cita? Responda a este mensaje con su kilometraje de hoy y con gusto le indicamos si ya está cerca del cambio. ¡Estamos para servirle!`;

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  };

  // Generate Email Reminder URL
  const getEmailReminderUrl = (record: OilChangeRecord) => {
    const to = record.client_email || '';
    const vehicleText = [record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'su vehículo';
    const subject = `Recordatorio de Mantenimiento - Vehículo ${record.vehicle_plate} (${vehicleText})`;
    const body = `Estimado/a ${record.client_name || 'Cliente'},\n\n` +
      `Le saludamos cordialmente de Taller Mecánico.\n\n` +
      `Le recordamos el historial de servicio registrado para su vehículo ${vehicleText} (Placa: ${record.vehicle_plate}):\n` +
      `• Último cambio de aceite: ${new Date(record.service_date).toLocaleDateString()} a los ${record.current_mileage.toLocaleString()} km\n` +
      `• Próximo cambio recomendado: ${record.next_change_mileage.toLocaleString()} km\n` +
      `• Tipo de aceite aplicado: ${record.oil_type || 'Sintético 5W-30'}\n\n` +
      `¿Desea revisar su kilometraje actual o agendar su cita para el cambio de aceite?\n` +
      `Puede responder a este correo indicando cuántos kilómetros marca su odómetro hoy y con gusto le confirmamos si está en tiempo óptimo.\n\n` +
      `¡Estamos para servirle!\n` +
      `Taller Mecánico`;

    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Open Email Modal for saving or sending
  const handleOpenEmailModal = (record: OilChangeRecord) => {
    setEmailRecord(record);
    setEmailInput(record.client_email || '');
    setEmailModalError(null);
    setIsEmailModalOpen(true);
  };

  const handleSaveEmailAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecord) return;
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailModalError('Por favor ingrese un correo electrónico válido (ej. cliente@dominio.com).');
      return;
    }

    try {
      setSavingEmail(true);
      setEmailModalError(null);

      // 1. Guardar permanentemente en cat_clients para no volver a pedirlo jamás
      try {
        if (emailRecord.client_id) {
          await supabase.from('cat_clients').update({ email: cleanEmail }).eq('id', emailRecord.client_id);
        } else if (emailRecord.client_document_id) {
          await supabase.from('cat_clients').update({ email: cleanEmail }).eq('document_id', emailRecord.client_document_id);
        }
      } catch (err) {
        console.warn('Notice updating cat_clients:', err);
      }

      // 2. Guardar en respaldo local
      const existingLocal: OilChangeRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const updatedLocal = existingLocal.map(item => {
        if (
          item.id === emailRecord.id ||
          (item.client_document_id && item.client_document_id === emailRecord.client_document_id) ||
          (item.client_name && item.client_name === emailRecord.client_name)
        ) {
          return { ...item, client_email: cleanEmail };
        }
        return item;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocal));

      // 3. Actualizar estado en pantalla
      const updatedRecord = { ...emailRecord, client_email: cleanEmail };
      setRecords(prev => prev.map(item => {
        if (
          item.id === emailRecord.id ||
          (item.client_document_id && item.client_document_id === emailRecord.client_document_id) ||
          (item.client_name && item.client_name === emailRecord.client_name)
        ) {
          return { ...item, client_email: cleanEmail };
        }
        return item;
      }));

      // Cerrar modal
      setIsEmailModalOpen(false);
      setEmailRecord(null);

      // 4. Intentar enviar directamente en segundo plano con Resend
      await handleSendEmailDirect(updatedRecord);
    } catch (err: any) {
      setEmailModalError(err.message || 'Error al guardar el correo.');
    } finally {
      setSavingEmail(false);
    }
  };

  // Envío directo en segundo plano vía Resend (sin abrir Outlook)
  const handleSendEmailDirect = async (record: OilChangeRecord) => {
    if (!record.client_email) {
      handleOpenEmailModal(record);
      return;
    }

    try {
      setSendingEmailId(record.id);
      setNotificationAlert(null);

      const result = await sendOilReminderEmail({
        toEmail: record.client_email,
        toName: record.client_name || 'Cliente',
        vehiclePlate: record.vehicle_plate,
        vehicleBrand: record.vehicle_brand,
        vehicleModel: record.vehicle_model,
        currentKm: record.current_mileage,
        nextKm: record.next_change_mileage,
        oilType: record.oil_type,
        serviceDate: record.service_date
      });

      if (result.success) {
        setNotificationAlert({
          type: 'success',
          text: `✅ Correo enviado con éxito a ${record.client_email} (directo en segundo plano, sin Outlook).`
        });
        setTimeout(() => setNotificationAlert(null), 6000);
      } else if (result.message.startsWith('MISSING_API_KEY')) {
        setMissingConfigModal({ isOpen: true, type: 'email', record });
      } else {
        setNotificationAlert({
          type: 'error',
          text: `❌ No se pudo enviar el correo: ${result.message}`,
          action: {
            label: 'Abrir en cliente de correo local',
            onClick: () => window.open(getEmailReminderUrl(record), '_blank')
          }
        });
      }
    } catch (e: any) {
      setNotificationAlert({
        type: 'error',
        text: `Error al enviar correo: ${e.message}`
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  // Envío directo en segundo plano vía UltraMsg / Meta Cloud API (sin abrir WhatsApp Web)
  const handleSendWhatsAppDirect = async (record: OilChangeRecord) => {
    const settings = await getNotificationSettings();

    // Si el usuario configuró explícitamente modo manual, abrir WhatsApp Web
    if (settings.whatsapp_provider === 'manual') {
      window.open(getWhatsAppReminderUrl(record), '_blank');
      return;
    }

    try {
      setSendingWhatsAppId(record.id);
      setNotificationAlert(null);

      const vehicleText = [record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'su vehículo';
      const message = `🚗 *RECORDATORIO DE MANTENIMIENTO - TALLER MECÁNICO* 🚗\n\n` +
        `Hola *${record.client_name || 'Estimado Cliente'}*, le saludamos de *Taller Mecánico*.\n\n` +
        `Le recordamos el historial de servicio para su vehículo *${vehicleText}* (Placa: *${record.vehicle_plate}*):\n` +
        `• Último cambio: *${new Date(record.service_date).toLocaleDateString()}* a los *${record.current_mileage.toLocaleString()} km*\n` +
        `• Próximo cambio recomendado: *${record.next_change_mileage.toLocaleString()} km*\n` +
        `• Aceite: *${record.oil_type || 'Sintético'}*\n\n` +
        `¿Desea revisar su kilometraje actual o agendar su cita? Responda a este mensaje con su kilometraje de hoy y con gusto le indicamos si ya está cerca del cambio. ¡Estamos para servirle!`;

      const result = await sendWhatsAppNotification({
        phone: record.client_phone || '',
        message
      });

      if (result.success) {
        setNotificationAlert({
          type: 'success',
          text: `✅ ${result.message} (enviado automáticamente sin abrir WhatsApp Web).`
        });
        setTimeout(() => setNotificationAlert(null), 6000);
      } else if (result.message.startsWith('MISSING_WHATSAPP_CONFIG')) {
        setMissingConfigModal({ isOpen: true, type: 'whatsapp', record });
      } else {
        setNotificationAlert({
          type: 'error',
          text: `❌ Error al enviar por WhatsApp: ${result.message}`,
          action: {
            label: 'Abrir WhatsApp Web manualmente',
            onClick: () => window.open(getWhatsAppReminderUrl(record), '_blank')
          }
        });
      }
    } catch (e: any) {
      setNotificationAlert({
        type: 'error',
        text: `Error general WhatsApp: ${e.message}`
      });
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  // Save updated odometer reading permanently
  const handleSaveLiveMileage = async (record: OilChangeRecord) => {
    const liveKm = customMileages[record.id];
    if (liveKm === undefined || isNaN(liveKm)) return;

    try {
      setUpdatingId(record.id);

      // Update in Supabase
      try {
        await supabase
          .from('tra_oil_changes')
          .update({
            current_mileage: liveKm
          })
          .eq('id', record.id);
      } catch (e) {
        console.warn('Remote update failed, updating locally:', e);
      }

      // Update in local backup
      const existingLocal: OilChangeRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const updatedLocal = existingLocal.map(item => {
        if (item.id === record.id || (item.vehicle_plate === record.vehicle_plate && item.service_date === record.service_date)) {
          return { ...item, current_mileage: liveKm };
        }
        return item;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocal));

      // Update in state
      setRecords(prev => prev.map(item => {
        if (item.id === record.id) {
          return { ...item, current_mileage: liveKm };
        }
        return item;
      }));

      // Update in selected detail modal if open
      setSelectedDetailRecord(prev => (prev && prev.id === record.id ? { ...prev, current_mileage: liveKm } : prev));
    } catch (err) {
      console.error('Error saving live mileage:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Edit Modal for a Record
  const openEditModal = (record: OilChangeRecord) => {
    setEditingRecord(record);
    setEditPlate(record.vehicle_plate);
    setEditBrand(record.vehicle_brand || '');
    setEditModel(record.vehicle_model || '');
    setEditYear(record.vehicle_year?.toString() || '');
    setEditCurrentKm(record.current_mileage.toString());
    setEditNextKm(record.next_change_mileage.toString());
    setEditOilType(record.oil_type || 'Sintético 5W-30');
    setEditNotes(record.notes || '');
    setEditClientPhone(record.client_phone || '');
    setEditClientEmail(record.client_email || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Save changes to existing record
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editPlate.trim() || !editCurrentKm || !editNextKm) {
      setEditError('Placa, Kilometraje Actual y Próximo Cambio son requeridos.');
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);

      // Actualizar datos del cliente (teléfono y correo) si se cambiaron
      if (editClientPhone !== (editingRecord.client_phone || '') || editClientEmail !== (editingRecord.client_email || '')) {
        try {
          if (editingRecord.client_id) {
            await supabase.from('cat_clients').update({
              phone: editClientPhone.trim() || null,
              email: editClientEmail.trim() || null
            }).eq('id', editingRecord.client_id);
          } else if (editingRecord.client_document_id) {
            await supabase.from('cat_clients').update({
              phone: editClientPhone.trim() || null,
              email: editClientEmail.trim() || null
            }).eq('document_id', editingRecord.client_document_id);
          }
        } catch (err) {
          console.warn('Notice updating cat_clients from edit modal:', err);
        }
      }

      const updatedPayload = {
        vehicle_plate: editPlate.trim().toUpperCase(),
        vehicle_brand: editBrand.trim(),
        vehicle_model: editModel.trim(),
        vehicle_year: editYear ? parseInt(editYear, 10) : null,
        current_mileage: parseInt(editCurrentKm, 10),
        next_change_mileage: parseInt(editNextKm, 10),
        oil_type: editOilType,
        notes: editNotes,
        client_phone: editClientPhone.trim(),
        client_email: editClientEmail.trim()
      };

      try {
        await supabase
          .from('tra_oil_changes')
          .update({
            vehicle_plate: updatedPayload.vehicle_plate,
            vehicle_brand: updatedPayload.vehicle_brand,
            vehicle_model: updatedPayload.vehicle_model,
            vehicle_year: updatedPayload.vehicle_year,
            current_mileage: updatedPayload.current_mileage,
            next_change_mileage: updatedPayload.next_change_mileage,
            oil_type: updatedPayload.oil_type,
            notes: updatedPayload.notes
          })
          .eq('id', editingRecord.id);
      } catch (err) {
        console.warn('Remote update failed, updating locally:', err);
      }

      // Update in local storage
      const existingLocal: OilChangeRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const updatedLocal = existingLocal.map(item => {
        if (item.id === editingRecord.id || (item.vehicle_plate === editingRecord.vehicle_plate && item.service_date === editingRecord.service_date)) {
          return { ...item, ...updatedPayload };
        }
        return item;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocal));

      // Update in state
      setRecords(prev => prev.map(item => {
        if (item.id === editingRecord.id) {
          return { ...item, ...updatedPayload };
        }
        return item;
      }));

      // Update in selected detail modal if open
      setSelectedDetailRecord(prev => (prev && prev.id === editingRecord.id ? { ...prev, ...updatedPayload } : prev));

      setIsEditModalOpen(false);
      setEditingRecord(null);
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar registro.');
    } finally {
      setSavingEdit(false);
    }
  };

  const getCopyText = (record: OilChangeRecord) => {
    const vehicleText = [record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'su vehículo';
    return `🚗 RECORDATORIO DE CAMBIO DE ACEITE - TALLER MECÁNICO\n` +
      `Cliente: ${record.client_name}\n` +
      `Vehículo: ${vehicleText} | Placa: ${record.vehicle_plate}\n` +
      `Último cambio realizado: ${record.current_mileage.toLocaleString()} km (${new Date(record.service_date).toLocaleDateString()})\n` +
      `Próximo cambio recomendado: ${record.next_change_mileage.toLocaleString()} km\n` +
      `Tipo de aceite: ${record.oil_type}\n` +
      `¡Contáctenos para agendar su mantenimiento a tiempo!`;
  };

  const handleCopy = (record: OilChangeRecord) => {
    navigator.clipboard.writeText(getCopyText(record));
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Status calculation helper
  const getRecordStatus = (record: OilChangeRecord) => {
    // If user typed a custom/simulated mileage for this car, use it; otherwise compare with the current service mileage
    const liveKm = customMileages[record.id] !== undefined ? customMileages[record.id] : record.current_mileage;
    const diff = record.next_change_mileage - liveKm;

    if (diff <= 0) {
      return { code: 'DUE', label: 'VENCIDO / ALCANZADO', color: 'red', diff };
    }
    if (diff <= 1000) {
      return { code: 'SOON', label: 'PRÓXIMO AL CAMBIO', color: 'amber', diff };
    }
    return { code: 'OK', label: 'EN RANGO ÓPTIMO', color: 'emerald', diff };
  };

  // Filter & Search
  const filteredRecords = records.filter(r => {
    // Buscador general rápido
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        r.vehicle_plate.toLowerCase().includes(q) ||
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.client_document_id || '').toLowerCase().includes(q) ||
        (r.vehicle_brand || '').toLowerCase().includes(q) ||
        (r.vehicle_model || '').toLowerCase().includes(q) ||
        (r.invoice_number || '').toLowerCase().includes(q);

      if (!matchSearch) return false;
    }

    // Filtro específico por Placa
    if (filterPlate.trim()) {
      if (!r.vehicle_plate.toLowerCase().includes(filterPlate.toLowerCase().trim())) {
        return false;
      }
    }

    // Filtro específico por Nombre de Cliente
    if (filterClientName.trim()) {
      if (!(r.client_name || '').toLowerCase().includes(filterClientName.toLowerCase().trim())) {
        return false;
      }
    }

    // Filtro específico por Cédula / RUC
    if (filterClientDoc.trim()) {
      if (!(r.client_document_id || '').toLowerCase().includes(filterClientDoc.toLowerCase().trim())) {
        return false;
      }
    }

    // Filtro específico por Rango de Fechas
    if (filterDateFrom) {
      const recordDate = r.service_date.split('T')[0];
      if (recordDate < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const recordDate = r.service_date.split('T')[0];
      if (recordDate > filterDateTo) return false;
    }

    // Filtro por Estado (Vencido, Próximo, Al Día)
    if (statusFilter !== 'ALL') {
      const status = getRecordStatus(r);
      if (statusFilter !== status.code) return false;
    }

    return true;
  });

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterClientName('');
    setFilterClientDoc('');
    setFilterPlate('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  const activeFiltersCount =
    (searchTerm.trim() ? 1 : 0) +
    (filterClientName.trim() ? 1 : 0) +
    (filterClientDoc.trim() ? 1 : 0) +
    (filterPlate.trim() ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Statistics
  const totalDue = records.filter(r => getRecordStatus(r).code === 'DUE').length;
  const totalSoon = records.filter(r => getRecordStatus(r).code === 'SOON').length;
  const totalOk = records.filter(r => getRecordStatus(r).code === 'OK').length;

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Atendidos</span>
            <span className="text-2xl font-black text-slate-800">{records.length}</span>
            <span className="text-xs text-slate-500 block mt-0.5">Vehículos con registro</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Al Día (En Rango)</span>
            <span className="text-2xl font-black text-emerald-600">{totalOk}</span>
            <span className="text-xs text-slate-500 block mt-0.5">Aceite en buen estado</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Próximos a Vencer</span>
            <span className="text-2xl font-black text-amber-600">{totalSoon}</span>
            <span className="text-xs text-slate-500 block mt-0.5">&lt; 1,000 km para cambio</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Vencidos / Límite</span>
            <span className="text-2xl font-black text-red-600">{totalDue}</span>
            <span className="text-xs text-slate-500 block mt-0.5">¡Requiere cambio urgente!</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Alerta si la tabla de base de datos no existe en Supabase */}
      {isTableMissingInDb && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                La tabla de Cambios de Aceite (<code>tra_oil_changes</code>) aún no ha sido creada en tu base de datos Supabase
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Por esta razón la información no se guarda de forma persistente en la nube al cerrar sesión. Copia el script SQL y pégalo en el <strong>SQL Editor de Supabase</strong> para habilitar el guardado permanente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopySql}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? '¡SQL Copiado!' : 'Copiar SQL para Supabase'}</span>
          </button>
        </div>
      )}

      {/* Alerta de notificación enviada o advertencia */}
      {notificationAlert && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium transition-all shadow-sm ${
            notificationAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notificationAlert.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <span>{notificationAlert.text}</span>
          <div className="flex items-center gap-2">
            {notificationAlert.action && (
              <button
                type="button"
                onClick={notificationAlert.action.onClick}
                className="px-3 py-1 bg-white text-slate-800 rounded-lg text-xs font-bold border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                {notificationAlert.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationAlert(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-1 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Buscador General */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por placa, cliente, cédula, marca o factura..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Todos ({records.length})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('SOON'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'SOON' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-100/50'}`}
              >
                Próximos ({totalSoon})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('DUE'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'DUE' ? 'bg-red-600 text-white shadow-sm' : 'text-red-700 hover:bg-red-100/50'}`}
              >
                Vencidos ({totalDue})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('OK'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'OK' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-100/50'}`}
              >
                Al Día ({totalOk})
              </button>
            </div>

            {/* Botón de Filtros Avanzados (Fecha, Cédula, Cliente, Placa) */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > (searchTerm ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0)
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros Específicos</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Vista: Tarjetas Compactas vs Tabla */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Tarjetas Compactas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Tabla / Lista (Máximo espacio)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadOilChanges()}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Recargar listado"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Registro
            </button>
          </div>
        </div>

        {/* Panel Expandible de Filtros Específicos (Fecha, Cliente, Cédula, Placa) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/70 p-3 rounded-xl border">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nombre Cliente</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={filterClientName}
                onChange={e => { setFilterClientName(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cédula / RUC</label>
              <input
                type="text"
                placeholder="Ej. 094408..."
                value={filterClientDoc}
                onChange={e => { setFilterClientDoc(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Placa Vehículo</label>
              <input
                type="text"
                placeholder="Ej. GPD-0762"
                value={filterPlate}
                onChange={e => { setFilterPlate(e.target.value.toUpperCase()); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fecha Desde</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">Fecha Hasta</label>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          Cargando historial de cambios de aceite y vehículos...
        </div>
      ) : paginatedRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No se encontraron registros de cambio de aceite</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Los cambios de aceite se registran automáticamente al facturar el servicio <strong>SRV-002 (Cambio de aceite)</strong> en el Punto de Venta, o puedes agregar uno manualmente.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Registrar Primer Mantenimiento
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Placa</th>
                  <th className="py-2.5 px-3">Vehículo</th>
                  <th className="py-2.5 px-3">Cliente / Cédula</th>
                  <th className="py-2.5 px-3">Fecha Servicio</th>
                  <th className="py-2.5 px-3 text-right">Km Servicio</th>
                  <th className="py-2.5 px-3 text-right">Próximo Cambio</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map(record => {
                  const status = getRecordStatus(record);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="bg-slate-900 text-yellow-400 font-mono font-black text-[11px] px-2 py-0.5 rounded border border-slate-800 tracking-wider inline-flex items-center gap-1">
                          <span className="text-[7px] text-white font-sans font-bold">EC</span>
                          {record.vehicle_plate}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 truncate max-w-[150px]">
                          {[record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'Vehículo'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {record.oil_type || 'Sintético'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]">{record.client_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{record.client_document_id || 'Consumidor'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(record.service_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {record.current_mileage.toLocaleString()} km
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                        {record.next_change_mileage.toLocaleString()} km
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            status.color === 'red'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : status.color === 'amber'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {status.code === 'DUE' ? 'Vencido' : status.code === 'SOON' ? 'Próximo' : 'Al Día'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailRecord(record);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                            title="Ver Detalle y Odómetro"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppDirect(record)}
                            disabled={sendingWhatsAppId === record.id}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Enviar WhatsApp"
                          >
                            {sendingWhatsAppId === record.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MessageCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(record)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedRecords.map(record => {
            const status = getRecordStatus(record);

            return (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 p-3 flex flex-col justify-between transition-all gap-2"
              >
                {/* Header: Placa + Carro + Estado */}
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="bg-slate-900 text-yellow-400 font-mono font-black text-[11px] px-1.5 py-0.5 rounded border border-slate-800 tracking-wider shadow-xs flex items-center gap-0.5 shrink-0">
                      <span className="text-[7px] text-white font-sans font-bold">EC</span>
                      <span>{record.vehicle_plate}</span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-xs truncate leading-tight">
                        {[record.vehicle_brand, record.vehicle_model].filter(Boolean).join(' ') || 'Vehículo'}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {record.vehicle_year ? `${record.vehicle_year} • ` : ''}
                        {record.oil_type || 'Sintético'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                      status.color === 'red'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : status.color === 'amber'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {status.code === 'DUE' ? 'Vencido' : status.code === 'SOON' ? 'Próximo' : 'Al Día'}
                  </span>
                </div>

                {/* Cliente y Fecha en una línea limpia */}
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="truncate max-w-[140px] font-medium text-slate-700" title={record.client_name}>
                    👤 {record.client_name}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {new Date(record.service_date).toLocaleDateString()}
                  </span>
                </div>

                {/* Resumen de Kilometraje en una sola fila compacta */}
                <div className="bg-slate-50/80 rounded-lg px-2 py-1.5 border border-slate-100 text-[10px] flex items-center justify-between">
                  <div className="text-slate-600 font-mono">
                    <span>{record.current_mileage.toLocaleString()}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <strong className="text-indigo-700 font-bold">{record.next_change_mileage.toLocaleString()} km</strong>
                  </div>
                  <div className="font-semibold text-right">
                    {status.diff > 0 ? (
                      <span className={status.color === 'amber' ? 'text-amber-700' : 'text-slate-600'}>
                        Faltan {status.diff.toLocaleString()} km
                      </span>
                    ) : (
                      <span className="text-red-600 font-bold">
                        +{Math.abs(status.diff).toLocaleString()} km
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón Principal Compacto + Botones Rápidos */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailRecord(record);
                      setIsDetailModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Detalle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppDirect(record)}
                    disabled={sendingWhatsAppId === record.id}
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                    title="Enviar WhatsApp"
                  >
                    {sendingWhatsAppId === record.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(record)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Editar Registro"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredRecords.length > PAGE_SIZE && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modal: Detalle Completo y Odómetro de Mantenimiento */}
      <Modal
        isOpen={isDetailModalOpen && !!selectedDetailRecord}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailRecord(null);
        }}
        title={`Ficha de Mantenimiento: ${selectedDetailRecord?.vehicle_plate || ''}`}
        maxWidth="2xl"
      >
        {selectedDetailRecord && (() => {
          const status = getRecordStatus(selectedDetailRecord);
          const liveKm = customMileages[selectedDetailRecord.id] !== undefined
            ? customMileages[selectedDetailRecord.id]
            : selectedDetailRecord.current_mileage;
          const kmProgress = Math.min(
            100,
            Math.max(
              0,
              ((liveKm - selectedDetailRecord.current_mileage) /
                (selectedDetailRecord.next_change_mileage - selectedDetailRecord.current_mileage || 1)) * 100
            )
          );

          return (
            <div className="p-6 space-y-5">
              {/* Encabezado del Vehículo */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 text-yellow-400 font-mono font-black text-base px-3 py-1 rounded-lg border-2 border-slate-700 tracking-wider shadow-inner flex items-center gap-1.5">
                    <span className="text-[10px] text-white font-sans font-bold uppercase">EC</span>
                    <span>{selectedDetailRecord.vehicle_plate}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">
                      {[selectedDetailRecord.vehicle_brand, selectedDetailRecord.vehicle_model].filter(Boolean).join(' ') || 'Vehículo'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {selectedDetailRecord.vehicle_year ? `Año ${selectedDetailRecord.vehicle_year} • ` : ''}
                      Aceite: <span className="font-semibold text-white">{selectedDetailRecord.oil_type || 'Sintético 5W-30'}</span>
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shrink-0 ${
                    status.color === 'red'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : status.color === 'amber'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {status.color === 'red' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {status.color === 'amber' && <Clock className="w-3.5 h-3.5" />}
                  {status.color === 'emerald' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {status.label}
                </span>
              </div>

              {/* Ficha del Cliente y del Comprobante */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">Datos del Propietario</span>
                  <div className="font-bold text-slate-800 text-sm">{selectedDetailRecord.client_name}</div>
                  <div className="text-slate-600 font-mono">Cédula / RUC: <strong>{selectedDetailRecord.client_document_id || 'Consumidor'}</strong></div>
                  <div className="text-slate-600">Teléfono: <strong>{selectedDetailRecord.client_phone || 'Sin registrar'}</strong></div>
                  <div className="text-slate-600 truncate">Correo: <strong>{selectedDetailRecord.client_email || 'Sin registrar'}</strong></div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">Datos del Servicio</span>
                  <div className="text-slate-600">
                    Fecha de Atención: <strong className="text-slate-800">{new Date(selectedDetailRecord.service_date).toLocaleString()}</strong>
                  </div>
                  <div className="text-slate-600">
                    N° Comprobante: <strong className="font-mono text-indigo-600">{selectedDetailRecord.invoice_number || 'N/A'}</strong>
                  </div>
                  <div className="text-slate-600">
                    Tipo de Aceite: <strong className="text-slate-800">{selectedDetailRecord.oil_type || 'Sintético'}</strong>
                  </div>
                  {selectedDetailRecord.notes && (
                    <div className="text-slate-500 italic pt-1 border-t border-slate-200">
                      "{selectedDetailRecord.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* CONTROL Y COMPARADOR DE ODÓMETRO INTERACTIVO */}
              <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-indigo-600" />
                    Control y Comparador de Odómetro:
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-900">
                    Meta de Cambio: {selectedDetailRecord.next_change_mileage.toLocaleString()} km
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Km en el Servicio</span>
                    <strong className="text-slate-800 font-mono text-base">{selectedDetailRecord.current_mileage.toLocaleString()} km</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Próximo Recomendado</span>
                    <strong className="text-indigo-600 font-mono text-base">{selectedDetailRecord.next_change_mileage.toLocaleString()} km</strong>
                  </div>
                </div>

                {/* Input interactivo para actualizar odómetro */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block">Odómetro actual del carro:</label>
                      <span className="text-[11px] text-slate-400">Actualiza el kilometraje que marca el cliente o taller hoy</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={selectedDetailRecord.current_mileage.toString()}
                        value={customMileages[selectedDetailRecord.id] !== undefined ? customMileages[selectedDetailRecord.id] : ''}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : selectedDetailRecord.current_mileage;
                          setCustomMileages(prev => ({ ...prev, [selectedDetailRecord.id]: val }));
                        }}
                        className="w-28 text-right font-mono font-bold text-sm px-3 py-1.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveLiveMileage(selectedDetailRecord)}
                        disabled={updatingId === selectedDetailRecord.id || customMileages[selectedDetailRecord.id] === undefined}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Guardar este kilometraje como el odómetro actual"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{updatingId === selectedDetailRecord.id ? 'Guardando...' : 'Guardar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        status.color === 'red' ? 'bg-red-500' : status.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${kmProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600">
                      {status.diff > 0 ? (
                        <>Faltan <strong className={status.color === 'amber' ? 'text-amber-700' : 'text-slate-800'}>{status.diff.toLocaleString()} km</strong> para el cambio</>
                      ) : (
                        <strong className="text-red-600">¡Excedido por {Math.abs(status.diff).toLocaleString()} km!</strong>
                      )}
                    </span>
                    <span className={`font-mono text-xs ${status.color === 'red' ? 'text-red-600' : status.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {kmProgress.toFixed(0)}% del intervalo recorrido
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de Notificación y Gestión */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppDirect(selectedDetailRecord)}
                    disabled={sendingWhatsAppId === selectedDetailRecord.id}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    {sendingWhatsAppId === selectedDetailRecord.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    <span>{sendingWhatsAppId === selectedDetailRecord.id ? 'Enviando...' : 'Enviar WhatsApp'}</span>
                  </button>

                  {selectedDetailRecord.client_email ? (
                    <button
                      type="button"
                      onClick={() => handleSendEmailDirect(selectedDetailRecord)}
                      disabled={sendingEmailId === selectedDetailRecord.id}
                      className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                    >
                      {sendingEmailId === selectedDetailRecord.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      <span>{sendingEmailId === selectedDetailRecord.id ? 'Enviando...' : 'Enviar Correo'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenEmailModal(selectedDetailRecord)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      Registrar Correo
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(selectedDetailRecord)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(selectedDetailRecord)}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                    title="Copiar texto del recordatorio"
                  >
                    {copiedId === selectedDetailRecord.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedDetailRecord(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Registro Manual de Cambio de Aceite */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="Registrar Mantenimiento de Cambio de Aceite"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveManualRecord} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Cliente Propietario *
            </label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
              required
            >
              <option value="">Selecciona cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.document_id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Placa del Vehículo *
              </label>
              <input
                type="text"
                placeholder="Ej. ABC-1234"
                value={formPlate}
                onChange={e => setFormPlate(e.target.value.toUpperCase())}
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Año del Carro
              </label>
              <input
                type="number"
                placeholder="Ej. 2022"
                value={formYear}
                onChange={e => setFormYear(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Marca
              </label>
              <input
                type="text"
                placeholder="Ej. Toyota"
                value={formBrand}
                onChange={e => setFormBrand(e.target.value)}
                list="brand-list"
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <datalist id="brand-list">
                {vehicleBrands.map(b => <option key={b.id} value={b.name} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Modelo
              </label>
              <input
                type="text"
                placeholder="Ej. Hilux / Corolla"
                value={formModel}
                onChange={e => setFormModel(e.target.value)}
                list="model-list"
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <datalist id="model-list">
                {vehicleModels.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Kilometraje y Próximo Cambio
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Kilometraje Actual (km) *
                </label>
                <input
                  type="number"
                  placeholder="Ej. 85000"
                  value={formCurrentKm}
                  onChange={e => handleCurrentKmChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1 flex items-center justify-between">
                  <span>Próximo Cambio (km) *</span>
                  <span className="text-[10px] text-indigo-600 lowercase bg-indigo-100 px-1.5 py-0.5 rounded font-normal">✏️ editable</span>
                </label>
                <input
                  type="number"
                  placeholder="Ej. 90000"
                  value={formNextKm}
                  onChange={e => setFormNextKm(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/40"
                  required
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Puedes ingresar manualmente cualquier kilometraje exacto</span>
              </div>
            </div>

            {/* Quick interval buttons */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Intervalo sugerido según aceite:
              </label>
              <div className="flex gap-2">
                {[
                  { label: '+5,000 km (Mineral/Semisintético)', val: 5000 },
                  { label: '+7,500 km', val: 7500 },
                  { label: '+10,000 km (100% Sintético)', val: 10000 }
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleIntervalSelect(item.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${formInterval === item.val
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Tipo de Aceite Aplicado
              </label>
              <select
                value={formOilType}
                onChange={e => setFormOilType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-1.5 px-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="Sintético 5W-30">Sintético 5W-30 (10,000 km)</option>
                <option value="Sintético 0W-20">Sintético 0W-20 (10,000 km)</option>
                <option value="Semisintético 10W-40">Semisintético 10W-40 (5,000 - 7,500 km)</option>
                <option value="Mineral 20W-50">Mineral 20W-50 (5,000 km)</option>
                <option value="Aceite de Caja / Transmisión">Aceite de Caja / Transmisión</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Observaciones adicionales
            </label>
            <input
              type="text"
              placeholder="Ej. Cambio de filtro de aceite y arandela de tapón..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingRecord}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingRecord ? 'Guardando...' : 'Guardar Mantenimiento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Registro de Mantenimiento */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingRecord(null); }}
        title={`Editar Mantenimiento - ${editingRecord?.vehicle_plate || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
          {editError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs">
              {editError}
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
            <div>
              <span className="text-slate-500 block">Cliente Asociado:</span>
              <strong className="text-slate-800 text-sm">{editingRecord?.client_name || 'N/A'}</strong>
              <span className="text-slate-400 block text-[11px]">Cédula/RUC: {editingRecord?.client_document_id || 'N/A'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Fecha Registro:</span>
              <strong className="text-slate-700">{editingRecord?.service_date ? new Date(editingRecord.service_date).toLocaleDateString() : 'N/A'}</strong>
            </div>
          </div>

          {/* Datos de Contacto del Cliente */}
          <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Teléfono del Cliente
              </label>
              <input
                type="text"
                placeholder="Ej. 0991234567"
                value={editClientPhone}
                onChange={e => setEditClientPhone(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-1.5 px-3 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                placeholder="Ej. cliente@correo.com"
                value={editClientEmail}
                onChange={e => setEditClientEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-1.5 px-3 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Placa del Vehículo *
              </label>
              <input
                type="text"
                placeholder="Ej. ABC-1234"
                value={editPlate}
                onChange={e => setEditPlate(e.target.value.toUpperCase())}
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Año
              </label>
              <input
                type="number"
                placeholder="Ej. 2022"
                value={editYear}
                onChange={e => setEditYear(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Marca
              </label>
              <input
                type="text"
                placeholder="Ej. Toyota"
                value={editBrand}
                onChange={e => setEditBrand(e.target.value)}
                list="edit-brand-list"
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <datalist id="edit-brand-list">
                {vehicleBrands.map(b => <option key={b.id} value={b.name} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Modelo
              </label>
              <input
                type="text"
                placeholder="Ej. Hilux"
                value={editModel}
                onChange={e => setEditModel(e.target.value)}
                list="edit-model-list"
                className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <datalist id="edit-model-list">
                {vehicleModels.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Kilometraje y Próximo Cambio (Editable)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Kilometraje del Servicio (km) *
                </label>
                <input
                  type="number"
                  placeholder="Ej. 85000"
                  value={editCurrentKm}
                  onChange={e => setEditCurrentKm(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1 flex items-center justify-between">
                  <span>Próximo Cambio (km) *</span>
                  <span className="text-[10px] text-indigo-600 lowercase bg-indigo-100 px-1.5 py-0.5 rounded font-normal">✏️ editable</span>
                </label>
                <input
                  type="number"
                  placeholder="Ej. 90000"
                  value={editNextKm}
                  onChange={e => setEditNextKm(e.target.value)}
                  className="w-full border border-indigo-300 rounded-xl py-2 px-3 text-sm font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/50"
                  required
                />
                <span className="text-[10px] text-slate-500 block mt-1">Puedes escribir el kilometraje que desees para este próximo cambio.</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Tipo de Aceite Aplicado
              </label>
              <input
                type="text"
                placeholder="Ej. Sintético 5W-30"
                value={editOilType}
                onChange={e => setEditOilType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl py-1.5 px-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Observaciones adicionales
            </label>
            <input
              type="text"
              placeholder="Ej. Filtro de aceite cambiado..."
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsEditModalOpen(false); setEditingRecord(null); }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingEdit ? 'Actualizando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Registrar Correo Electrónico del Cliente */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => { setIsEmailModalOpen(false); setEmailRecord(null); }}
        title="Registrar Correo de Cliente"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEmailAndSend} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Cliente: {emailRecord?.client_name || 'Cliente'}</p>
              <p className="text-blue-700 mt-0.5">
                Vehículo: <strong>{emailRecord?.vehicle_plate}</strong> ({emailRecord?.vehicle_brand} {emailRecord?.vehicle_model})
              </p>
              <p className="text-blue-600 text-[11px] mt-1.5 leading-relaxed">
                Este correo quedará guardado permanentemente en la ficha del cliente para que se envíen los recordatorios directamente sin tener que volver a pedirlo.
              </p>
            </div>
          </div>

          {emailModalError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs">
              {emailModalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Correo Electrónico *
            </label>
            <input
              type="email"
              placeholder="cliente@ejemplo.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsEmailModalOpen(false); setEmailRecord(null); }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEmail}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              {savingEmail ? 'Guardando...' : 'Guardar y Enviar Correo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Configuración de API Requerida */}
      <Modal
        isOpen={missingConfigModal.isOpen}
        onClose={() => setMissingConfigModal({ isOpen: false, type: 'email', record: null })}
        title={
          missingConfigModal.type === 'email'
            ? 'Configurar Envío Directo de Correo (Resend)'
            : 'Configurar Envío Directo de WhatsApp (UltraMsg)'
        }
        maxWidth="md"
      >
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-sm text-amber-950">
                {missingConfigModal.type === 'email'
                  ? '¿Deseas enviar correos automáticamente sin abrir Outlook?'
                  : '¿Deseas enviar WhatsApp automáticamente sin abrir WhatsApp Web?'}
              </p>
              <p className="text-amber-800 leading-relaxed">
                {missingConfigModal.type === 'email'
                  ? 'Para que el sistema envíe los correos en segundo plano con diseño profesional, solo necesitas ingresar tu API Key gratuita de Resend en Configuración > Notificaciones y Mensajería.'
                  : 'Para enviar mensajes transparentes a los teléfonos de tus clientes vía API, ingresa tu Instance ID y Token de UltraMsg en Configuración > Notificaciones y Mensajería.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p><strong>Destinatario:</strong> {missingConfigModal.record?.client_name}</p>
            <p>
              <strong>Contacto:</strong>{' '}
              {missingConfigModal.type === 'email'
                ? (missingConfigModal.record?.client_email || 'Sin correo')
                : (missingConfigModal.record?.client_phone || 'Sin teléfono')}
            </p>
            <p><strong>Vehículo:</strong> {missingConfigModal.record?.vehicle_plate}</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (missingConfigModal.record) {
                  if (missingConfigModal.type === 'email') {
                    window.open(getEmailReminderUrl(missingConfigModal.record), '_blank');
                  } else {
                    window.open(getWhatsAppReminderUrl(missingConfigModal.record), '_blank');
                  }
                }
                setMissingConfigModal({ isOpen: false, type: 'email', record: null });
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {missingConfigModal.type === 'email' ? 'Abrir cliente de correo local' : 'Abrir en WhatsApp Web'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMissingConfigModal({ isOpen: false, type: 'email', record: null });
                navigate('/security/settings');
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Ir a Configuración ahora
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

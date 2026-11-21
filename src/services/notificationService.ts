import { supabase } from '../config/supabase';

export interface NotificationSettings {
  email_provider: 'resend' | 'manual';
  resend_api_key: string;
  resend_from_email: string;
  resend_from_name: string;
  whatsapp_provider: 'ultramsg' | 'cloud_api' | 'manual';
  ultramsg_instance_id: string;
  ultramsg_token: string;
  whatsapp_cloud_phone_id: string;
  whatsapp_cloud_token: string;
  notifications_enabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_provider: 'resend',
  resend_api_key: '',
  resend_from_email: 'onboarding@resend.dev',
  resend_from_name: 'Taller Mecánico',
  whatsapp_provider: 'ultramsg',
  ultramsg_instance_id: '',
  ultramsg_token: '',
  whatsapp_cloud_phone_id: '',
  whatsapp_cloud_token: '',
  notifications_enabled: true
};

const LOCAL_STORAGE_KEY = 'sys_notification_settings';

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  let settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };

  // 1. Intentar cargar de localStorage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      settings = { ...settings, ...JSON.parse(cached) };
    }
  } catch (e) {
    console.warn('Error reading notification settings from localStorage:', e);
  }

  // 2. Intentar cargar de Supabase (sys_settings)
  try {
    const { data, error } = await supabase.from('sys_settings').select('*').limit(1).single();
    if (!error && data) {
      settings = {
        ...settings,
        email_provider: data.email_provider || settings.email_provider,
        resend_api_key: data.resend_api_key || settings.resend_api_key,
        resend_from_email: data.resend_from_email || settings.resend_from_email,
        resend_from_name: data.resend_from_name || data.company_name || settings.resend_from_name,
        whatsapp_provider: data.whatsapp_provider || settings.whatsapp_provider,
        ultramsg_instance_id: data.ultramsg_instance_id || settings.ultramsg_instance_id,
        ultramsg_token: data.ultramsg_token || settings.ultramsg_token,
        whatsapp_cloud_phone_id: data.whatsapp_cloud_phone_id || settings.whatsapp_cloud_phone_id,
        whatsapp_cloud_token: data.whatsapp_cloud_token || settings.whatsapp_cloud_token,
        notifications_enabled: data.notifications_enabled !== undefined ? data.notifications_enabled : settings.notifications_enabled
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (err) {
    console.warn('sys_settings table does not have notification columns yet, using local config:', err);
  }

  return settings;
};

export const saveNotificationSettings = async (newSettings: NotificationSettings): Promise<void> => {
  // Guardar en localStorage
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));

  // Intentar guardar en Supabase
  try {
    const { data: existing } = await supabase.from('sys_settings').select('id').limit(1).single();
    if (existing?.id) {
      await supabase.from('sys_settings').update({
        email_provider: newSettings.email_provider,
        resend_api_key: newSettings.resend_api_key,
        resend_from_email: newSettings.resend_from_email,
        resend_from_name: newSettings.resend_from_name,
        whatsapp_provider: newSettings.whatsapp_provider,
        ultramsg_instance_id: newSettings.ultramsg_instance_id,
        ultramsg_token: newSettings.ultramsg_token,
        whatsapp_cloud_phone_id: newSettings.whatsapp_cloud_phone_id,
        whatsapp_cloud_token: newSettings.whatsapp_cloud_token,
        notifications_enabled: newSettings.notifications_enabled
      }).eq('id', existing.id);
    }
  } catch (err) {
    console.warn('Could not persist notification settings to sys_settings remotely (saved locally):', err);
  }
};

export const formatEcuadorianPhone = (phone: string): string => {
  let clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  if (clean.startsWith('0')) {
    clean = '593' + clean.substring(1);
  } else if (!clean.startsWith('593') && clean.length === 9) {
    clean = '593' + clean;
  }
  return clean;
};

export interface SendOilReminderEmailParams {
  toEmail: string;
  toName: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  currentKm: number;
  nextKm: number;
  oilType?: string;
  serviceDate: string;
  companyName?: string;
}

export const sendOilReminderEmail = async (params: SendOilReminderEmailParams): Promise<{ success: boolean; message: string }> => {
  const settings = await getNotificationSettings();

  if (!params.toEmail || !params.toEmail.includes('@')) {
    return { success: false, message: 'El cliente no tiene un correo electrónico válido.' };
  }

  if (!settings.resend_api_key) {
    return {
      success: false,
      message: 'MISSING_API_KEY: Falta configurar la API Key de Resend en Configuración > Notificaciones.'
    };
  }

  const senderName = settings.resend_from_name || params.companyName || 'Taller Mecánico';
  const senderEmail = settings.resend_from_email || 'onboarding@resend.dev';
  const vehicleText = [params.vehicleBrand, params.vehicleModel].filter(Boolean).join(' ') || 'su vehículo';
  const subject = `🚗 Recordatorio de Mantenimiento - Vehículo ${params.vehiclePlate} (${vehicleText})`;

  const formattedDate = new Date(params.serviceDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
        .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .card { background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .card-row:last-child { border-bottom: none; }
        .card-label { color: #64748b; font-weight: 500; }
        .card-value { font-weight: 700; color: #0f172a; }
        .highlight { color: #4f46e5; font-size: 16px; }
        .cta-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px; }
        .cta-box p { margin: 0; font-size: 13px; line-height: 1.5; color: #1e40af; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${senderName}</h1>
          <p>Control y Mantenimiento Preventivo de Vehículos</p>
        </div>
        <div class="content">
          <div class="greeting">Estimado/a ${params.toName || 'Cliente'},</div>
          <div class="intro">
            Le saludamos cordialmente. Nuestro sistema de monitoreo le recuerda el estado de mantenimiento registrado para su vehículo:
          </div>

          <div class="card">
            <div class="card-row">
              <span class="card-label">Vehículo:</span>
              <span class="card-value">${vehicleText}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Placa:</span>
              <span class="card-value">${params.vehiclePlate}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Fecha del Último Servicio:</span>
              <span class="card-value">${formattedDate}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Kilometraje en el Cambio:</span>
              <span class="card-value">${params.currentKm.toLocaleString()} km</span>
            </div>
            <div class="card-row">
              <span class="card-label">Tipo de Aceite Aplicado:</span>
              <span class="card-value">${params.oilType || 'Sintético 5W-30'}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Próximo Cambio Sugerido:</span>
              <span class="card-value highlight">${params.nextKm.toLocaleString()} km</span>
            </div>
          </div>

          <div class="cta-box">
            <p><strong>¿Desea revisar cuántos kilómetros le faltan o agendar su cita?</strong><br>
            Puede responder directamente a este correo indicándonos cuántos kilómetros marca su odómetro hoy y con gusto le informaremos si se encuentra en tiempo óptimo.</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Cuidar el aceite de su motor a tiempo protege su inversión y garantiza el óptimo desempeño de su vehículo.
          </p>
        </div>
        <div class="footer">
          ${senderName} • Notificación Automática de Mantenimiento
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail.trim()}>`,
        to: [params.toEmail.trim()],
        subject,
        html: htmlContent
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error del servidor de correos (${response.status})`);
    }

    return {
      success: true,
      message: `Correo enviado exitosamente a ${params.toEmail}`
    };
  } catch (error: any) {
    console.error('Error enviando correo con Resend:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al enviar correo.'
    };
  }
};

export interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export const sendWhatsAppNotification = async (params: SendWhatsAppParams): Promise<{ success: boolean; message: string }> => {
  const settings = await getNotificationSettings();
  const cleanPhone = formatEcuadorianPhone(params.phone);

  if (!cleanPhone || cleanPhone.length < 9) {
    return { success: false, message: 'El cliente no tiene un número de teléfono válido para WhatsApp.' };
  }

  // 1. Caso UltraMsg (Envío directo vía REST)
  if (settings.whatsapp_provider === 'ultramsg') {
    if (!settings.ultramsg_instance_id || !settings.ultramsg_token) {
      return {
        success: false,
        message: 'MISSING_WHATSAPP_CONFIG: Falta configurar el Instance ID y Token de UltraMsg en Configuración > Notificaciones.'
      };
    }

    try {
      const endpoint = `https://api.ultramsg.com/${settings.ultramsg_instance_id.trim()}/messages/chat`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          token: settings.ultramsg_token.trim(),
          to: cleanPhone,
          body: params.message
        })
      });

      const data = await response.json();
      if (data.sent === 'true' || data.sent === true || data.id) {
        return {
          success: true,
          message: `Mensaje de WhatsApp enviado exitosamente a +${cleanPhone}`
        };
      } else {
        throw new Error(data.message || data.error || 'No se pudo enviar el mensaje por UltraMsg.');
      }
    } catch (err: any) {
      console.error('Error enviando por UltraMsg:', err);
      return { success: false, message: err.message || 'Error al conectar con UltraMsg.' };
    }
  }

  // 2. Caso Meta WhatsApp Cloud API
  if (settings.whatsapp_provider === 'cloud_api') {
    if (!settings.whatsapp_cloud_phone_id || !settings.whatsapp_cloud_token) {
      return {
        success: false,
        message: 'MISSING_WHATSAPP_CONFIG: Falta configurar el Phone Number ID y Access Token de Meta en Configuración > Notificaciones.'
      };
    }

    try {
      const endpoint = `https://graph.facebook.com/v19.0/${settings.whatsapp_cloud_phone_id.trim()}/messages`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.whatsapp_cloud_token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: params.message }
        })
      });

      const data = await response.json();
      if (response.ok && data.messages) {
        return {
          success: true,
          message: `Mensaje de WhatsApp enviado exitosamente a +${cleanPhone}`
        };
      } else {
        throw new Error(data.error?.message || 'Error al enviar por WhatsApp Cloud API.');
      }
    } catch (err: any) {
      console.error('Error enviando por WhatsApp Cloud API:', err);
      return { success: false, message: err.message || 'Error con Meta WhatsApp Cloud API.' };
    }
  }

  return {
    success: false,
    message: 'MISSING_WHATSAPP_CONFIG: No hay un proveedor de WhatsApp automático configurado.'
  };
};

export interface SendInvoiceEmailParams {
  toEmail: string;
  toName: string;
  invoiceNumber: string;
  date: string;
  branchName?: string;
  warehouseName?: string;
  clientDoc?: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  oilChangeData?: {
    vehiclePlate: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    currentMileage: number;
    nextChangeMileage: number;
    oilType?: string;
  };
  companyName?: string;
}

export const sendInvoiceEmail = async (params: SendInvoiceEmailParams): Promise<{ success: boolean; message: string }> => {
  const settings = await getNotificationSettings();

  if (!params.toEmail || !params.toEmail.includes('@')) {
    return { success: false, message: 'El cliente no tiene un correo electrónico válido.' };
  }

  if (!settings.resend_api_key) {
    return {
      success: false,
      message: 'MISSING_API_KEY: Falta configurar la API Key de Resend en Configuración > Notificaciones.'
    };
  }

  const senderName = settings.resend_from_name || params.companyName || 'Taller Mecánico';
  const senderEmail = settings.resend_from_email || 'onboarding@resend.dev';
  const subject = `🧾 Comprobante de Venta ${params.invoiceNumber} - ${senderName}`;

  const itemsHtml = params.items
    .map(
      it => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${it.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px;">${it.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px;">$${it.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; font-size: 13px;">$${it.total.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 0; font-size: 12px; opacity: 0.8; }
        .content { padding: 24px; }
        .meta-box { background: #f1f5f9; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .totals { margin-top: 15px; margin-left: auto; width: 220px; font-size: 13px; }
        .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
        .grand-total { font-weight: 800; font-size: 16px; color: #4338ca; border-top: 2px solid #e2e8f0; padding-top: 6px !important; }
        .oil-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; margin-top: 24px; }
        .footer { text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${senderName}</h1>
          <p>Comprobante Digital de Venta</p>
        </div>
        <div class="content">
          <div class="meta-box">
            <div><strong>Comprobante:</strong> ${params.invoiceNumber}</div>
            <div><strong>Fecha:</strong> ${params.date}</div>
            <div><strong>Cliente:</strong> ${params.toName}</div>
            ${params.clientDoc ? `<div><strong>RUC/Cédula:</strong> ${params.clientDoc}</div>` : ''}
            ${params.branchName ? `<div><strong>Sucursal:</strong> ${params.branchName}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Producto / Servicio</th>
                <th style="text-align: center;">Cant.</th>
                <th style="text-align: right;">P. Unit</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div><span>Subtotal:</span><span>$${params.subtotal.toFixed(2)}</span></div>
            <div><span>IVA:</span><span>$${params.tax.toFixed(2)}</span></div>
            <div class="grand-total"><span>Total:</span><span>$${params.total.toFixed(2)}</span></div>
          </div>

          ${
            params.oilChangeData
              ? `
            <div class="oil-card">
              <strong style="color: #1e40af; font-size: 13px; display: block; margin-bottom: 6px;">🚗 Ficha de Mantenimiento Vehicular</strong>
              <div style="font-size: 12px; line-height: 1.6; color: #1e3a8a;">
                <div>• <strong>Vehículo:</strong> ${[params.oilChangeData.vehicleBrand, params.oilChangeData.vehicleModel].filter(Boolean).join(' ') || 'Vehículo'} (Placa: ${params.oilChangeData.vehiclePlate})</div>
                <div>• <strong>Km al Servicio:</strong> ${params.oilChangeData.currentMileage.toLocaleString()} km</div>
                <div>• <strong>Próximo Cambio Sugerido:</strong> <span style="font-weight: 800; color: #1d4ed8;">${params.oilChangeData.nextChangeMileage.toLocaleString()} km</span></div>
                <div>• <strong>Aceite:</strong> ${params.oilChangeData.oilType || 'Sintético 5W-30'}</div>
              </div>
            </div>
          `
              : ''
          }
        </div>
        <div class="footer">
          ${senderName} • Gracias por su preferencia
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail.trim()}>`,
        to: [params.toEmail.trim()],
        subject,
        html: htmlContent
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error del servidor de correos (${response.status})`);
    }

    return {
      success: true,
      message: `Factura enviada exitosamente a ${params.toEmail}`
    };
  } catch (error: any) {
    console.error('Error enviando factura por correo:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al enviar factura.'
    };
  }
};

export interface SendInvoiceWhatsAppParams {
  phone: string;
  clientName: string;
  clientDoc?: string;
  invoiceNumber: string;
  date: string;
  branchName?: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  oilChangeData?: {
    vehiclePlate: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    currentMileage: number;
    nextChangeMileage: number;
    oilType?: string;
  };
  companyName?: string;
}

export const formatInvoiceWhatsAppText = (params: SendInvoiceWhatsAppParams): string => {
  const company = params.companyName || 'TALLER MECÁNICO';
  let text = `🧾 *COMPROBANTE DE VENTA ELECTRÓNICO*\n`;
  text += `*${company}*\n`;
  text += `------------------------------------\n`;
  text += `*N° Factura:* ${params.invoiceNumber}\n`;
  text += `*Fecha:* ${params.date}\n`;
  if (params.branchName) text += `*Sucursal:* ${params.branchName}\n`;
  text += `*Cliente:* ${params.clientName}\n`;
  if (params.clientDoc) text += `*RUC/C.I.:* ${params.clientDoc}\n`;
  text += `------------------------------------\n`;
  text += `*DETALLE DE PRODUCTOS / SERVICIOS:*\n`;
  params.items.forEach(it => {
    text += `• ${it.quantity}x ${it.name} - $${it.total.toFixed(2)}\n`;
  });
  text += `------------------------------------\n`;
  text += `*Subtotal:* $${params.subtotal.toFixed(2)}\n`;
  text += `*IVA:* $${params.tax.toFixed(2)}\n`;
  text += `*TOTAL COBRADO:* $${params.total.toFixed(2)}\n`;

  if (params.oilChangeData) {
    const vText = [params.oilChangeData.vehicleBrand, params.oilChangeData.vehicleModel].filter(Boolean).join(' ') || 'Vehículo';
    text += `------------------------------------\n`;
    text += `🚗 *CONTROL DE MANTENIMIENTO VEHICULAR*\n`;
    text += `*Vehículo:* ${vText} (Placa: ${params.oilChangeData.vehiclePlate})\n`;
    text += `*Km Actual:* ${params.oilChangeData.currentMileage.toLocaleString()} km\n`;
    text += `*Próximo Cambio:* ${params.oilChangeData.nextChangeMileage.toLocaleString()} km\n`;
    if (params.oilChangeData.oilType) text += `*Aceite:* ${params.oilChangeData.oilType}\n`;
  }

  text += `------------------------------------\n`;
  text += `¡Gracias por su preferencia!`;
  return text;
};

export const sendInvoiceWhatsApp = async (
  params: SendInvoiceWhatsAppParams
): Promise<{ success: boolean; message: string; webFallbackUrl?: string }> => {
  const text = formatInvoiceWhatsAppText(params);
  const cleanPhone = formatEcuadorianPhone(params.phone);
  const webFallbackUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

  if (!cleanPhone || cleanPhone.length < 9) {
    return {
      success: false,
      message: 'El cliente no tiene un teléfono válido para WhatsApp.',
      webFallbackUrl
    };
  }

  const settings = await getNotificationSettings();

  // Si está en modo manual o no hay API configurada, abrir fallback web directamente
  if (settings.whatsapp_provider === 'manual') {
    return {
      success: true,
      message: 'Abriendo WhatsApp Web...',
      webFallbackUrl
    };
  }

  const res = await sendWhatsAppNotification({
    phone: cleanPhone,
    message: text
  });

  return {
    ...res,
    webFallbackUrl
  };
};


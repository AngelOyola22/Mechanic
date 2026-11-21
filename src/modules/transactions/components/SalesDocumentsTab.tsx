import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Search, Eye, Printer, Calendar, RefreshCw, FileText, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { printThermalTicket } from '../../../utils/printTicket';
import { sendInvoiceEmail } from '../../../services/notificationService';

export interface SaleDetailItem {
  id: number;
  quantity: number;
  unit_price: number;
  tax_applied: number;
  cat_products?: {
    id: number;
    name: string;
    sku: string;
  };
}

export interface SaleRecord {
  id: number;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  cat_clients?: {
    id: number;
    name: string;
    document_id: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  cat_branches?: {
    id: number;
    name: string;
  };
  tra_sale_details?: SaleDetailItem[];
}

export const SalesDocumentsTab: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  // Fechas (por defecto: mes actual)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal Detalle
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    fetchBranches();
    fetchSales();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase.from('cat_branches').select('id, name').eq('is_active', true);
    if (data) setBranches(data);
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tra_sales')
        .select(`
          id, invoice_number, subtotal, tax_amount, total_amount, status, created_at,
          cat_clients(id, name, document_id, email, phone, address),
          cat_branches(id, name),
          tra_sale_details(
            id, quantity, unit_price, tax_applied,
            cat_products(id, name, sku)
          )
        `)
        .order('id', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSales((data as any) || []);
    } catch (err) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const pastWeek = new Date();
      pastWeek.setDate(now.getDate() - 7);
      setStartDate(pastWeek.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredSales = sales.filter(s => {
    const matchSearch =
      s.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cat_clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cat_clients?.document_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchBranch = selectedBranch === 'all' || s.cat_branches?.id?.toString() === selectedBranch;

    return matchSearch && matchBranch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, startDate, endDate]);

  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);
  const paginatedSales = filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getOilDataForSale = (sale: SaleRecord) => {
    try {
      const localOil: any[] = JSON.parse(localStorage.getItem('sys_tra_oil_changes_backup') || '[]');
      const match = localOil.find(o => o.sale_id === sale.id || (sale.invoice_number && o.invoice_number === sale.invoice_number));
      if (match) {
        return {
          vehiclePlate: match.vehicle_plate,
          vehicleBrand: match.vehicle_brand,
          vehicleModel: match.vehicle_model,
          currentMileage: match.current_mileage,
          nextChangeMileage: match.next_change_mileage,
          oilType: match.oil_type
        };
      }
    } catch (e) { }
    return undefined;
  };

  const handlePrint = (sale: SaleRecord) => {
    const oilData = getOilDataForSale(sale);
    const items = (sale.tra_sale_details || []).map(d => ({
      name: d.cat_products?.name || 'Item',
      quantity: d.quantity,
      unitPrice: d.unit_price,
      total: d.quantity * d.unit_price
    }));

    printThermalTicket({
      branchName: sale.cat_branches?.name || 'Matriz',
      warehouseName: 'Bodega Principal',
      invoiceNumber: sale.invoice_number,
      date: new Date(sale.created_at).toLocaleString(),
      clientName: sale.cat_clients?.name || 'Consumidor Final',
      clientDoc: sale.cat_clients?.document_id || '9999999999999',
      items,
      subtotal: sale.subtotal,
      tax: sale.tax_amount,
      total: sale.total_amount,
      oilChangeData: oilData
    });
  };

  const handleSendEmail = async (sale: SaleRecord) => {
    let email = sale.cat_clients?.email;
    if (!email || !email.includes('@')) {
      const input = window.prompt(`Ingrese el correo electrónico para ${sale.cat_clients?.name || 'el cliente'}:`, '');
      if (!input || !input.includes('@')) return;
      email = input.trim();
      if (sale.cat_clients?.id) {
        try {
          await supabase.from('cat_clients').update({ email }).eq('id', sale.cat_clients.id);
        } catch (e) { }
      }
    }

    try {
      setSendingEmailId(sale.id);
      setEmailAlert(null);

      const items = (sale.tra_sale_details || []).map(d => ({
        name: d.cat_products?.name || 'Item',
        quantity: d.quantity,
        unitPrice: d.unit_price,
        total: d.quantity * d.unit_price
      }));

      const res = await sendInvoiceEmail({
        toEmail: email,
        toName: sale.cat_clients?.name || 'Cliente',
        invoiceNumber: sale.invoice_number,
        date: new Date(sale.created_at).toLocaleString(),
        branchName: sale.cat_branches?.name || 'Matriz',
        warehouseName: 'Bodega Principal',
        clientDoc: sale.cat_clients?.document_id || '9999999999999',
        items,
        subtotal: sale.subtotal,
        tax: sale.tax_amount,
        total: sale.total_amount,
        oilChangeData: getOilDataForSale(sale)
      });

      if (res.success) {
        setEmailAlert({ type: 'success', text: `✅ Factura enviada con éxito a ${email}` });
        setTimeout(() => setEmailAlert(null), 5000);
      } else {
        setEmailAlert({ type: 'error', text: `❌ ${res.message}` });
      }
    } catch (err: any) {
      setEmailAlert({ type: 'error', text: `❌ Error: ${err.message}` });
    } finally {
      setSendingEmailId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de notificación por correo */}
      {emailAlert && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition-all shadow-sm ${emailAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
            }`}
        >
          <span>{emailAlert.text}</span>
          <button
            type="button"
            onClick={() => setEmailAlert(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por N° factura o cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Sucursal */}
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas las sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id.toString()}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Rango de fechas */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent outline-none text-slate-700"
            />
            <span className="text-slate-400">a</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent outline-none text-slate-700"
            />
          </div>

          {/* Botones rápidos */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => applyPreset('today')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => applyPreset('week')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              7d
            </button>
            <button
              onClick={() => applyPreset('month')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Mes
            </button>
            <button
              onClick={fetchSales}
              title="Recargar"
              className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Documentos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && sales.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Cargando documentos de venta...</div>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-slate-400" />}
            title="No se encontraron comprobantes"
            description="No hay registros de ventas para los filtros seleccionados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">N° Comprobante</th>
                  <th className="py-3.5 px-4">Fecha y Hora</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Sucursal</th>
                  <th className="py-3.5 px-4 text-right">Subtotal</th>
                  <th className="py-3.5 px-4 text-right">IVA</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-600">
                      {sale.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(sale.created_at).toLocaleString('es-EC', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{sale.cat_clients?.name || 'Consumidor Final'}</div>
                      <div className="text-xs text-slate-400">{sale.cat_clients?.document_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {sale.cat_branches?.name || 'Matriz'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ${sale.subtotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 text-xs">
                      ${sale.tax_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${sale.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {sale.status === 'COMPLETED' ? 'Emitida' : sale.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setIsDetailOpen(true);
                          }}
                          title="Ver Detalle"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(sale)}
                          title="Imprimir Ticket Térmico (40 col)"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          disabled={sendingEmailId === sale.id}
                          onClick={() => handleSendEmail(sale)}
                          title="Enviar Factura por Correo"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {sendingEmailId === sale.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredSales.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSales.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Modal Detalle de Venta */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Detalle de Venta: ${selectedSale?.invoice_number || ''}`}
        maxWidth="2xl"
      >
        {selectedSale && (
          <div className="p-6 space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Fecha:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedSale.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Sucursal:</span>
                <span className="font-semibold text-slate-700">{selectedSale.cat_branches?.name || 'Matriz'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Cliente:</span>
                <span className="font-semibold text-slate-700">{selectedSale.cat_clients?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Identificación:</span>
                <span className="font-semibold text-slate-700">{selectedSale.cat_clients?.document_id}</span>
              </div>
            </div>

            {/* Tabla de Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">P. Unit</th>
                    <th className="py-2.5 px-3 text-right">IVA</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedSale.tra_sale_details || []).map(item => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                        {item.cat_products?.sku || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {item.cat_products?.name || 'Producto'}
                      </td>
                      <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right">${item.unit_price.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                        ${item.tax_applied.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales y Acciones */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(selectedSale)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Ticket
                </button>

                <button
                  type="button"
                  disabled={sendingEmailId === selectedSale.id}
                  onClick={() => handleSendEmail(selectedSale)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-2 text-sm font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {sendingEmailId === selectedSale.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Enviar Factura por Correo
                </button>
              </div>

              <div className="w-full md:w-64 space-y-1.5 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">${selectedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Impuestos (IVA):</span>
                  <span className="font-mono font-semibold">${selectedSale.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-indigo-600 pt-1 border-t border-slate-200">
                  <span>Total Cobrado:</span>
                  <span className="font-mono">${selectedSale.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

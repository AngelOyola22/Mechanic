import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Search, Eye, Printer, Calendar, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';

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

  const handlePrint = (sale: SaleRecord) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    const itemsHtml = (sale.tra_sale_details || [])
      .map(
        d => `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.cat_products?.name || 'Item'}</td>
          <td style="text-align: center; padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.quantity}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${d.unit_price.toFixed(2)}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${(d.quantity * d.unit_price).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const now = new Date();

    // Check if there is an oil change record for this sale
    let oilDataHtml = '';
    try {
      const localOil: any[] = JSON.parse(localStorage.getItem('sys_tra_oil_changes_backup') || '[]');
      const match = localOil.find(o => o.sale_id === sale.id || (sale.invoice_number && o.invoice_number === sale.invoice_number));
      if (match) {
        oilDataHtml = `
          <div style="margin-top: 15px; border: 2px dashed #111; padding: 8px; text-align: center; border-radius: 4px;">
            <div style="font-weight: bold; font-size: 13px;">🚗 RECORDATORIO DE CAMBIO DE ACEITE</div>
            <div style="margin-top: 4px;">Vehículo: <strong>${[match.vehicle_brand, match.vehicle_model].filter(Boolean).join(' ')} (${match.vehicle_plate})</strong></div>
            <div>Km Actual: <strong>${match.current_mileage?.toLocaleString()} km</strong></div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 4px; color: #000;">
              PRÓXIMO CAMBIO: ${match.next_change_mileage?.toLocaleString()} km
            </div>
            <div>Aceite: ${match.oil_type || 'Sintético'}</div>
          </div>
        `;
      }
    } catch (e) {}

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante ${sale.invoice_number}</title>
          <style>
            body { font-family: monospace; padding: 20px; font-size: 13px; color: #111; }
            .header { text-align: center; margin-bottom: 15px; }
            .title { font-size: 16px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .totals { margin-top: 15px; border-top: 1px dashed #333; padding-top: 8px; text-align: right; }
            .totals div { margin: 4px 0; }
            .bold { font-weight: bold; font-size: 15px; }
            .footer { text-align: center; margin-top: 25px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">TALLER MECÁNICO</div>
            <div>Sucursal: ${sale.cat_branches?.name || 'Matriz'}</div>
            <div><strong>Comprobante: ${sale.invoice_number}</strong></div>
            <div>Fecha: ${new Date(sale.created_at).toLocaleString()}</div>
          </div>
          <div><strong>Cliente:</strong> ${sale.cat_clients?.name || 'Consumidor Final'}</div>
          <div><strong>Identificación:</strong> ${sale.cat_clients?.document_id || '9999999999999'}</div>
          ${sale.cat_clients?.address ? `<div><strong>Dirección:</strong> ${sale.cat_clients.address}</div>` : ''}

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #333; text-align: left;">
                <th style="padding: 4px;">Producto</th>
                <th style="text-align: center; padding: 4px;">Cant</th>
                <th style="text-align: right; padding: 4px;">P.Unit</th>
                <th style="text-align: right; padding: 4px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div>Subtotal: $${sale.subtotal.toFixed(2)}</div>
            <div>IVA: $${sale.tax_amount.toFixed(2)}</div>
            <div class="bold">TOTAL: $${sale.total_amount.toFixed(2)}</div>
          </div>

          ${oilDataHtml}

          <div class="footer">
            <p>¡Gracias por su preferencia!</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
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
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(sale)}
                          title="Reimprimir Ticket"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Printer className="w-4 h-4" />
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

            {/* Totales */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => handlePrint(selectedSale)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir Comprobante
              </button>

              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>${selectedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Impuestos (IVA):</span>
                  <span>${selectedSale.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-indigo-600 pt-1 border-t border-slate-200">
                  <span>Total Cobrado:</span>
                  <span>${selectedSale.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

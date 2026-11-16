import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Search, Eye, Printer, Calendar, RefreshCw, FileText, CheckCircle2, Warehouse as WarehouseIcon } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';

export interface PurchaseDetailItem {
  id: number;
  quantity: number;
  unit_cost: number;
  cat_products?: {
    id: number;
    name: string;
    sku: string;
  };
}

export interface PurchaseRecord {
  id: number;
  invoice_number: string;
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
  cat_warehouses?: {
    id: number;
    name: string;
  };
  tra_purchase_details?: PurchaseDetailItem[];
}

export const PurchasesDocumentsTab: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);

  // Fechas (por defecto: mes actual)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal Detalle
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    fetchWarehouses();
    fetchPurchases();
  }, []);

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('cat_warehouses').select('id, name').eq('is_active', true);
    if (data) setWarehouses(data);
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tra_purchases')
        .select(`
          id, invoice_number, total_amount, status, created_at,
          cat_clients(id, name, document_id, email, phone, address),
          cat_warehouses(id, name),
          tra_purchase_details(
            id, quantity, unit_cost,
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
      setPurchases((data as any) || []);
    } catch (err) {
      console.error('Error al cargar compras:', err);
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

  const filteredPurchases = purchases.filter(p => {
    const matchSearch =
      p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cat_clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cat_clients?.document_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchWh = selectedWarehouse === 'all' || p.cat_warehouses?.id?.toString() === selectedWarehouse;

    return matchSearch && matchWh;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedWarehouse, startDate, endDate]);

  const totalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePrint = (purchase: PurchaseRecord) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    const itemsHtml = (purchase.tra_purchase_details || [])
      .map(
        d => `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.cat_products?.name || 'Item'}</td>
          <td style="text-align: center; padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.quantity}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${d.unit_cost.toFixed(2)}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${(d.quantity * d.unit_cost).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Ingreso ${purchase.invoice_number}</title>
          <style>
            body { font-family: monospace; padding: 20px; font-size: 13px; color: #111; }
            .header { text-align: center; margin-bottom: 15px; }
            .title { font-size: 16px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .totals { margin-top: 15px; border-top: 1px dashed #333; padding-top: 8px; text-align: right; }
            .bold { font-weight: bold; font-size: 15px; }
            .footer { text-align: center; margin-top: 25px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">COMPROBANTE DE INGRESO DE MERCADERÍA</div>
            <div>Bodega de Destino: ${purchase.cat_warehouses?.name || 'Bodega'}</div>
            <div><strong>Factura Proveedor: ${purchase.invoice_number}</strong></div>
            <div>Fecha: ${new Date(purchase.created_at).toLocaleString()}</div>
          </div>
          <div><strong>Proveedor:</strong> ${purchase.cat_clients?.name || 'N/A'}</div>
          <div><strong>RUC/Identificación:</strong> ${purchase.cat_clients?.document_id || 'N/A'}</div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #333; text-align: left;">
                <th style="padding: 4px;">Producto</th>
                <th style="text-align: center; padding: 4px;">Cant</th>
                <th style="text-align: right; padding: 4px;">Costo Unit</th>
                <th style="text-align: right; padding: 4px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="bold">TOTAL INGRESADO: $${purchase.total_amount.toFixed(2)}</div>
          </div>

          <div class="footer">
            <p>Registro interno de recepción de bodega.</p>
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
              placeholder="Buscar por N° factura o proveedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Bodega */}
          <div className="flex items-center gap-1.5">
            <WarehouseIcon className="w-4 h-4 text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las bodegas</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id.toString()}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
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

          {/* Presets */}
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
              onClick={fetchPurchases}
              title="Recargar"
              className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Documentos de Compra */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && purchases.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Cargando facturas de compra...</div>
        ) : filteredPurchases.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-slate-400" />}
            title="No se encontraron compras"
            description="No hay facturas registradas para los filtros seleccionados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">N° Factura Proveedor</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4">Bodega Ingreso</th>
                  <th className="py-3.5 px-4 text-right">Total Invertido</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPurchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600">
                      {purchase.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {new Date(purchase.created_at).toLocaleString('es-EC', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{purchase.cat_clients?.name || 'Proveedor General'}</div>
                      <div className="text-xs text-slate-400">{purchase.cat_clients?.document_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {purchase.cat_warehouses?.name || 'Bodega Principal'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${purchase.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {purchase.status === 'COMPLETED' ? 'Ingresada' : purchase.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsDetailOpen(true);
                          }}
                          title="Ver Detalle"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(purchase)}
                          title="Imprimir Comprobante"
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

        {filteredPurchases.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPurchases.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Modal Detalle de Compra */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Detalle de Compra: ${selectedPurchase?.invoice_number || ''}`}
        maxWidth="2xl"
      >
        {selectedPurchase && (
          <div className="p-6 space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Fecha:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedPurchase.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Bodega Ingreso:</span>
                <span className="font-semibold text-slate-700">{selectedPurchase.cat_warehouses?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Proveedor:</span>
                <span className="font-semibold text-slate-700">{selectedPurchase.cat_clients?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">RUC / Cédula:</span>
                <span className="font-semibold text-slate-700">{selectedPurchase.cat_clients?.document_id}</span>
              </div>
            </div>

            {/* Tabla de Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Insumo / Repuesto</th>
                    <th className="py-2.5 px-3 text-center">Cant. Ingresada</th>
                    <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedPurchase.tra_purchase_details || []).map(item => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                        {item.cat_products?.sku || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {item.cat_products?.name || 'Producto'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-600">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right">${item.unit_cost.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        ${(item.quantity * item.unit_cost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => handlePrint(selectedPurchase)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir Comprobante
              </button>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Total de la Factura:</span>
                <span className="text-xl font-extrabold text-blue-600">
                  ${selectedPurchase.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

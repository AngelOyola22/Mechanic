import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  Download, 
  Calendar, 
  RefreshCw,
  ShoppingBag,
  Store
} from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { SaleRecord } from './SalesDocumentsTab';

export const SalesReportsTab: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  // Fechas (por defecto: mes actual)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchBranches();
    fetchReportData();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase.from('cat_branches').select('id, name').eq('is_active', true);
    if (data) setBranches(data);
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tra_sales')
        .select(`
          id, invoice_number, subtotal, tax_amount, total_amount, status, created_at,
          cat_clients(id, name, document_id),
          cat_branches(id, name),
          tra_sale_details(
            id, quantity, unit_price, tax_applied,
            cat_products(id, name, sku)
          )
        `)
        .order('created_at', { ascending: false });

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
      console.error('Error al generar informe de ventas:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'year') => {
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
    } else if (preset === 'year') {
      const firstYearDay = new Date(now.getFullYear(), 0, 1);
      setStartDate(firstYearDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const filteredSales = sales.filter(s => {
    return selectedBranch === 'all' || s.cat_branches?.id?.toString() === selectedBranch;
  });

  // Métricas Generales
  const totalRevenue = filteredSales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  const totalSubtotal = filteredSales.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
  const totalTax = filteredSales.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0);
  const countTransactions = filteredSales.length;
  const averageTicket = countTransactions > 0 ? totalRevenue / countTransactions : 0;

  // Top Productos
  const [productsPage, setProductsPage] = useState(1);
  const PRODUCTS_PAGE_SIZE = 5;

  const productStatsMap: { [key: string]: { name: string; sku: string; quantity: number; revenue: number } } = {};
  filteredSales.forEach(s => {
    (s.tra_sale_details || []).forEach(d => {
      const pName = d.cat_products?.name || 'Producto Desconocido';
      const pSku = d.cat_products?.sku || '-';
      const key = `${pSku}-${pName}`;
      if (!productStatsMap[key]) {
        productStatsMap[key] = { name: pName, sku: pSku, quantity: 0, revenue: 0 };
      }
      productStatsMap[key].quantity += d.quantity;
      productStatsMap[key].revenue += d.quantity * d.unit_price;
    });
  });

  const allTopProducts = Object.values(productStatsMap).sort((a, b) => b.revenue - a.revenue);
  const totalProductsPages = Math.ceil(allTopProducts.length / PRODUCTS_PAGE_SIZE);
  const paginatedTopProducts = allTopProducts.slice(
    (productsPage - 1) * PRODUCTS_PAGE_SIZE,
    productsPage * PRODUCTS_PAGE_SIZE
  );

  // Ventas por Sucursal
  const branchStatsMap: { [key: string]: { name: string; count: number; total: number } } = {};
  filteredSales.forEach(s => {
    const bName = s.cat_branches?.name || 'Matriz';
    if (!branchStatsMap[bName]) {
      branchStatsMap[bName] = { name: bName, count: 0, total: 0 };
    }
    branchStatsMap[bName].count += 1;
    branchStatsMap[bName].total += s.total_amount;
  });
  const branchStats = Object.values(branchStatsMap).sort((a, b) => b.total - a.total);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    const headers = ['N° Comprobante', 'Fecha', 'Cliente', 'Identificacion', 'Sucursal', 'Subtotal', 'IVA', 'Total', 'Estado'];
    const rows = filteredSales.map(s => [
      `"${s.invoice_number || ''}"`,
      `"${new Date(s.created_at).toLocaleString()}"`,
      `"${s.cat_clients?.name || ''}"`,
      `"${s.cat_clients?.document_id || ''}"`,
      `"${s.cat_branches?.name || ''}"`,
      s.subtotal.toFixed(2),
      s.tax_amount.toFixed(2),
      s.total_amount.toFixed(2),
      s.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `informe_ventas_${startDate}_al_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sucursal */}
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-400" />
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

          {/* Rango de Fechas */}
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
              onClick={() => applyPreset('year')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Año
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReportData}
            title="Actualizar datos"
            className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recaudado</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">${totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Subtotal: ${totalSubtotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transacciones</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{countTransactions}</p>
            <p className="text-xs text-slate-500 mt-0.5">Facturas emitidas</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Promedio</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">${averageTicket.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Por cada venta</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total IVA (Impuestos)</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">${totalTax.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Tributo generado</p>
          </div>
        </div>
      </div>

      {/* Secciones Analíticas: Top Productos y Ventas por Sucursal */}
      {filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={<BarChart3 className="w-8 h-8 text-slate-400" />}
            title="Sin datos para generar informe"
            description="No se registran ventas en el período o sucursal seleccionada."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Productos */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              Ranking de Productos más Vendidos
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 font-mono">SKU</th>
                    <th className="py-2.5 px-3 text-center">Unidades</th>
                    <th className="py-2.5 px-3 text-right">Recaudado</th>
                    <th className="py-2.5 px-3 text-right">% Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTopProducts.map((p, index) => {
                    const percent = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
                    const itemNumber = (productsPage - 1) * PRODUCTS_PAGE_SIZE + index + 1;
                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-400 text-xs">{itemNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{p.name}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{p.sku}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-600">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">${p.revenue.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500">{percent.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {allTopProducts.length > 0 && (
              <Pagination
                currentPage={productsPage}
                totalPages={totalProductsPages}
                totalItems={allTopProducts.length}
                pageSize={PRODUCTS_PAGE_SIZE}
                onPageChange={setProductsPage}
              />
            )}
          </div>

          {/* Ventas por Sucursal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-blue-600" />
              Ventas por Sucursal
            </h3>
            <div className="space-y-4">
              {branchStats.map((b, index) => {
                const percent = totalRevenue > 0 ? (b.total / totalRevenue) * 100 : 0;
                return (
                  <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-800">{b.name}</span>
                      <span className="font-extrabold text-indigo-600">${b.total.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{b.count} {b.count === 1 ? 'factura' : 'facturas'}</span>
                      <span>{percent.toFixed(1)}% del total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

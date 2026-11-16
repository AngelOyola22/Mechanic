import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Download, 
  Calendar, 
  RefreshCw,
  Building,
  Package
} from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { PurchaseRecord } from './PurchasesDocumentsTab';

export const PurchasesReportsTab: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);

  // Fechas (por defecto: mes actual)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchWarehouses();
    fetchReportData();
  }, []);

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('cat_warehouses').select('id, name').eq('is_active', true);
    if (data) setWarehouses(data);
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tra_purchases')
        .select(`
          id, invoice_number, total_amount, status, created_at,
          cat_clients(id, name, document_id),
          cat_warehouses(id, name),
          tra_purchase_details(
            id, quantity, unit_cost,
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
      setPurchases((data as any) || []);
    } catch (err) {
      console.error('Error al generar informe de compras:', err);
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

  const filteredPurchases = purchases.filter(p => {
    return selectedWarehouse === 'all' || p.cat_warehouses?.id?.toString() === selectedWarehouse;
  });

  // Métricas Generales
  const totalSpent = filteredPurchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  const countPurchases = filteredPurchases.length;
  const averagePurchase = countPurchases > 0 ? totalSpent / countPurchases : 0;

  // Top Productos comprados
  const [productsPage, setProductsPage] = useState(1);
  const PRODUCTS_PAGE_SIZE = 5;

  const productStatsMap: { [key: string]: { name: string; sku: string; quantity: number; cost: number } } = {};
  filteredPurchases.forEach(p => {
    (p.tra_purchase_details || []).forEach(d => {
      const pName = d.cat_products?.name || 'Insumo Desconocido';
      const pSku = d.cat_products?.sku || '-';
      const key = `${pSku}-${pName}`;
      if (!productStatsMap[key]) {
        productStatsMap[key] = { name: pName, sku: pSku, quantity: 0, cost: 0 };
      }
      productStatsMap[key].quantity += d.quantity;
      productStatsMap[key].cost += d.quantity * d.unit_cost;
    });
  });

  const allTopPurchasedProducts = Object.values(productStatsMap).sort((a, b) => b.cost - a.cost);
  const totalProductsPages = Math.ceil(allTopPurchasedProducts.length / PRODUCTS_PAGE_SIZE);
  const paginatedTopPurchasedProducts = allTopPurchasedProducts.slice(
    (productsPage - 1) * PRODUCTS_PAGE_SIZE,
    productsPage * PRODUCTS_PAGE_SIZE
  );

  // Compras por Proveedor
  const supplierStatsMap: { [key: string]: { name: string; document_id: string; count: number; total: number } } = {};
  filteredPurchases.forEach(p => {
    const sName = p.cat_clients?.name || 'Proveedor General';
    const sDoc = p.cat_clients?.document_id || '-';
    if (!supplierStatsMap[sName]) {
      supplierStatsMap[sName] = { name: sName, document_id: sDoc, count: 0, total: 0 };
    }
    supplierStatsMap[sName].count += 1;
    supplierStatsMap[sName].total += p.total_amount;
  });
  const supplierStats = Object.values(supplierStatsMap).sort((a, b) => b.total - a.total);
  const topSupplierName = supplierStats[0]?.name || 'N/A';

  // Exportar a CSV
  const handleExportCSV = () => {
    if (filteredPurchases.length === 0) return;

    const headers = ['N° Factura Proveedor', 'Fecha', 'Proveedor', 'RUC', 'Bodega Destino', 'Total Compra', 'Estado'];
    const rows = filteredPurchases.map(p => [
      `"${p.invoice_number || ''}"`,
      `"${new Date(p.created_at).toLocaleString()}"`,
      `"${p.cat_clients?.name || ''}"`,
      `"${p.cat_clients?.document_id || ''}"`,
      `"${p.cat_warehouses?.name || ''}"`,
      p.total_amount.toFixed(2),
      p.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `informe_compras_${startDate}_al_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bodega */}
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
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
            className="p-2 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredPurchases.length === 0}
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
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invertido</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">${totalSpent.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">En compras de inventario</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facturas de Compra</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{countPurchases}</p>
            <p className="text-xs text-slate-500 mt-0.5">Ingresos registrados</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compra Promedio</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">${averagePurchase.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Costo por factura</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Building className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proveedor Principal</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5 truncate" title={topSupplierName}>
              {topSupplierName}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Mayor volumen de compra</p>
          </div>
        </div>
      </div>

      {/* Secciones Analíticas: Top Productos Comprados y Compras por Proveedor */}
      {filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={<BarChart3 className="w-8 h-8 text-slate-400" />}
            title="Sin datos para generar informe de compras"
            description="No se registran compras en el período o bodega seleccionada."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Insumos/Repuestos Comprados */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              Insumos y Repuestos con Mayor Inversión
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Producto / Insumo</th>
                    <th className="py-2.5 px-3 font-mono">SKU</th>
                    <th className="py-2.5 px-3 text-center">Cant. Ingresada</th>
                    <th className="py-2.5 px-3 text-right">Costo Total</th>
                    <th className="py-2.5 px-3 text-right">% Inversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTopPurchasedProducts.map((p, index) => {
                    const percent = totalSpent > 0 ? (p.cost / totalSpent) * 100 : 0;
                    const itemNumber = (productsPage - 1) * PRODUCTS_PAGE_SIZE + index + 1;
                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-400 text-xs">{itemNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{p.name}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{p.sku}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-600">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">${p.cost.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500">{percent.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {allTopPurchasedProducts.length > 0 && (
              <Pagination
                currentPage={productsPage}
                totalPages={totalProductsPages}
                totalItems={allTopPurchasedProducts.length}
                pageSize={PRODUCTS_PAGE_SIZE}
                onPageChange={setProductsPage}
              />
            )}
          </div>

          {/* Compras por Proveedor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-indigo-600" />
              Compras por Proveedor
            </h3>
            <div className="space-y-4">
              {supplierStats.map((s, index) => {
                const percent = totalSpent > 0 ? (s.total / totalSpent) * 100 : 0;
                return (
                  <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span className="font-extrabold text-blue-600">${s.total.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{s.count} {s.count === 1 ? 'compra' : 'compras'}</span>
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

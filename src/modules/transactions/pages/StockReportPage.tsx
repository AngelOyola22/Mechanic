import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { ClipboardList, Search, AlertCircle, Building, Package, AlertTriangle, Store } from 'lucide-react';

interface BranchDb {
  id: number;
  name: string;
}

interface WarehouseDb {
  id: number;
  name: string;
  code: string;
  branch_id: number;
  cat_branches: BranchDb;
}

interface ProductStock {
  warehouse_id: number;
  quantity: number;
  cat_warehouses: WarehouseDb;
}

interface ProductWithStock {
  id: number;
  sku: string;
  name: string;
  type_id: number;
  is_active: boolean;
  tra_product_stock: ProductStock[];
}

export const StockReportPage = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDb[]>([]);
  const [branches, setBranches] = useState<BranchDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [whRes, prodRes] = await Promise.all([
        supabase.from('cat_warehouses').select('*, cat_branches(id, name)').eq('is_active', true).order('branch_id'),
        supabase.from('cat_products').select(`
          id, sku, name, type_id, is_active,
          tra_product_stock (
            warehouse_id, quantity,
            cat_warehouses (id, name, code, branch_id)
          )
        `).order('name')
      ]);

      if (whRes.error) throw whRes.error;
      if (prodRes.error) throw prodRes.error;

      const whData = whRes.data || [];
      setWarehouses(whData);
      
      // Extraer sucursales únicas para el filtro
      const uniqueBranchesMap = new Map();
      whData.forEach(w => {
        if (w.cat_branches && !uniqueBranchesMap.has(w.cat_branches.id)) {
          uniqueBranchesMap.set(w.cat_branches.id, w.cat_branches);
        }
      });
      setBranches(Array.from(uniqueBranchesMap.values()));

      setProducts((prodRes.data as any) || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar informe de stock');
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  // selectedFilter puede ser:
  // "ALL" -> Todo
  // "B-1" -> Sucursal (Branch) ID 1
  // "W-2" -> Bodega (Warehouse) ID 2
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    return true; 
  });

  // Determinar qué bodegas mostrar como columnas basadas en el filtro
  const visibleWarehouses = warehouses.filter(w => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter.startsWith('B-')) {
      const branchId = Number(selectedFilter.split('-')[1]);
      return w.branch_id === branchId;
    }
    if (selectedFilter.startsWith('W-')) {
      const warehouseId = Number(selectedFilter.split('-')[1]);
      return w.id === warehouseId;
    }
    return true;
  });

  if (loading) return <div className="p-8 text-center text-slate-500">Generando informe de stock...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="text-blue-600" />
            Informe de Inventario
          </h1>
          <p className="text-slate-500 mt-1">Consulta el stock disponible agrupado por sucursales y bodegas.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar producto por SKU o nombre..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Store className="w-5 h-5 text-slate-400" />
          <select 
            value={selectedFilter}
            onChange={e => setSelectedFilter(e.target.value)}
            className="border border-slate-300 rounded-xl py-2.5 px-4 outline-none text-sm focus:ring-2 focus:ring-blue-500 bg-white min-w-[250px]"
          >
            <option value="ALL">Todas las Sucursales y Bodegas</option>
            {branches.map(b => (
              <optgroup key={`branch-${b.id}`} label={`🏬 Sucursal: ${b.name}`}>
                <option value={`B-${b.id}`}> Ver toda la Sucursal ({b.name})</option>
                {warehouses.filter(w => w.branch_id === b.id).map(w => (
                  <option key={`wh-${w.id}`} value={`W-${w.id}`}>&nbsp;&nbsp;&nbsp;📦 Bodega: {w.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Reporte */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold align-bottom">Producto</th>
                {visibleWarehouses.map(w => (
                  <th key={w.id} className="px-6 py-2 font-semibold text-center border-l border-slate-200">
                    <div className="flex flex-col items-center justify-end h-full">
                      <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1 line-clamp-1" title={w.cat_branches?.name}>
                        {w.cat_branches?.name || 'Sin Sucursal'}
                      </span>
                      <span className="text-sm">{w.code}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 font-semibold text-center bg-blue-50 text-blue-800 border-l border-slate-200 align-bottom">
                  Total Filtrado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                // Calcular stock basado en las bodegas visibles
                let totalStockVisible = 0;
                const stockByWh: Record<number, number> = {};
                
                product.tra_product_stock?.forEach(stk => {
                  stockByWh[stk.warehouse_id] = stk.quantity;
                  // Sumamos al total solo si la bodega está visible en los filtros
                  if (visibleWarehouses.some(vw => vw.id === stk.warehouse_id)) {
                    totalStockVisible += stk.quantity;
                  }
                });

                return (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{product.name}</p>
                          <p className="text-slate-500 text-xs font-mono">{product.sku}</p>
                        </div>
                      </div>
                    </td>

                    {visibleWarehouses.map(w => {
                      const qty = stockByWh[w.id] || 0;
                      return (
                        <td key={w.id} className="px-6 py-4 text-center border-l border-slate-100">
                          <StockBadge qty={qty} />
                        </td>
                      );
                    })}
                    
                    <td className="px-6 py-4 text-center border-l border-blue-100 bg-blue-50/30">
                      <span className="font-bold text-slate-800 text-base">{totalStockVisible}</span>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={visibleWarehouses.length + 2} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron productos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StockBadge = ({ qty }: { qty: number }) => {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" />
        {qty}
      </span>
    );
  }
  if (qty <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
        {qty}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
      {qty}
    </span>
  );
};

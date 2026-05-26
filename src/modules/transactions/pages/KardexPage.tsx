import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Activity, Search, AlertCircle, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';

interface KardexRecord {
  id: number;
  quantity: number;
  stock_balance: number;
  created_at: string;
  reference_id: number;
  
  // Joins
  cat_products: { sku: string; name: string };
  cat_warehouses: { code: string; name: string; cat_branches: { name: string } };
  tra_movement_types: { name: string; multiplier: number };
  seg_users: { full_name: string };
}

export const KardexPage = () => {
  const [records, setRecords] = useState<KardexRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchKardex();
  }, []);

  const fetchKardex = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tra_kardex')
        .select(`
          id, quantity, stock_balance, created_at, reference_id,
          cat_products (sku, name),
          cat_warehouses (code, name, cat_branches(name)),
          tra_movement_types (name, multiplier),
          seg_users (full_name)
        `)
        .order('id', { ascending: false })
        .limit(200); // Para no colapsar la memoria

      if (error) throw error;
      setRecords(data as unknown as KardexRecord[] || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el Kardex');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.cat_products?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.cat_products?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cat_warehouses?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando libro mayor de inventario (Kardex)...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600" />
            Kardex (Libro Mayor de Inventario)
          </h1>
          <p className="text-slate-500 mt-1">Historial inmutable y auditoría de todos los movimientos de stock físicos.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar producto o bodega..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-80"
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">Mostrando últimos {filteredRecords.length} movimientos</p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4 font-semibold">Fecha y Hora</th>
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Ubicación (Bodega)</th>
                <th className="px-6 py-4 font-semibold">Tipo de Movimiento</th>
                <th className="px-6 py-4 font-semibold text-center">Variación</th>
                <th className="px-6 py-4 font-semibold text-center">Saldo (Stock)</th>
                <th className="px-6 py-4 font-semibold">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(r => {
                const isPositive = r.tra_movement_types.multiplier > 0;
                const dateObj = new Date(r.created_at);
                const formattedDate = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateObj);
                const formattedTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(dateObj);
                
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-700">
                        {formattedDate}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formattedTime}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{r.cat_products?.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{r.cat_products?.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-700">{r.cat_warehouses?.name}</p>
                      <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">{r.cat_warehouses?.cat_branches?.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-600">{r.tra_movement_types?.name}</p>
                      <p className="text-[10px] text-slate-400">Ref ID: {r.reference_id}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isPositive ? '+' : '-'}{r.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-slate-800 text-base">{r.stock_balance}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{r.seg_users?.full_name}</p>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No se han registrado movimientos de inventario.
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

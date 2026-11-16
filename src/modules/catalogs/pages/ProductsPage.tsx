import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Package, Plus, Trash2, Pencil, Search, AlertCircle, X, Tag, Store } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';

interface StockByWarehouse {
  warehouse_id: number;
  quantity: number;
  cat_warehouses?: {
    id: number;
    name: string;
    code: string;
  };
}

interface ProductDb {
  id: number;
  sku: string;
  type_id: number | null;
  tax_id: number | null;
  name: string;
  description: string | null;
  base_price: number;
  current_stock: number;
  is_active: boolean;
  created_at: string;
  unit_id?: number | null;
  brand_id?: number | null;
  // Joins
  type_name?: string;
  tax_name?: string;
  tax_percentage?: number;
  unit_name?: string;
  brand_name?: string;
  global_stock?: number;
  tra_product_stock?: StockByWarehouse[];
  stock_by_warehouse?: Record<number, number>;
}

interface ProductTypeDb {
  id: number;
  name: string;
}

interface TaxDb {
  id: number;
  name: string;
  percentage: number;
}

interface MeasurementUnitDb {
  id: number;
  name: string;
  abbreviation: string;
}

interface PartsBrandDb {
  id: number;
  name: string;
}

interface WarehouseDb {
  id: number;
  name: string;
  code: string;
  branch_id: number;
  cat_branches?: { id: number; name: string };
}

export const ProductsPage = () => {
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<ProductDb[]>([]);
  const [types, setTypes] = useState<ProductTypeDb[]>([]);
  const [taxes, setTaxes] = useState<TaxDb[]>([]);
  const [units, setUnits] = useState<MeasurementUnitDb[]>([]);
  const [brands, setBrands] = useState<PartsBrandDb[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDb[]>([]);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL');
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState<string>('');
  const [typeId, setTypeId] = useState<number | ''>('');
  const [taxId, setTaxId] = useState<number | ''>('');
  const [unitId, setUnitId] = useState<number | ''>('');
  const [brandId, setBrandId] = useState<number | ''>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [typesRes, taxesRes, unitsRes, brandsRes, whRes, productsRes] = await Promise.all([
        supabase.from('cat_product_types').select('*'),
        supabase.from('cat_taxes').select('*').eq('is_active', true),
        supabase.from('cat_measurement_units').select('*').eq('is_active', true),
        supabase.from('cat_parts_brands').select('*').eq('is_active', true),
        supabase.from('cat_warehouses').select('*, cat_branches(id, name)').eq('is_active', true).order('branch_id'),
        supabase.from('cat_products').select('*, tra_product_stock(warehouse_id, quantity, cat_warehouses(id, name, code))').order('id', { ascending: false })
      ]);

      if (typesRes.error) throw typesRes.error;
      if (taxesRes.error) throw taxesRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (brandsRes.error) throw brandsRes.error;
      if (whRes.error) throw whRes.error;
      if (productsRes.error) throw productsRes.error;

      setTypes(typesRes.data || []);
      setTaxes(taxesRes.data || []);
      setUnits(unitsRes.data || []);
      setBrands(brandsRes.data || []);
      setWarehouses((whRes.data as any) || []);

      // Manual join mapping
      const combinedProducts = (productsRes.data || []).map((p: any) => {
        const type = typesRes.data?.find(t => t.id === p.type_id);
        const tax = taxesRes.data?.find(t => t.id === p.tax_id);
        const unit = unitsRes.data?.find(u => u.id === p.unit_id);
        const brand = brandsRes.data?.find(b => b.id === p.brand_id);
        
        // Sumar el stock de todas las bodegas para tener el Total Global y por bodega
        const stockByWarehouse: Record<number, number> = {};
        let totalStock = 0;
        p.tra_product_stock?.forEach((stk: any) => {
          stockByWarehouse[stk.warehouse_id] = stk.quantity;
          totalStock += stk.quantity;
        });

        return {
          ...p,
          type_name: type?.name || 'Sin Categoría',
          tax_name: tax?.name || 'Sin Impuesto',
          tax_percentage: tax?.percentage || 0,
          unit_name: unit?.name || '',
          brand_name: brand?.name || 'N/A',
          global_stock: totalStock,
          stock_by_warehouse: stockByWarehouse
        };
      });

      setProducts(combinedProducts);
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar permisos antes de procesar
    if (editingId && !hasPermission('PROD_UPDATE')) {
      setError('No tienes permisos para editar productos.');
      return;
    }
    if (!editingId && !hasPermission('PROD_CREATE')) {
      setError('No tienes permisos para crear productos.');
      return;
    }

    if (!sku || !name || !basePrice || !typeId || !taxId) {
      setError('SKU, Nombre, Precio, Tipo e Impuesto son obligatorios');
      return;
    }

    try {
      setError(null);
      
      const payload = {
        sku,
        name,
        description: description || null,
        base_price: parseFloat(basePrice),
        current_stock: 0, // Obsoleto, la fuente de la verdad es tra_product_stock
        type_id: Number(typeId),
        tax_id: Number(taxId),
        unit_id: unitId ? Number(unitId) : null,
        brand_id: brandId ? Number(brandId) : null,
      };

      if (editingId) {
        const { error } = await supabase.from('cat_products').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_products').insert([payload]);
        if (error) throw error;
      }

      await fetchData();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el producto');
    }
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('PROD_DELETE')) {
      setError('No tienes permisos para eliminar productos.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Producto',
      message: '¿Seguro que deseas eliminar este producto?',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('cat_products').delete().eq('id', id);
          if (error) throw error;
          
          setProducts(products.filter(p => p.id !== id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar producto');
        }
      }
    });
  };

  const openModal = (product?: ProductDb) => {
    setError(null);
    if (product) {
      setEditingId(product.id);
      setSku(product.sku);
      setName(product.name);
      setDescription(product.description || '');
      setBasePrice(product.base_price.toString());
      setTypeId(product.type_id || '');
      setTaxId(product.tax_id || '');
      setUnitId(product.unit_id || '');
      setBrandId(product.brand_id || '');
    } else {
      setEditingId(null);
      setSku('');
      setName('');
      setDescription('');
      setBasePrice('');
      setTypeId('');
      setTaxId('');
      setUnitId('');
      setBrandId('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando catálogo de productos...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
      />
      <PageHeader 
        title="Catálogo de Productos y Servicios"
        description="Gestiona repuestos, insumos, precios de servicios y stock."
        icon={<Package />}
        actionButton={{
          label: 'Nuevo Producto',
          onClick: () => openModal(),
          disabled: !hasPermission('PROD_CREATE'),
          disabledTitle: 'No tienes permisos para crear productos',
        }}
      />

      {error && !isModalOpen && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por SKU o nombre..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-slate-500" />
              <select
                value={selectedWarehouseFilter}
                onChange={e => setSelectedWarehouseFilter(e.target.value)}
                className="border border-slate-300 rounded-xl py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700 shadow-sm"
              >
                <option value="ALL">📦 Todas las Bodegas (Consolidado)</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id.toString()}>
                    🏢 {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Mostrando <strong>{filteredProducts.length}</strong> de <strong>{products.length}</strong> productos
          </p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-semibold text-left">Producto / SKU</th>
                  <th className="p-4 font-semibold text-left">Marca</th>
                  <th className="p-4 font-semibold text-left">Categoría</th>
                  <th className="p-4 font-semibold text-right">Precio Base</th>
                  <th className="p-4 font-semibold text-right min-w-[130px]">
                    {selectedWarehouseFilter === 'ALL'
                      ? 'Stock Total'
                      : `Stock (${warehouses.find(w => w.id.toString() === selectedWarehouseFilter)?.name || 'Bodega'})`}
                  </th>
                  <th className="p-4 font-semibold text-center w-24">Estado</th>
                  <th className="p-4 font-semibold text-right w-24">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                const finalPrice = product.base_price * (1 + (product.tax_percentage || 0) / 100);
                const isService = product.type_name?.toLowerCase().includes('servicio');
                const stockToShow = selectedWarehouseFilter === 'ALL'
                  ? (product.global_stock || 0)
                  : (product.stock_by_warehouse?.[Number(selectedWarehouseFilter)] || 0);

                return (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-md">{product.sku}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {product.brand_name}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">
                        <Tag className="w-3 h-3" />
                        {product.type_name}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-slate-800">${Number(product.base_price).toFixed(2)}</p>
                    </td>
                    <td className="p-4 text-right">
                      {isService ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Servicio (Sin stock)
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`font-bold text-lg ${stockToShow > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {stockToShow}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {product.unit_name && product.unit_name !== 'N/A' ? product.unit_name : 'unid.'}
                            </span>
                          </div>
                          {selectedWarehouseFilter === 'ALL' && product.tra_product_stock && product.tra_product_stock.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1 text-[10px] text-slate-400 font-mono">
                              {product.tra_product_stock.map((s, idx) => (
                                <span key={idx} className="bg-slate-50 border border-slate-100 px-1 rounded">
                                  {s.cat_warehouses?.code || `B${s.warehouse_id}`}: <strong className="text-slate-600">{s.quantity}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                        !product.is_active ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openModal(product)}
                          disabled={!hasPermission('PROD_UPDATE')}
                          className={`p-2 rounded-lg transition-colors ${!hasPermission('PROD_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                          title={!hasPermission('PROD_UPDATE') ? "Sin permiso para editar" : "Editar Producto"}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          disabled={!hasPermission('PROD_DELETE')}
                          className={`p-2 rounded-lg transition-colors ${!hasPermission('PROD_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                          title={!hasPermission('PROD_DELETE') ? "Sin permiso para eliminar" : "Eliminar Producto"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState 
                      icon={<Package className="w-8 h-8" />}
                      title="No se encontraron productos"
                      description="Intenta con otro término de búsqueda o registra un nuevo producto."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar Producto/Servicio' : 'Nuevo Producto/Servicio'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">SKU / Código *</label>
                  <input 
                    type="text" 
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="Ej. REP-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="Ej. Pastillas de Freno"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría / Tipo *</label>
                  <select 
                    value={typeId}
                    onChange={e => setTypeId(Number(e.target.value))}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none bg-white"
                  >
                    <option value="" disabled>Selecciona...</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Marca (Opcional)</label>
                  <select 
                    value={brandId}
                    onChange={e => setBrandId(Number(e.target.value))}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none bg-white"
                  >
                    <option value="">Ninguna</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unidad de Medida (Opcional)</label>
                  <select 
                    value={unitId}
                    onChange={e => setUnitId(Number(e.target.value))}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none bg-white"
                  >
                    <option value="">Ninguna</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Impuesto a Aplicar *</label>
                  <select 
                    value={taxId}
                    onChange={e => setTaxId(Number(e.target.value))}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none bg-white"
                  >
                    <option value="" disabled>Selecciona...</option>
                    {taxes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.percentage}%)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Precio Base (Sin Impuestos) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      value={basePrice}
                      onChange={e => setBasePrice(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 border outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>



                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none resize-none"
                    placeholder="Características principales..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-500/20 transition-colors"
                >
                  {editingId ? 'Guardar Cambios' : 'Guardar Producto'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

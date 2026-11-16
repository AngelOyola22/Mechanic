import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Package, Search, Plus, Trash2, Save, ArrowLeft, Building, Users, AlertCircle, FileText, BarChart3 } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { useAuth } from '../../../context/AuthContext';
import { PurchasesDocumentsTab } from '../components/PurchasesDocumentsTab';
import { PurchasesReportsTab } from '../components/PurchasesReportsTab';

// --- Types ---
interface Supplier {
  id: number;
  name: string;
  document_id: string;
}

interface Warehouse {
  id: number;
  name: string;
  cat_branches?: { name: string };
}

interface Product {
  id: number;
  sku: string;
  name: string;
  base_price: number;
}

interface PurchaseDetail {
  product: Product;
  quantity: number;
  unit_cost: number;
}

export const PurchasesPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // States para la compra actual
  const [selectedSupplier, setSelectedSupplier] = useState<number | ''>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Detalles
  const [details, setDetails] = useState<PurchaseDetail[]>([]);

  // Búsqueda de productos
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'proceso' | 'documentos' | 'informes'>('proceso');

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const [suppRes, whRes, prodRes] = await Promise.all([
        supabase.from('cat_clients').select('id, name, document_id').eq('is_supplier', true),
        supabase.from('cat_warehouses').select('id, name, cat_branches(name)').eq('is_active', true),
        supabase.from('cat_products').select('id, sku, name, base_price').eq('is_active', true)
      ]);

      if (suppRes.error) throw suppRes.error;
      if (whRes.error) throw whRes.error;
      if (prodRes.error) throw prodRes.error;

      setSuppliers(suppRes.data as any || []);
      setWarehouses(whRes.data as any || []);
      setProducts(prodRes.data as any || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar catálogos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const addProductToDetail = (product: Product) => {
    // Si ya existe, aumentar cantidad
    const existingIndex = details.findIndex(d => d.product.id === product.id);
    if (existingIndex >= 0) {
      const newDetails = [...details];
      newDetails[existingIndex].quantity += 1;
      setDetails(newDetails);
    } else {
      setDetails([...details, { product, quantity: 1, unit_cost: product.base_price }]);
    }
    setSearchTerm('');
  };

  const updateDetail = (index: number, field: 'quantity' | 'unit_cost', value: string) => {
    const numValue = parseFloat(value) || 0;
    const newDetails = [...details];
    newDetails[index][field] = numValue;
    setDetails(newDetails);
  };

  const removeDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const totalAmount = details.reduce((acc, curr) => acc + (curr.quantity * curr.unit_cost), 0);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5); // Solo mostrar los primeros 5 resultados rápidos

  const handleSavePurchase = async () => {
    if (!hasPermission('PURCH_CREATE')) {
      setError('No tienes permisos para registrar compras e ingresos de mercadería.');
      return;
    }

    if (!selectedSupplier || !selectedWarehouse || !invoiceNumber) {
      setError('Por favor completa Proveedor, Bodega y Número de Factura.');
      return;
    }
    if (details.length === 0) {
      setError('Debes agregar al menos un producto a la compra.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 1. Validar usuario identificado en la sesión
      const userId = user?.id;
      if (!userId) throw new Error('No se pudo identificar tu usuario en la base de datos');

      // 2. Insertar Cabecera de Compra
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('tra_purchases')
        .insert([{
          user_id: userId,
          supplier_id: Number(selectedSupplier),
          warehouse_id: Number(selectedWarehouse),
          invoice_number: invoiceNumber,
          total_amount: totalAmount,
          status: 'COMPLETED'
        }])
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // 3. Insertar Detalles
      const detailPayload = details.map(d => ({
        purchase_id: purchaseData.id,
        product_id: d.product.id,
        quantity: d.quantity,
        unit_cost: d.unit_cost
      }));

      const { error: detailsError } = await supabase.from('tra_purchase_details').insert(detailPayload);
      if (detailsError) throw detailsError;

      // 4. Actualizar Kardex y Stock Físico (Transacción manual en frontend si no hay triggers)
      // Tipo de movimiento 1: Ingreso por Compra (multiplier +1)
      const kardexPayload = [];

      for (const d of details) {
        // A. Obtener stock actual de esa bodega para el producto
        const { data: currentStockObj } = await supabase
          .from('tra_product_stock')
          .select('quantity')
          .eq('product_id', d.product.id)
          .eq('warehouse_id', Number(selectedWarehouse))
          .single();

        const currentStock = currentStockObj?.quantity || 0;
        const newStock = currentStock + d.quantity;

        // B. Insertar en Kardex
        kardexPayload.push({
          product_id: d.product.id,
          warehouse_id: Number(selectedWarehouse),
          movement_type_id: 1, // 1 = Ingreso por Compra
          reference_id: purchaseData.id,
          quantity: d.quantity,
          stock_balance: newStock,
          user_id: userId
        });

        // C. Actualizar o Insertar en Stock
        const { error: stockError } = await supabase
          .from('tra_product_stock')
          .upsert({
            product_id: d.product.id,
            warehouse_id: Number(selectedWarehouse),
            quantity: newStock,
            last_updated: new Date().toISOString()
          }, { onConflict: 'product_id,warehouse_id' });

        if (stockError) throw stockError;
      }

      // Guardar Kardex masivo
      const { error: kxError } = await supabase.from('tra_kardex').insert(kardexPayload);
      if (kxError) throw kxError;

      // RESET y EXITO
      setSuccess(true);
      setDetails([]);
      setInvoiceNumber('');
      setTimeout(() => setSuccess(false), 4000);

    } catch (err: any) {
      setError(err.message || 'Error al procesar la compra. Revisa la consola.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando módulo de compras...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" />
            Módulo de Compras
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona el ingreso de mercadería de proveedores, facturas registradas e informes de costos.
          </p>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('proceso')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'proceso'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          Procesos (Ingreso de Mercadería)
        </button>

        <button
          onClick={() => setActiveTab('documentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'documentos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documentos y Facturas
        </button>

        <button
          onClick={() => setActiveTab('informes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'informes'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Informes de Compras
        </button>
      </div>

      {activeTab === 'documentos' && <PurchasesDocumentsTab />}
      {activeTab === 'informes' && <PurchasesReportsTab />}

      {activeTab === 'proceso' && (
        <>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl border border-emerald-100 flex items-center gap-3 mb-6">
              <Package className="w-5 h-5" />
              <p className="font-semibold">¡Compra registrada exitosamente! El stock ha sido actualizado.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* LADO IZQUIERDO: DETALLES DE COMPRA */}
        <div className="lg:col-span-2 flex flex-col space-y-4">

          {/* Cabecera de la factura */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Proveedor *
              </label>
              <select
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value ? Number(e.target.value) : '')}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border outline-none text-sm bg-slate-50"
              >
                <option value="" disabled>Selecciona proveedor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.document_id})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building className="w-3 h-3" /> Bodega de Ingreso *
              </label>
              <select
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value ? Number(e.target.value) : '')}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border outline-none text-sm bg-slate-50"
              >
                <option value="" disabled>¿A dónde ingresa?</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.cat_branches?.name})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                N° de Factura *
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="Ej. 001-002-000005432"
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border outline-none text-sm"
              />
            </div>
          </div>

          {/* Buscador Rápido */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre o código para agregarlo a la compra..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-blue-200 bg-blue-50/30 text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-blue-400 font-medium"
            />

            {/* Resultados del buscador flotantes */}
            {searchTerm && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {filteredProducts.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {filteredProducts.map(p => (
                      <li
                        key={p.id}
                        onClick={() => addProductToDetail(p)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.sku}</p>
                        </div>
                        <button className="text-blue-600 bg-blue-50 p-2 rounded-lg">
                          <Plus className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm">No se encontraron productos.</div>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Detalles */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1 p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Cant.</th>
                    <th className="px-4 py-3 font-semibold w-32 text-right">Costo Unit.</th>
                    <th className="px-4 py-3 font-semibold w-32 text-right">Subtotal</th>
                    <th className="px-4 py-3 font-semibold w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {details.map((d, index) => (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{d.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{d.product.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={d.quantity}
                          onChange={e => updateDetail(index, 'quantity', e.target.value)}
                          className="w-full text-center border border-slate-300 rounded-lg py-1 px-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={d.unit_cost}
                            onChange={e => updateDetail(index, 'unit_cost', e.target.value)}
                            className="w-full text-right pl-5 pr-2 border border-slate-300 rounded-lg py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        ${(d.quantity * d.unit_cost).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeDetail(index)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {details.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                        Busca y agrega productos a la factura.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* LADO DERECHO: TOTALES Y ACCIONES */}
        <div className="flex flex-col space-y-4">
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20">
            <h3 className="text-slate-400 font-semibold mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
              Resumen de Compra
            </h3>

            <div className="space-y-3 mb-6 border-b border-slate-700 pb-6">
              <div className="flex justify-between text-slate-300">
                <span>Items Totales</span>
                <span className="font-bold text-white">{details.reduce((a, c) => a + c.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Líneas de Producto</span>
                <span className="font-bold text-white">{details.length}</span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-8">
              <span className="text-slate-400 text-lg">Total a Pagar</span>
              <span className="text-4xl font-black text-emerald-400">
                ${totalAmount.toFixed(2)}
              </span>
            </div>

            <button 
              onClick={handleSavePurchase}
              disabled={saving || details.length === 0 || !hasPermission('PURCH_CREATE')}
              title={!hasPermission('PURCH_CREATE') ? "Sin permisos para comprar" : ""}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-lg transition-all ${
                !hasPermission('PURCH_CREATE')
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-80'
                  : saving || details.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/20'
              }`}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Procesando...' : !hasPermission('PURCH_CREATE') ? 'Sin permisos para comprar' : 'Guardar Compra'}
            </button>
          </div>

          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <h4 className="text-blue-800 font-bold mb-2 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Importante
            </h4>
            <p className="text-blue-600 text-xs leading-relaxed">
              Al guardar esta compra, el inventario se actualizará automáticamente en la bodega seleccionada y se dejará un registro inmutable en el Kardex.
            </p>
          </div>
        </div>

      </div>
        </>
      )}
    </div>
  );
};

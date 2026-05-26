import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { ShoppingCart, Search, Plus, Trash2, Save, Store, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { useAuth } from '../../../context/AuthContext';

// --- Types ---
interface Client {
  id: number;
  name: string;
  document_id: string;
}

interface Branch {
  id: number;
  name: string;
}

interface Warehouse {
  id: number;
  name: string;
  branch_id: number;
}

interface ProductStock {
  quantity: number;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  base_price: number;
  cat_taxes?: { percentage: number };
  tra_product_stock?: ProductStock[];
}

interface SaleDetail {
  product: Product;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  subtotal: number;
  total: number;
}

export const SalesPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Header State
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | ''>('');
  const [selectedDocType, setSelectedDocType] = useState<number | ''>('');
  const [documentTypes, setDocumentTypes] = useState<{id: number, name: string}[]>([]);
  
  // Details
  const [details, setDetails] = useState<SaleDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  // When branch changes, auto-select warehouse if only 1 exists
  useEffect(() => {
    if (selectedBranch) {
      const whs = warehouses.filter(w => w.branch_id === Number(selectedBranch));
      if (whs.length === 1) setSelectedWarehouse(whs[0].id);
      else setSelectedWarehouse('');
    }
  }, [selectedBranch, warehouses]);

  // When warehouse changes, re-fetch products with stock specifically for that warehouse
  useEffect(() => {
    if (selectedWarehouse) {
      fetchProductsByWarehouse(Number(selectedWarehouse));
    } else {
      setProducts([]); // Clear if no warehouse selected
    }
  }, [selectedWarehouse]);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const [clientRes, branchRes, whRes, docTypeRes] = await Promise.all([
        supabase.from('cat_clients').select('id, name, document_id').eq('is_customer', true),
        supabase.from('cat_branches').select('id, name').eq('is_active', true),
        supabase.from('cat_warehouses').select('id, name, branch_id').eq('is_active', true),
        supabase.from('sys_document_types').select('id, name').eq('is_active', true)
      ]);

      if (clientRes.error) throw clientRes.error;
      if (branchRes.error) throw branchRes.error;
      if (whRes.error) throw whRes.error;
      if (docTypeRes.error) throw docTypeRes.error;

      setClients(clientRes.data as any || []);
      setBranches(branchRes.data as any || []);
      setWarehouses(whRes.data as any || []);
      setDocumentTypes(docTypeRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar catálogos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsByWarehouse = async (warehouseId: number) => {
    try {
      // Solo traer productos que tengan stock > 0 en esa bodega, o traer todos y mostrar el stock
      const { data, error } = await supabase.from('cat_products').select(`
        id, sku, name, base_price,
        cat_taxes(percentage),
        tra_product_stock!inner(quantity)
      `).eq('is_active', true).eq('tra_product_stock.warehouse_id', warehouseId).gt('tra_product_stock.quantity', 0);

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      setError('Error al cargar inventario de la bodega: ' + err.message);
    }
  };

  const addProductToDetail = (product: Product) => {
    const stockAvailable = product.tra_product_stock?.[0]?.quantity || 0;
    
    const existingIndex = details.findIndex(d => d.product.id === product.id);
    if (existingIndex >= 0) {
      const newDetails = [...details];
      if (newDetails[existingIndex].quantity + 1 > stockAvailable) {
        setError(`No hay suficiente stock. Máximo disponible: ${stockAvailable}`);
        return;
      }
      
      newDetails[existingIndex].quantity += 1;
      // Recalculate
      const qty = newDetails[existingIndex].quantity;
      const price = newDetails[existingIndex].unit_price;
      const taxPerc = newDetails[existingIndex].tax_percentage;
      
      newDetails[existingIndex].subtotal = qty * price;
      newDetails[existingIndex].tax_amount = (qty * price) * (taxPerc / 100);
      newDetails[existingIndex].total = newDetails[existingIndex].subtotal + newDetails[existingIndex].tax_amount;
      
      setDetails(newDetails);
    } else {
      if (1 > stockAvailable) {
        setError(`Stock agotado para este producto.`);
        return;
      }
      
      const price = product.base_price;
      const taxPerc = product.cat_taxes?.percentage || 0;
      const subtotal = price * 1;
      const taxAmount = subtotal * (taxPerc / 100);
      
      setDetails([...details, { 
        product, 
        quantity: 1, 
        unit_price: price,
        tax_percentage: taxPerc,
        subtotal,
        tax_amount: taxAmount,
        total: subtotal + taxAmount
      }]);
    }
    setSearchTerm('');
    setError(null);
  };

  const updateDetail = (index: number, qtyString: string) => {
    let qty = parseInt(qtyString, 10);
    if (isNaN(qty) || qty < 1) qty = 1;

    const stockAvailable = details[index].product.tra_product_stock?.[0]?.quantity || 0;
    if (qty > stockAvailable) {
      setError(`Stock insuficiente. Disponible: ${stockAvailable}`);
      qty = stockAvailable;
    } else {
      setError(null);
    }

    const newDetails = [...details];
    const price = newDetails[index].unit_price;
    const taxPerc = newDetails[index].tax_percentage;
    
    newDetails[index].quantity = qty;
    newDetails[index].subtotal = qty * price;
    newDetails[index].tax_amount = (qty * price) * (taxPerc / 100);
    newDetails[index].total = newDetails[index].subtotal + newDetails[index].tax_amount;
    
    setDetails(newDetails);
  };

  const removeDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  // Math
  const globalSubtotal = details.reduce((acc, curr) => acc + curr.subtotal, 0);
  const globalTax = details.reduce((acc, curr) => acc + curr.tax_amount, 0);
  const globalTotal = globalSubtotal + globalTax;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const handleSaveSale = async () => {
    if (!hasPermission('SALE_CREATE')) {
      setError('No tienes permisos para registrar ventas.');
      return;
    }

    if (!selectedClient || !selectedBranch || !selectedWarehouse || !selectedDocType) {
      setError('Completa Cliente, Sucursal, Bodega y Tipo de Documento.');
      return;
    }
    if (details.length === 0) {
      setError('Debes agregar productos a la factura.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const { data: dbUser } = await supabase.from('seg_users').select('id').eq('auth_user_id', user?.id).single();
      if (!dbUser) throw new Error('Usuario no identificado');

      // 0. Obtener secuencial
      const { data: docNumber, error: docError } = await supabase.rpc('fn_get_next_document_number', {
        p_document_type_id: Number(selectedDocType)
      });
      if (docError) throw new Error('No se pudo generar el número de documento: ' + docError.message);

      // 1. Insertar Cabecera de Venta
      const { data: saleData, error: saleError } = await supabase
        .from('tra_sales')
        .insert([{
          user_id: dbUser.id,
          client_id: Number(selectedClient),
          branch_id: Number(selectedBranch),
          invoice_number: docNumber,
          subtotal: globalSubtotal,
          tax_amount: globalTax,
          total_amount: globalTotal,
          status: 'COMPLETED'
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Insertar Detalles
      const detailPayload = details.map(d => ({
        sale_id: saleData.id,
        product_id: d.product.id,
        quantity: d.quantity,
        unit_price: d.unit_price,
        tax_applied: d.tax_amount
      }));

      const { error: detailsError } = await supabase.from('tra_sale_details').insert(detailPayload);
      if (detailsError) throw detailsError;

      // 3. Descontar del Kardex y del Stock Físico
      const kardexPayload = [];
      
      for (const d of details) {
        // A. Obtener stock actual
        const { data: currentStockObj } = await supabase
          .from('tra_product_stock')
          .select('quantity')
          .eq('product_id', d.product.id)
          .eq('warehouse_id', Number(selectedWarehouse))
          .single();

        const currentStock = currentStockObj?.quantity || 0;
        const newStock = currentStock - d.quantity;

        // B. Insertar Kardex (Tipo 2 = Salida por Venta, multiplier -1)
        kardexPayload.push({
          product_id: d.product.id,
          warehouse_id: Number(selectedWarehouse),
          movement_type_id: 2, 
          reference_id: saleData.id,
          quantity: d.quantity,
          stock_balance: newStock,
          user_id: dbUser.id
        });

        // C. Actualizar Stock
        const { error: stockError } = await supabase
          .from('tra_product_stock')
          .update({
            quantity: newStock,
            last_updated: new Date().toISOString()
          })
          .eq('product_id', d.product.id)
          .eq('warehouse_id', Number(selectedWarehouse));
          
        if (stockError) throw stockError;
      }

      // Guardar Kardex
      const { error: kxError } = await supabase.from('tra_kardex').insert(kardexPayload);
      if (kxError) throw kxError;

      // RESET y EXITO
      setSuccess(true);
      setDetails([]);
      setSearchTerm('');
      
      // Refresh inventory so stock is updated in real time
      fetchProductsByWarehouse(Number(selectedWarehouse));
      
      setTimeout(() => setSuccess(false), 4000);

    } catch (err: any) {
      setError(err.message || 'Error al procesar la venta.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && branches.length === 0) return <div className="p-8 text-center text-slate-500">Cargando módulo POS...</div>;

  const whForBranch = warehouses.filter(w => w.branch_id === Number(selectedBranch));

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="text-indigo-600" />
            Punto de Venta (Facturación)
          </h1>
          <p className="text-slate-500 mt-1">Registra ventas a clientes y descarga inventario en tiempo real.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl border border-emerald-100 flex items-center gap-3 mb-6">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-semibold">¡Venta registrada exitosamente! El ticket ha sido generado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* LADO IZQUIERDO: DETALLES */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          
          {/* Cabecera */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Store className="w-3 h-3" /> Sucursal de Emisión *
              </label>
              <select 
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value ? Number(e.target.value) : '')}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 border outline-none text-sm bg-slate-50"
              >
                <option value="" disabled>Selecciona sucursal...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bodega de Extracción *
              </label>
              <select 
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedBranch}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 border outline-none text-sm bg-slate-50 disabled:opacity-50"
              >
                <option value="" disabled>Selecciona bodega...</option>
                {whForBranch.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Cliente *
              </label>
              <select 
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value ? Number(e.target.value) : '')}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 border outline-none text-sm bg-slate-50"
              >
                <option value="" disabled>Consumidor Final...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.document_id})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tipo de Documento *
              </label>
              <select 
                value={selectedDocType}
                onChange={e => setSelectedDocType(e.target.value ? Number(e.target.value) : '')}
                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 border outline-none text-sm bg-slate-50"
              >
                <option value="" disabled>Selecciona tipo...</option>
                {documentTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input 
              type="text" 
              placeholder={selectedWarehouse ? "Escanea o busca el código del producto..." : "Selecciona una bodega primero..."}
              value={searchTerm}
              disabled={!selectedWarehouse}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50/30 text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-indigo-400 font-medium disabled:opacity-50"
            />
            
            {searchTerm && selectedWarehouse && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {filteredProducts.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                      const stock = p.tra_product_stock?.[0]?.quantity || 0;
                      return (
                      <li 
                        key={p.id} 
                        onClick={() => addProductToDetail(p)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.sku} | Base: ${p.base_price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Stock: {stock}</span>
                          <button className="text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    )})}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm">No se encontraron productos con stock en esta bodega.</div>
                )}
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1 p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Cant.</th>
                    <th className="px-4 py-3 font-semibold w-28 text-right">Precio V.</th>
                    <th className="px-4 py-3 font-semibold w-24 text-right">IVA</th>
                    <th className="px-4 py-3 font-semibold w-28 text-right">Total</th>
                    <th className="px-4 py-3 font-semibold w-12 text-center"></th>
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
                          onChange={e => updateDetail(index, e.target.value)}
                          className="w-full text-center border border-slate-300 rounded-lg py-1 px-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ${d.unit_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        ${d.tax_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 bg-slate-50/50">
                        ${d.total.toFixed(2)}
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
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                        Factura vacía. Escanea productos para comenzar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* LADO DERECHO: TOTALES */}
        <div className="flex flex-col space-y-4">
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-slate-400 font-semibold mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
                Resumen de Venta
              </h3>
              
              <div className="space-y-4 mb-6 border-b border-slate-700 pb-6">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal (Sin Impuestos)</span>
                  <span className="font-medium text-white">${globalSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Impuestos (IVA)</span>
                  <span className="font-medium text-white">${globalTax.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8">
                <span className="text-slate-400 text-lg">Total a Cobrar</span>
                <span className="text-4xl font-black text-indigo-400">
                  ${globalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button 
              onClick={handleSaveSale}
              disabled={saving || details.length === 0 || !hasPermission('SALE_CREATE')}
              title={!hasPermission('SALE_CREATE') ? "Sin permisos para facturar" : ""}
              className={`w-full py-5 rounded-xl font-bold flex items-center justify-center gap-2 text-lg transition-all ${
                !hasPermission('SALE_CREATE')
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-80'
                  : saving || details.length === 0 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'
              }`}
            >
              <Save className="w-6 h-6" />
              {saving ? 'Facturando...' : !hasPermission('SALE_CREATE') ? 'Sin permisos para facturar' : 'Cobrar e Imprimir'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

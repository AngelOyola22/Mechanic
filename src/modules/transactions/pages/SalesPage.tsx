import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../config/supabase';
import {
  ShoppingCart, Search, Plus, Trash2, Save, Store, UserCheck, AlertCircle, CheckCircle2,
  FileText, BarChart3, List, Phone, Mail, MapPin, User, Check, ChevronDown, X, Printer,
  Car, Wrench, Gauge
} from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { useAuth } from '../../../context/AuthContext';
import { SalesDocumentsTab } from '../components/SalesDocumentsTab';
import { SalesReportsTab } from '../components/SalesReportsTab';
import { OilChangeHistoryTab } from '../components/OilChangeHistoryTab';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';

// --- Types ---
interface Client {
  id: number;
  name: string;
  document_id: string;
  phone?: string | null;
  email?: string | null;
}

export interface OilChangeDetailInfo {
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  currentMileage: number;
  nextChangeMileage: number;
  oilType?: string;
  notes?: string;
}

interface CompletedSale {
  invoiceNumber: string;
  clientName: string;
  clientDoc: string;
  branchName: string;
  warehouseName: string;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  date: string;
  oilChangeData?: OilChangeDetailInfo;
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
  type_id?: number | null;
  cat_product_types?: { id: number; name: string };
  cat_taxes?: { percentage: number };
  tra_product_stock?: ProductStock[];
  is_service?: boolean;
}

interface SaleDetail {
  product: Product;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  oil_change_data?: OilChangeDetailInfo;
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
  const [documentTypes, setDocumentTypes] = useState<{ id: number, name: string }[]>([]);

  // Details
  const [details, setDetails] = useState<SaleDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'proceso' | 'documentos' | 'informes' | 'aceite'>('proceso');

  // Quick Client Creation Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientDoc, setNewClientDoc] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientModalError, setClientModalError] = useState<string | null>(null);

  // Product Catalog Modal & Pagination
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const CATALOG_PAGE_SIZE = 6;

  // Searchable Client Dropdown State
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Oil Change Modal for POS (when SRV-002 or "cambio de aceite" is added)
  const [isOilModalOpen, setIsOilModalOpen] = useState(false);
  const [pendingOilProduct, setPendingOilProduct] = useState<Product | null>(null);
  const [oilPlate, setOilPlate] = useState('');
  const [oilBrand, setOilBrand] = useState('');
  const [oilModel, setOilModel] = useState('');
  const [oilYear, setOilYear] = useState('');
  const [oilCurrentKm, setOilCurrentKm] = useState('');
  const [oilInterval, setOilInterval] = useState<number>(5000);
  const [oilNextKm, setOilNextKm] = useState('');
  const [oilTypeUsed, setOilTypeUsed] = useState('Sintético 5W-30');
  const [oilNotes, setOilNotes] = useState('');
  const [oilModalError, setOilModalError] = useState<string | null>(null);
  const [posVehicleBrands, setPosVehicleBrands] = useState<{ id: number; name: string }[]>([]);
  const [posVehicleModels, setPosVehicleModels] = useState<{ id: number; brand_id: number; name: string }[]>([]);

  // Completed Sale Modal State
  const [isSaleCompletedModalOpen, setIsSaleCompletedModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  const handlePrintCompletedSale = (sale: CompletedSale) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    const itemsHtml = sale.items
      .map(
        d => `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.name}</td>
          <td style="text-align: center; padding: 6px 4px; border-bottom: 1px dashed #ddd;">${d.quantity}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${d.unitPrice.toFixed(2)}</td>
          <td style="text-align: right; padding: 6px 4px; border-bottom: 1px dashed #ddd;">$${d.total.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante ${sale.invoiceNumber}</title>
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
            <div>Sucursal: ${sale.branchName}</div>
            <div>Bodega: ${sale.warehouseName}</div>
            <div><strong>Comprobante: ${sale.invoiceNumber}</strong></div>
            <div>Fecha: ${sale.date}</div>
          </div>
          <div><strong>Cliente:</strong> ${sale.clientName}</div>
          <div><strong>Identificación:</strong> ${sale.clientDoc}</div>

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
            <div>IVA: $${sale.tax.toFixed(2)}</div>
            <div class="bold">TOTAL: $${sale.total.toFixed(2)}</div>
          </div>

          ${sale.oilChangeData ? `
            <div style="margin-top: 15px; border: 2px dashed #222; padding: 10px; border-radius: 6px; background-color: #fafafa;">
              <div style="text-align: center; font-weight: bold; font-size: 13px;">🚗 RECORDATORIO DE CAMBIO DE ACEITE</div>
              <div style="margin-top: 5px;"><strong>Vehículo:</strong> ${[sale.oilChangeData.vehicleBrand, sale.oilChangeData.vehicleModel].filter(Boolean).join(' ')} (Placa: ${sale.oilChangeData.vehiclePlate})</div>
              <div><strong>Km Actual:</strong> ${sale.oilChangeData.currentMileage.toLocaleString()} km</div>
              <div style="font-size: 14px; font-weight: bold; color: #000; margin: 4px 0;">
                PRÓXIMO CAMBIO: ${sale.oilChangeData.nextChangeMileage.toLocaleString()} km
              </div>
              <div><strong>Aceite:</strong> ${sale.oilChangeData.oilType || 'Sintético'}</div>
            </div>
          ` : ''}

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  // When branch changes, auto-select warehouse if not already belonging to the branch
  useEffect(() => {
    if (selectedBranch && warehouses.length > 0) {
      const whs = warehouses.filter(w => w.branch_id === Number(selectedBranch));
      const currentWhValid = whs.some(w => w.id === Number(selectedWarehouse));
      if (!currentWhValid) {
        const defaultWh = whs.find(w =>
          w.name.toLowerCase().includes('matriz principal') ||
          w.name.toLowerCase().includes('principal') ||
          w.name.toLowerCase().includes('matriz')
        ) || whs[0];
        setSelectedWarehouse(defaultWh ? defaultWh.id : '');
      }
    } else if (!selectedBranch) {
      setSelectedWarehouse('');
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
      const [clientRes, branchRes, whRes, docTypeRes, brandsRes, modelsRes] = await Promise.all([
        supabase.from('cat_clients').select('id, name, document_id, phone, email').eq('is_customer', true),
        supabase.from('cat_branches').select('id, name').eq('is_active', true),
        supabase.from('cat_warehouses').select('id, name, branch_id').eq('is_active', true),
        supabase.from('sys_document_types').select('id, name').eq('is_active', true),
        supabase.from('cat_vehicle_brands').select('id, name').eq('is_active', true),
        supabase.from('cat_vehicle_models').select('id, brand_id, name').eq('is_active', true)
      ]);

      if (clientRes.error) throw clientRes.error;
      if (branchRes.error) throw branchRes.error;
      if (whRes.error) throw whRes.error;
      if (docTypeRes.error) throw docTypeRes.error;

      const clientsData: Client[] = (clientRes.data as any) || [];
      const branchesData: Branch[] = (branchRes.data as any) || [];
      const warehousesData: Warehouse[] = (whRes.data as any) || [];
      const docTypesData: { id: number; name: string }[] = docTypeRes.data || [];

      setClients(clientsData);
      setBranches(branchesData);
      setWarehouses(warehousesData);
      setDocumentTypes(docTypesData);
      setPosVehicleBrands(brandsRes.data || []);
      setPosVehicleModels(modelsRes.data || []);

      // 1. Sucursal por defecto: "Matriz Guayaquil" o la que contenga "matriz" o primera disponible
      const defaultBranch = branchesData.find(b => b.name.toLowerCase().includes('matriz')) || branchesData[0];
      const branchId = defaultBranch ? defaultBranch.id : '';
      setSelectedBranch(branchId);

      // 2. Bodega por defecto: "Matriz Principal" o la que contenga "principal" / "matriz" de dicha sucursal
      if (branchId) {
        const branchWhs = warehousesData.filter(w => w.branch_id === Number(branchId));
        const defaultWh = branchWhs.find(w =>
          w.name.toLowerCase().includes('matriz principal') ||
          w.name.toLowerCase().includes('principal') ||
          w.name.toLowerCase().includes('matriz')
        ) || branchWhs[0];
        if (defaultWh) {
          setSelectedWarehouse(defaultWh.id);
        }
      }

      // 3. Cliente por defecto: "Consumidor Final" o identificación 9999999999999 / 9999999999
      const defaultClient = clientsData.find(c =>
        c.name.toLowerCase().includes('consumidor final') ||
        c.document_id === '9999999999999' ||
        c.document_id === '9999999999'
      ) || clientsData[0];
      if (defaultClient) {
        setSelectedClient(defaultClient.id);
        setClientSearchQuery(`${defaultClient.name} (${defaultClient.document_id})`);
      }

      // 4. Tipo de documento por defecto: "Factura"
      const defaultDocType = docTypesData.find(d => d.name.toLowerCase().includes('factura')) || docTypesData[0];
      if (defaultDocType) {
        setSelectedDocType(defaultDocType.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar catálogos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsByWarehouse = async (warehouseId: number) => {
    try {
      // 1. Obtener todos los productos activos con sus tipos, impuestos y stock en esta bodega
      const { data, error } = await supabase.from('cat_products').select(`
        id, sku, name, base_price, type_id,
        cat_product_types (id, name),
        cat_taxes (percentage),
        tra_product_stock (warehouse_id, quantity)
      `).eq('is_active', true).order('id');

      if (error) throw error;

      // Un producto está disponible para venta si:
      // a) Es un servicio (type_id === 3 o nombre 'servicios') -> stock ilimitado
      // b) O tiene stock > 0 en la bodega seleccionada
      const mapped = (data || []).map((p: any) => {
        const isService = p.type_id === 3 || p.cat_product_types?.name?.toLowerCase().includes('servicio');
        const whStock = p.tra_product_stock?.find((s: any) => s.warehouse_id === warehouseId)?.quantity || 0;

        return {
          ...p,
          is_service: isService,
          tra_product_stock: [{ quantity: isService ? 999999 : whStock }]
        };
      }).filter((p: any) => p.is_service || (p.tra_product_stock[0]?.quantity > 0));

      setProducts(mapped as any);
    } catch (err: any) {
      setError('Error al cargar inventario y servicios: ' + err.message);
    }
  };

  const isOilChangeProduct = (prod: Product) => {
    return prod.sku === 'SRV-002' || prod.name.toLowerCase().includes('cambio de aceite');
  };

  const addProductToDetail = (product: Product) => {
    // Si es servicio de cambio de aceite, abrir el modal de placa y kilometraje
    if (isOilChangeProduct(product)) {
      setPendingOilProduct(product);
      setOilPlate('');
      setOilBrand('');
      setOilModel('');
      setOilYear('');
      setOilCurrentKm('');
      setOilInterval(5000);
      setOilNextKm('');
      setOilNotes('');
      setOilModalError(null);
      setIsOilModalOpen(true);
      return;
    }

    executeAddProduct(product);
  };

  const executeAddProduct = (product: Product, oilData?: OilChangeDetailInfo) => {
    const isService = product.is_service || product.type_id === 3;
    const stockAvailable = isService ? 999999 : (product.tra_product_stock?.[0]?.quantity || 0);

    const existingIndex = details.findIndex(d => d.product.id === product.id && !oilData);
    if (existingIndex >= 0 && !oilData) {
      const newDetails = [...details];
      if (newDetails[existingIndex].quantity + 1 > stockAvailable) {
        setError(`No hay suficiente stock. Máximo disponible: ${stockAvailable}`);
        return;
      }

      newDetails[existingIndex].quantity += 1;
      const qty = newDetails[existingIndex].quantity;
      const price = newDetails[existingIndex].unit_price;
      const taxPerc = newDetails[existingIndex].tax_percentage;

      newDetails[existingIndex].subtotal = qty * price;
      newDetails[existingIndex].tax_amount = (qty * price) * (taxPerc / 100);
      newDetails[existingIndex].total = newDetails[existingIndex].subtotal + newDetails[existingIndex].tax_amount;

      setDetails(newDetails);
    } else {
      if (!isService && 1 > stockAvailable) {
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
        total: subtotal + taxAmount,
        oil_change_data: oilData
      }]);
    }
    setSearchTerm('');
    setError(null);
  };

  const handleConfirmOilChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oilPlate.trim() || !oilCurrentKm || !oilNextKm) {
      setOilModalError('Placa, Kilometraje Actual y Próximo Cambio son requeridos.');
      return;
    }

    if (!pendingOilProduct) return;

    const oilData: OilChangeDetailInfo = {
      vehiclePlate: oilPlate.trim().toUpperCase(),
      vehicleBrand: oilBrand.trim(),
      vehicleModel: oilModel.trim(),
      vehicleYear: oilYear ? parseInt(oilYear, 10) : undefined,
      currentMileage: parseInt(oilCurrentKm, 10),
      nextChangeMileage: parseInt(oilNextKm, 10),
      oilType: oilTypeUsed,
      notes: oilNotes.trim()
    };

    executeAddProduct(pendingOilProduct, oilData);
    setIsOilModalOpen(false);
    setPendingOilProduct(null);
  };

  const updateDetail = (index: number, qtyString: string) => {
    let qty = parseInt(qtyString, 10);
    if (isNaN(qty) || qty < 1) qty = 1;

    const isService = details[index].product.is_service || details[index].product.type_id === 3;
    const stockAvailable = isService ? 999999 : (details[index].product.tra_product_stock?.[0]?.quantity || 0);

    if (!isService && qty > stockAvailable) {
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

  const handleCreateQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientDoc.trim() || !newClientName.trim()) {
      setClientModalError('Identificación (Cédula/RUC) y Nombre son requeridos.');
      return;
    }

    try {
      setCreatingClient(true);
      setClientModalError(null);

      const { data, error: insertError } = await supabase
        .from('cat_clients')
        .insert([{
          document_id: newClientDoc.trim(),
          name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
          email: newClientEmail.trim() || null,
          address: newClientAddress.trim() || null,
          is_customer: true,
          is_supplier: false
        }])
        .select('id, name, document_id, phone, email')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Ya existe un cliente con esa identificación.');
        }
        throw insertError;
      }

      setClients(prev => [data, ...prev]);
      setSelectedClient(data.id);
      setClientSearchQuery(`${data.name} (${data.document_id})`);

      setNewClientDoc('');
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setNewClientAddress('');
      setIsClientModalOpen(false);
    } catch (err: any) {
      setClientModalError(err.message || 'Error al guardar cliente.');
    } finally {
      setCreatingClient(false);
    }
  };

  // Lógica del Combobox de Clientes (búsqueda por cédula, nombre o scroll)
  const selectedClientObj = clients.find(cl => cl.id === Number(selectedClient));
  const isSelectedClientLabel = Boolean(
    selectedClientObj && clientSearchQuery === `${selectedClientObj.name} (${selectedClientObj.document_id})`
  );

  const filteredClients = clients.filter(c => {
    if (!clientSearchQuery.trim() || isSelectedClientLabel) return true;
    const query = clientSearchQuery.toLowerCase().trim();
    return (
      c.document_id.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    );
  });

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client.id);
    setClientSearchQuery(`${client.name} (${client.document_id})`);
    setIsClientDropdownOpen(false);
  };

  const handleClearClient = () => {
    setSelectedClient('');
    setClientSearchQuery('');
    setIsClientDropdownOpen(true);
  };

  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredClients.length > 0) {
        handleSelectClient(filteredClients[0]);
      } else if (clientSearchQuery.trim()) {
        setNewClientDoc(clientSearchQuery.trim());
        setNewClientName('');
        setIsClientModalOpen(true);
        setIsClientDropdownOpen(false);
      }
    }
  };

  const filteredCatalogProducts = products.filter(p =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );
  const totalCatalogPages = Math.ceil(filteredCatalogProducts.length / CATALOG_PAGE_SIZE);
  const paginatedCatalogProducts = filteredCatalogProducts.slice(
    (catalogPage - 1) * CATALOG_PAGE_SIZE,
    catalogPage * CATALOG_PAGE_SIZE
  );

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

      const userId = user?.id;
      if (!userId) throw new Error('Usuario no identificado en la sesión');

      // 0. Obtener secuencial
      const { data: docNumber, error: docError } = await supabase.rpc('fn_get_next_document_number', {
        p_document_type_id: Number(selectedDocType)
      });
      if (docError) throw new Error('No se pudo generar el número de documento: ' + docError.message);

      // 1. Insertar Cabecera de Venta
      const { data: saleData, error: saleError } = await supabase
        .from('tra_sales')
        .insert([{
          user_id: userId,
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

      // 3. Descontar del Kardex y del Stock Físico (SOLO para repuestos e insumos físicos)
      const kardexPayload = [];

      for (const d of details) {
        const isService = d.product.is_service || d.product.type_id === 3;
        if (isService) {
          // Los servicios de mano de obra / cambio de aceite no descuentan stock físico
          continue;
        }

        // A. Obtener stock actual
        const { data: currentStockObj } = await supabase
          .from('tra_product_stock')
          .select('quantity')
          .eq('product_id', d.product.id)
          .eq('warehouse_id', Number(selectedWarehouse))
          .single();

        const currentStock = currentStockObj?.quantity || 0;
        const newStock = Math.max(0, currentStock - d.quantity);

        // B. Insertar Kardex (Tipo 2 = Salida por Venta, multiplier -1)
        kardexPayload.push({
          product_id: d.product.id,
          warehouse_id: Number(selectedWarehouse),
          movement_type_id: 2,
          reference_id: saleData.id,
          quantity: d.quantity,
          stock_balance: newStock,
          user_id: userId
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

      // Guardar Kardex solo si hubo salida de items físicos
      if (kardexPayload.length > 0) {
        const { error: kxError } = await supabase.from('tra_kardex').insert(kardexPayload);
        if (kxError) throw kxError;
      }

      // 4. Registrar Cambio de Aceite si algún item lo incluye
      const oilDetail = details.find(d => d.oil_change_data);
      if (oilDetail && oilDetail.oil_change_data) {
        const oData = oilDetail.oil_change_data;
        const oilPayload = {
          sale_id: saleData.id,
          client_id: Number(selectedClient),
          vehicle_plate: oData.vehiclePlate.toUpperCase(),
          vehicle_brand: oData.vehicleBrand || null,
          vehicle_model: oData.vehicleModel || null,
          vehicle_year: oData.vehicleYear || null,
          current_mileage: oData.currentMileage,
          next_change_mileage: oData.nextChangeMileage,
          oil_type: oData.oilType || 'Sintético 5W-30',
          notes: oData.notes || null,
          service_date: new Date().toISOString(),
          status: 'ACTIVE'
        };

        try {
          await supabase.from('tra_oil_changes').insert([oilPayload]);
        } catch (e) {
          console.warn('tra_oil_changes remote insert notice:', e);
        }

        // Respaldo local
        try {
          const clientObj = clients.find(c => c.id === Number(selectedClient));
          const existingLocal = JSON.parse(localStorage.getItem('sys_tra_oil_changes_backup') || '[]');
          existingLocal.unshift({
            id: Date.now(),
            ...oilPayload,
            invoice_number: docNumber,
            client_name: clientObj?.name || 'Cliente',
            client_phone: clientObj?.phone || '',
            client_email: clientObj?.email || '',
            client_document_id: clientObj?.document_id || ''
          });
          localStorage.setItem('sys_tra_oil_changes_backup', JSON.stringify(existingLocal));
        } catch (e) { }
      }

      // Capturar datos para el modal de Factura Generada
      const clientObj = clients.find(c => c.id === Number(selectedClient));
      const branchObj = branches.find(b => b.id === Number(selectedBranch));
      const whObj = warehouses.find(w => w.id === Number(selectedWarehouse));

      setCompletedSale({
        invoiceNumber: docNumber,
        clientName: clientObj?.name || 'Consumidor Final',
        clientDoc: clientObj?.document_id || '9999999999999',
        branchName: branchObj?.name || 'Matriz Principal',
        warehouseName: whObj?.name || 'Bodega Principal',
        subtotal: globalSubtotal,
        tax: globalTax,
        total: globalTotal,
        items: details.map(d => ({
          name: d.product.name,
          quantity: d.quantity,
          unitPrice: d.unit_price,
          total: d.total
        })),
        date: new Date().toLocaleString(),
        oilChangeData: oilDetail?.oil_change_data
      });
      setIsSaleCompletedModalOpen(true);

      // RESET y EXITO
      setSuccess(true);
      setDetails([]);
      setSearchTerm('');

      // Restablecer cliente y tipo de documento a los valores por defecto
      const defaultClient = clients.find(c =>
        c.name.toLowerCase().includes('consumidor final') ||
        c.document_id === '9999999999999' ||
        c.document_id === '9999999999'
      ) || clients[0];
      if (defaultClient) setSelectedClient(defaultClient.id);
      if (defaultClient) {
        setSelectedClient(defaultClient.id);
        setClientSearchQuery(`${defaultClient.name} (${defaultClient.document_id})`);
      }

      const defaultDocType = documentTypes.find(d => d.name.toLowerCase().includes('factura')) || documentTypes[0];
      if (defaultDocType) setSelectedDocType(defaultDocType.id);

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
            Módulo de Ventas
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona el proceso de facturación, comprobantes emitidos e informes analíticos.
          </p>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto [&>button]:whitespace-nowrap [&>button]:shrink-0">
        <button
          onClick={() => setActiveTab('proceso')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'proceso'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Procesos (Punto de Venta)
        </button>

        <button
          onClick={() => setActiveTab('documentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'documentos'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <FileText className="w-4 h-4" />
          Documentos (Historial)
        </button>

        <button
          onClick={() => setActiveTab('informes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'informes'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          Informes de Ventas
        </button>

        <button
          onClick={() => setActiveTab('aceite')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'aceite'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <Car className="w-4 h-4" />
          Historial de Aceite y Recordatorios
        </button>
      </div>

      {activeTab === 'documentos' && <SalesDocumentsTab />}
      {activeTab === 'informes' && <SalesReportsTab />}
      {activeTab === 'aceite' && <OilChangeHistoryTab />}

      {activeTab === 'proceso' && (
        <>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3 mb-6">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
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

                <div className="relative" ref={clientDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Cliente *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewClientDoc('');
                        setNewClientName('');
                        setIsClientModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                      title="Registrar nuevo cliente"
                    >
                      <Plus className="w-3 h-3" /> Nuevo Cliente
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe cédula, RUC o nombre..."
                      value={clientSearchQuery}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      onChange={e => {
                        setClientSearchQuery(e.target.value);
                        setIsClientDropdownOpen(true);
                        if (!e.target.value.trim()) {
                          setSelectedClient('');
                        }
                      }}
                      onKeyDown={handleClientKeyDown}
                      className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-3 pr-8 border outline-none text-sm bg-slate-50 font-medium text-slate-800"
                    />

                    {clientSearchQuery ? (
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                        title="Borrar selección"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown Menu Scroleable y Filtrable */}
                  {isClientDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(c => {
                            const isSelected = c.id === Number(selectedClient);
                            return (
                              <div
                                key={c.id}
                                onClick={() => handleSelectClient(c)}
                                className={`p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-indigo-50/80 font-semibold' : ''
                                  }`}
                              >
                                <div className="flex-1 min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                                      {c.document_id}
                                    </span>
                                    <span className="text-sm truncate text-slate-800 font-medium">
                                      {c.name}
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-sm text-slate-500 space-y-2">
                            <p className="text-xs">
                              No se encontró ningún cliente con "<strong>{clientSearchQuery}</strong>"
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setNewClientDoc(clientSearchQuery.trim());
                                setNewClientName('');
                                setIsClientModalOpen(true);
                                setIsClientDropdownOpen(false);
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Registrar "{clientSearchQuery}"
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Pie del Dropdown */}
                      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between items-center">
                        <span>{filteredClients.length} clientes disponibles</span>
                        <span>Escribe cédula o nombre, o desliza</span>
                      </div>
                    </div>
                  )}
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

              {/* Buscador y Botón Ver Catálogo */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
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
                            const isService = p.is_service || p.type_id === 3;
                            const stockText = isService ? 'Servicio' : `Stock: ${p.tra_product_stock?.[0]?.quantity || 0}`;
                            return (
                              <li
                                key={p.id}
                                onClick={() => addProductToDetail(p)}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800">{p.name}</p>
                                    {isService && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                        Servicio
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">{p.sku} | Base: ${p.base_price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${isService ? 'text-indigo-700 bg-indigo-50' : 'text-slate-500 bg-slate-100'}`}>
                                    {stockText}
                                  </span>
                                  <button className="text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-sm">No se encontraron productos o servicios disponibles.</div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCatalogPage(1);
                    setCatalogSearch('');
                    setIsCatalogModalOpen(true);
                  }}
                  disabled={!selectedWarehouse}
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap h-[46px]"
                  title="Ver catálogo de productos con stock y precios"
                >
                  <List className="w-4 h-4" />
                  Ver Productos
                </button>
              </div>

              {/* Tabla */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1 p-0">
                  <table className="w-full min-w-[560px] text-left text-sm">
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
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{d.product.name}</p>
                              {(d.product.is_service || d.product.type_id === 3) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Servicio
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">{d.product.sku}</p>

                            {/* Detalle automotriz de cambio de aceite si existe */}
                            {d.oil_change_data && (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                                <Car className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Placa: <strong className="font-mono text-slate-900">{d.oil_change_data.vehiclePlate}</strong></span>
                                <span>•</span>
                                <span>Km: {d.oil_change_data.currentMileage.toLocaleString()} → <strong className="text-emerald-700">{d.oil_change_data.nextChangeMileage.toLocaleString()} km</strong></span>
                                <span>({d.oil_change_data.oilType || 'Sintético'})</span>
                              </div>
                            )}
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
                  className={`w-full py-5 rounded-xl font-bold flex items-center justify-center gap-2 text-lg transition-all ${!hasPermission('SALE_CREATE')
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

          {/* Modal: Crear Cliente Rápido */}
          <Modal
            isOpen={isClientModalOpen}
            onClose={() => setIsClientModalOpen(false)}
            title="Crear Nuevo Cliente"
            maxWidth="md"
          >
            <form onSubmit={handleCreateQuickClient} className="p-6 space-y-4">
              {clientModalError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{clientModalError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cédula / RUC *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. 0912345678 o 0999999999001"
                    value={newClientDoc}
                    onChange={e => setNewClientDoc(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nombre Completo / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez o Taller Mecánico S.A."
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="0991234567"
                      value={newClientPhone}
                      onChange={e => setNewClientPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="cliente@ejemplo.com"
                      value={newClientEmail}
                      onChange={e => setNewClientEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Dirección
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ciudad / Calles"
                    value={newClientAddress}
                    onChange={e => setNewClientAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingClient}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {creatingClient ? 'Guardando...' : 'Guardar y Seleccionar'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Catálogo de Productos Paginado */}
          <Modal
            isOpen={isCatalogModalOpen}
            onClose={() => setIsCatalogModalOpen(false)}
            title="Catálogo de Productos - Existencias y Precios"
            maxWidth="3xl"
          >
            <div className="p-6 space-y-4 flex flex-col">
              {/* Buscador interno del catálogo */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por SKU o nombre de producto..."
                    value={catalogSearch}
                    onChange={e => {
                      setCatalogSearch(e.target.value);
                      setCatalogPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl font-medium">
                  Bodega: <strong className="text-slate-800">{warehouses.find(w => w.id === Number(selectedWarehouse))?.name || 'Seleccionada'}</strong>
                </span>
              </div>

              {/* Tabla de Productos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Producto / Insumo</th>
                      <th className="py-2.5 px-3 text-right">Precio V.</th>
                      <th className="py-2.5 px-3 text-right">IVA %</th>
                      <th className="py-2.5 px-3 text-center">Stock Disp.</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCatalogProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                          No se encontraron productos disponibles en esta bodega.
                        </td>
                      </tr>
                    ) : (
                      paginatedCatalogProducts.map(prod => {
                        const isService = prod.is_service || prod.type_id === 3;
                        const stock = isService ? 9999 : (prod.tra_product_stock?.[0]?.quantity || 0);
                        const inCartCount = details.find(d => d.product.id === prod.id)?.quantity || 0;
                        const availableLeft = isService ? 9999 : (stock - inCartCount);

                        return (
                          <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-500">
                              {prod.sku}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{prod.name}</span>
                                {isService && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                    Servicio
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-indigo-600">
                              ${prod.base_price.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                              {prod.cat_taxes?.percentage || 0}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isService ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Servicio
                                </span>
                              ) : (
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${availableLeft > 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}
                                >
                                  {availableLeft} unid.
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => addProductToDetail(prod)}
                                disabled={!isService && availableLeft <= 0}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-colors ${isService || availableLeft > 0
                                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white cursor-pointer'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Agregar {inCartCount > 0 ? `(${inCartCount})` : ''}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {filteredCatalogProducts.length > 0 && (
                  <Pagination
                    currentPage={catalogPage}
                    totalPages={totalCatalogPages}
                    totalItems={filteredCatalogProducts.length}
                    pageSize={CATALOG_PAGE_SIZE}
                    onPageChange={setCatalogPage}
                  />
                )}
              </div>
            </div>
          </Modal>

          {/* Modal: Registro de Vehículo y Kilometraje para Cambio de Aceite */}
          <Modal
            isOpen={isOilModalOpen}
            onClose={() => {
              setIsOilModalOpen(false);
              setPendingOilProduct(null);
            }}
            title="Datos del Vehículo para Cambio de Aceite"
            maxWidth="lg"
          >
            <form onSubmit={handleConfirmOilChange} className="p-6 space-y-4">
              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-xs flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong>Servicio: {pendingOilProduct?.name || 'Cambio de Aceite'}</strong>
                  <p className="mt-0.5 text-amber-700">Registra los datos del vehículo y el kilometraje para el control de mantenimiento y recordatorio del cliente.</p>
                </div>
              </div>

              {oilModalError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs">
                  {oilModalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. ABC-1234"
                    value={oilPlate}
                    onChange={e => setOilPlate(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Año del Carro
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 2022"
                    value={oilYear}
                    onChange={e => setOilYear(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Toyota / Chevrolet"
                    value={oilBrand}
                    onChange={e => setOilBrand(e.target.value)}
                    list="pos-brand-list"
                    className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <datalist id="pos-brand-list">
                    {posVehicleBrands.map(b => <option key={b.id} value={b.name} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Hilux / D-Max"
                    value={oilModel}
                    onChange={e => setOilModel(e.target.value)}
                    list="pos-model-list"
                    className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <datalist id="pos-model-list">
                    {posVehicleModels.map(m => <option key={m.id} value={m.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Kilometraje y Próximo Cambio
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Kilometraje Actual (km) *
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 85000"
                      value={oilCurrentKm}
                      onChange={e => {
                        setOilCurrentKm(e.target.value);
                        const num = parseInt(e.target.value, 10);
                        if (!isNaN(num)) setOilNextKm((num + oilInterval).toString());
                      }}
                      className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1 flex items-center justify-between">
                      <span>Próximo Cambio (km) *</span>
                      <span className="text-[10px] text-indigo-600 lowercase bg-indigo-100 px-1.5 py-0.5 rounded font-normal">✏️ editable</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 90000"
                      value={oilNextKm}
                      onChange={e => setOilNextKm(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/50"
                      required
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Puedes escribir el número exacto o usar los botones de abajo</span>
                  </div>
                </div>

                {/* Interval Buttons */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Intervalo sugerido según aceite:
                  </label>
                  <div className="flex gap-2">
                    {[
                      { label: '+5,000 km (Mineral)', val: 5000 },
                      { label: '+7,500 km', val: 7500 },
                      { label: '+10,000 km (Sintético)', val: 10000 }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => {
                          setOilInterval(item.val);
                          const num = parseInt(oilCurrentKm, 10);
                          if (!isNaN(num)) setOilNextKm((num + item.val).toString());
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${oilInterval === item.val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tipo de Aceite
                  </label>
                  <select
                    value={oilTypeUsed}
                    onChange={e => setOilTypeUsed(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl py-1.5 px-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="Sintético 5W-30">Sintético 5W-30</option>
                    <option value="Sintético 0W-20">Sintético 0W-20</option>
                    <option value="Semisintético 10W-40">Semisintético 10W-40</option>
                    <option value="Mineral 20W-50">Mineral 20W-50</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cambio de filtro y arandela de tapón..."
                  value={oilNotes}
                  onChange={e => setOilNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOilModalOpen(false);
                    setPendingOilProduct(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Confirmar y Agregar a la Venta
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Factura Generada con Éxito */}
          <Modal
            isOpen={isSaleCompletedModalOpen}
            onClose={() => setIsSaleCompletedModalOpen(false)}
            title="Comprobante Emitido"
            maxWidth="lg"
          >
            {completedSale && (
              <div className="p-6 space-y-5">
                {/* Cabecera de éxito con ícono y número de factura */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-inner">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800">¡Factura Generada con Éxito!</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    La transacción se registró correctamente y el inventario fue actualizado.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-mono font-bold text-sm">
                    <FileText className="w-4 h-4" />
                    <span>N° {completedSale.invoiceNumber}</span>
                  </div>
                </div>

                {/* Tarjeta de Datos de la Venta */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Cliente:</span>
                    <strong className="text-slate-800 text-sm truncate block">{completedSale.clientName}</strong>
                    <span className="text-slate-500 block font-mono">ID: {completedSale.clientDoc}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Sucursal & Bodega:</span>
                    <strong className="text-slate-800 text-sm truncate block">{completedSale.branchName}</strong>
                    <span className="text-slate-500 block truncate">{completedSale.warehouseName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Fecha y Hora:</span>
                    <span className="text-slate-700 font-medium">{completedSale.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Estado del Comprobante:</span>
                    <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[11px]">
                      PAGADA / COMPLETADA
                    </span>
                  </div>
                </div>

                {/* Tabla de Artículos Vendidos */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle de Productos</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-slate-500 font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-center w-12">Cant</th>
                          <th className="py-2 px-3">Producto / Insumo</th>
                          <th className="py-2 px-3 text-right">P. Unit</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {completedSale.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-center">{item.quantity}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{item.name}</td>
                            <td className="py-2 px-3 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Banner de Registro de Cambio de Aceite si se incluyó */}
                {completedSale.oilChangeData && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="text-amber-950 block font-bold text-sm">
                          🚗 Registro de Aceite: {completedSale.oilChangeData.vehiclePlate}
                        </strong>
                        <span className="text-amber-800">
                          {[completedSale.oilChangeData.vehicleBrand, completedSale.oilChangeData.vehicleModel].filter(Boolean).join(' ')} • {completedSale.oilChangeData.oilType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-amber-600 block uppercase font-bold">Próximo Cambio</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {completedSale.oilChangeData.nextChangeMileage.toLocaleString()} km
                      </span>
                    </div>
                  </div>
                )}

                {/* Resumen de Totales */}
                <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-md">
                  <div className="space-y-0.5 text-xs text-slate-300">
                    <div>Subtotal: <span className="font-mono text-white font-semibold">${completedSale.subtotal.toFixed(2)}</span></div>
                    <div>IVA: <span className="font-mono text-white font-semibold">${completedSale.tax.toFixed(2)}</span></div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-indigo-300 block font-semibold">Total Cobrado</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      ${completedSale.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handlePrintCompletedSale(completedSale)}
                    className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Ticket
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSaleCompletedModalOpen(false)}
                    className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Venta
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
};

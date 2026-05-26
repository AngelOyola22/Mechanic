import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { MapPin, Plus, Trash2, Pencil, Search, AlertCircle, X, Building, Store } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';

interface BranchDb {
  id: number;
  name: string;
}

interface WarehouseDb {
  id: number;
  code: string;
  name: string;
  location: string | null;
  is_active: boolean;
  branch_id: number | null;
  created_at: string;
  cat_branches?: BranchDb; // Join
}

export const WarehousesPage = () => {
  const { hasPermission } = usePermissions();
  const [warehouses, setWarehouses] = useState<WarehouseDb[]>([]);
  const [branches, setBranches] = useState<BranchDb[]>([]);
  
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
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [branchesRes, warehousesRes] = await Promise.all([
        supabase.from('cat_branches').select('id, name').eq('is_active', true),
        supabase.from('cat_warehouses').select('*, cat_branches(id, name)').order('id', { ascending: false })
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (warehousesRes.error) throw warehousesRes.error;

      setBranches(branchesRes.data || []);
      setWarehouses(warehousesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar bodegas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId && !hasPermission('BOD_UPDATE')) {
      setError('No tienes permisos para editar bodegas.');
      return;
    }
    if (!editingId && !hasPermission('BOD_CREATE')) {
      setError('No tienes permisos para crear bodegas.');
      return;
    }

    if (!code || !name || !branchId) {
      setError('El Código, Nombre y Sucursal son obligatorios');
      return;
    }

    try {
      setError(null);
      
      const payload = {
        code,
        name,
        location: location || null,
        branch_id: Number(branchId),
        is_active: isActive
      };

      if (editingId) {
        const { error } = await supabase.from('cat_warehouses').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_warehouses').insert([payload]);
        if (error) throw error;
      }

      await fetchData();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la bodega');
    }
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('BOD_DELETE')) {
      setError('No tienes permisos para eliminar bodegas.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Bodega',
      message: '¿Seguro que deseas eliminar esta bodega? Se perderá el rastro del stock si tiene movimientos asociados.',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('cat_warehouses').delete().eq('id', id);
          if (error) throw error;
          setWarehouses(warehouses.filter(w => w.id !== id));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar bodega');
        }
      }
    });
  };

  const openModal = (warehouse?: WarehouseDb) => {
    setError(null);
    if (warehouse) {
      setEditingId(warehouse.id);
      setCode(warehouse.code);
      setName(warehouse.name);
      setLocation(warehouse.location || '');
      setBranchId(warehouse.branch_id || '');
      setIsActive(warehouse.is_active);
    } else {
      setEditingId(null);
      setCode('');
      setName('');
      setLocation('');
      setBranchId(branches.length === 1 ? branches[0].id : ''); // Autoseleccionar si solo hay 1
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.cat_branches?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando catálogo de bodegas...</div>;

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
        title="Gestión de Bodegas"
        description="Administra los puntos de almacenamiento por cada sucursal."
        icon={<Building />}
        actionButton={{
          label: 'Nueva Bodega',
          onClick: () => openModal(),
          disabled: !hasPermission('BOD_CREATE'),
          disabledTitle: 'No tienes permisos para crear bodegas',
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
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por bodega o sucursal..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-80"
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">{filteredWarehouses.length} bodegas registradas</p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4 font-semibold">Bodega</th>
                <th className="px-6 py-4 font-semibold">Sucursal Perteneciente</th>
                <th className="px-6 py-4 font-semibold text-center">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWarehouses.map(warehouse => (
                <tr key={warehouse.id} className={`hover:bg-slate-50/50 transition-colors ${!warehouse.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        warehouse.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{warehouse.name}</p>
                        <p className="text-slate-500 text-xs font-mono">{warehouse.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 text-slate-600">
                      <Store className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-700">{warehouse.cat_branches?.name || 'No asignada'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      warehouse.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {warehouse.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModal(warehouse)}
                        disabled={!hasPermission('BOD_UPDATE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('BOD_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={!hasPermission('BOD_UPDATE') ? "Sin permiso para editar" : "Editar Bodega"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(warehouse.id)}
                        disabled={!hasPermission('BOD_DELETE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('BOD_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('BOD_DELETE') ? "Sin permiso para eliminar" : "Eliminar Bodega"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWarehouses.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState 
                      icon={<Building className="w-8 h-8" />}
                      title="No se encontraron bodegas"
                      description="Intenta con otro término de búsqueda o registra una nueva bodega."
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
        title={editingId ? 'Editar Bodega' : 'Nueva Bodega'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sucursal a la que pertenece *</label>
                <select 
                  value={branchId}
                  onChange={e => setBranchId(Number(e.target.value))}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none bg-white"
                >
                  <option value="" disabled>Selecciona una sucursal...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Código de Bodega *</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                  placeholder="Ej. MAT-01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Bodega *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                  placeholder="Ej. Bodega Principal"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicación (Opcional)</label>
                <textarea 
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none resize-none"
                  placeholder="Dirección física específica..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input 
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Bodega Activa (Disponible para movimientos)
                </label>
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
                  {editingId ? 'Guardar Cambios' : 'Crear Bodega'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Store, Plus, Search, Trash2, Pencil, AlertCircle, X, MapPin } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';

interface BranchDb {
  id: number;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export const BranchesPage = () => {
  const { hasPermission } = usePermissions();
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
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cat_branches')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      setBranches(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId && !hasPermission('BRN_UPDATE')) {
      setError('No tienes permisos para editar sucursales.');
      return;
    }
    if (!editingId && !hasPermission('BRN_CREATE')) {
      setError('No tienes permisos para crear sucursales.');
      return;
    }

    if (!code || !name) {
      setError('El Código y Nombre son obligatorios');
      return;
    }

    try {
      setError(null);
      
      const payload = {
        code,
        name,
        address: address || null,
        is_active: isActive
      };

      if (editingId) {
        const { error } = await supabase.from('cat_branches').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_branches').insert([payload]);
        if (error) throw error;
      }

      await fetchBranches();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la sucursal');
    }
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('BRN_DELETE')) {
      setError('No tienes permisos para eliminar sucursales.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Sucursal',
      message: '¿Seguro que deseas eliminar esta sucursal? Asegúrate de que no tenga bodegas o ventas asociadas.',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('cat_branches').delete().eq('id', id);
          if (error) throw error;
          setBranches(branches.filter(b => b.id !== id));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar sucursal');
        }
      }
    });
  };

  const openModal = (branch?: BranchDb) => {
    setError(null);
    if (branch) {
      setEditingId(branch.id);
      setCode(branch.code);
      setName(branch.name);
      setAddress(branch.address || '');
      setIsActive(branch.is_active);
    } else {
      setEditingId(null);
      setCode('');
      setName('');
      setAddress('');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando catálogo de sucursales...</div>;

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
        title="Catálogo de Sucursales"
        description="Gestiona los locales comerciales físicos de la empresa."
        icon={<Store />}
        actionButton={{
          label: 'Nueva Sucursal',
          onClick: () => openModal(),
          disabled: !hasPermission('BRN_CREATE'),
          disabledTitle: 'No tienes permisos para crear sucursales',
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
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-80"
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">{filteredBranches.length} sucursales registradas</p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4 font-semibold">Sucursal</th>
                <th className="px-6 py-4 font-semibold">Dirección</th>
                <th className="px-6 py-4 font-semibold text-center">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBranches.map(branch => (
                <tr key={branch.id} className={`hover:bg-slate-50/50 transition-colors ${!branch.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        branch.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{branch.name}</p>
                        <p className="text-slate-500 text-xs font-mono">{branch.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-600 truncate max-w-sm">{branch.address || 'Sin dirección registrada'}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${
                      branch.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {branch.is_active ? 'Operativa' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModal(branch)}
                        disabled={!hasPermission('BRN_UPDATE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('BRN_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={!hasPermission('BRN_UPDATE') ? "Sin permiso para editar" : "Editar Sucursal"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(branch.id)}
                        disabled={!hasPermission('BRN_DELETE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('BRN_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('BRN_DELETE') ? "Sin permiso para eliminar" : "Eliminar Sucursal"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBranches.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState 
                      icon={<Store className="w-8 h-8" />}
                      title="No se encontraron sucursales"
                      description="Intenta con otro término de búsqueda o registra una nueva sucursal."
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
        title={editingId ? 'Editar Sucursal' : 'Nueva Sucursal'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Código *</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                  placeholder="Ej. SUC-UIO"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Sucursal *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                  placeholder="Ej. Sucursal Quito Norte"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección</label>
                <textarea 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none resize-none"
                  placeholder="Dirección física completa..."
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
                  Sucursal Activa (Permitir facturación)
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
                  {editingId ? 'Guardar Cambios' : 'Crear Sucursal'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

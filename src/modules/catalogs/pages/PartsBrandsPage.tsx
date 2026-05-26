import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Tag, Plus, Trash2, Pencil, Search, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

interface PartsBrandDb {
  id: number;
  name: string;
  is_active: boolean;
}

export const PartsBrandsPage = () => {
  const { hasPermission } = usePermissions();
  const [brands, setBrands] = useState<PartsBrandDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', is_active: true });
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('cat_parts_brands').select('*').order('name');
      if (error) throw error;
      setBrands(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase.from('cat_parts_brands').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_parts_brands').insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchBrands();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Marca',
      message: '¿Estás seguro de que deseas eliminar esta marca de repuestos?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('cat_parts_brands').delete().eq('id', id);
          if (error) throw error;
          fetchBrands();
        } catch (err: any) {
          setError(err.message);
        }
      }
    });
  };

  const openModal = (brand?: PartsBrandDb) => {
    if (brand) {
      setEditingId(brand.id);
      setFormData({ name: brand.name, is_active: brand.is_active });
    } else {
      setEditingId(null);
      setFormData({ name: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando marcas...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader 
        title="Marcas de Repuestos"
        description="Gestiona las marcas de los repuestos e insumos del inventario."
        icon={<Tag />}
        actionButton={
          hasPermission('PBRND_CREATE') ? {
            label: 'Nueva Marca',
            onClick: () => openModal(),
          } : undefined
        }
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {brands.length === 0 && !loading && !error ? (
        <EmptyState 
          icon={<Tag className="w-8 h-8" />}
          title="No hay marcas registradas"
          description="Comienza creando marcas de repuestos."
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-semibold w-16">ID</th>
                  <th className="p-4 font-semibold">Marca</th>
                  <th className="p-4 font-semibold w-32 text-center">Estado</th>
                  <th className="p-4 font-semibold w-32 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map(brand => (
                  <tr key={brand.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-slate-400 font-mono text-sm">{brand.id}</td>
                    <td className="p-4 font-medium text-slate-800">{brand.name}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${brand.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {brand.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasPermission('PBRND_UPDATE') && (
                          <button onClick={() => openModal(brand)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('PBRND_DELETE') && (
                          <button onClick={() => handleDelete(brand.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Marca' : 'Nueva Marca'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nombre de la Marca</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Marca Activa
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-blue-600/20">
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

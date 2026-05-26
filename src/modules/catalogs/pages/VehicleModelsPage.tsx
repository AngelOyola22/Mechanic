import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { CarFront, Plus, Trash2, Pencil, Search, AlertCircle, Check } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

interface VehicleBrandDb {
  id: number;
  name: string;
}

interface VehicleModelDb {
  id: number;
  brand_id: number;
  name: string;
  is_active: boolean;
  cat_vehicle_brands?: VehicleBrandDb;
}

export const VehicleModelsPage = () => {
  const { hasPermission } = usePermissions();
  const [models, setModels] = useState<VehicleModelDb[]>([]);
  const [brands, setBrands] = useState<VehicleBrandDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', brand_id: 0, is_active: true });
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchModelsAndBrands();
  }, []);

  const fetchModelsAndBrands = async () => {
    try {
      setLoading(true);
      
      const [modelsRes, brandsRes] = await Promise.all([
        supabase.from('cat_vehicle_models').select(`*, cat_vehicle_brands(id, name)`).order('name'),
        supabase.from('cat_vehicle_brands').select('id, name').eq('is_active', true).order('name')
      ]);

      if (modelsRes.error) throw modelsRes.error;
      if (brandsRes.error) throw brandsRes.error;
      
      setModels(modelsRes.data || []);
      setBrands(brandsRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.brand_id === 0) {
      setError('Debes seleccionar una marca.');
      return;
    }
    
    try {
      if (editingId) {
        const { error } = await supabase.from('cat_vehicle_models')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_vehicle_models')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchModelsAndBrands();
    } catch (err: any) {
      if (err.code === '23505') {
        setError('Este modelo ya existe para esta marca.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Modelo',
      message: '¿Estás seguro de que deseas eliminar este modelo?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('cat_vehicle_models').delete().eq('id', id);
          if (error) throw error;
          fetchModelsAndBrands();
        } catch (err: any) {
          setError(err.message);
        }
      }
    });
  };

  const openModal = (model?: VehicleModelDb) => {
    setError(null);
    if (model) {
      setEditingId(model.id);
      setFormData({ name: model.name, brand_id: model.brand_id, is_active: model.is_active });
    } else {
      setEditingId(null);
      setFormData({ name: '', brand_id: brands.length > 0 ? brands[0].id : 0, is_active: true });
    }
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando modelos...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader 
        title="Modelos de Vehículos"
        description="Gestiona los modelos específicos de cada marca automotriz."
        icon={<CarFront />}
        actionButton={
          hasPermission('VMOD_CREATE') ? {
            label: 'Nuevo Modelo',
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

      {models.length === 0 && !loading && !error ? (
        <EmptyState 
          icon={<CarFront className="w-8 h-8" />}
          title="No hay modelos registrados"
          description="Comienza creando modelos para las marcas existentes."
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-semibold w-16">ID</th>
                  <th className="p-4 font-semibold">Marca</th>
                  <th className="p-4 font-semibold">Modelo</th>
                  <th className="p-4 font-semibold w-32 text-center">Estado</th>
                  <th className="p-4 font-semibold w-32 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {models.map(model => (
                  <tr key={model.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-slate-400 font-mono text-sm">{model.id}</td>
                    <td className="p-4 font-medium text-slate-600">{model.cat_vehicle_brands?.name}</td>
                    <td className="p-4 font-bold text-slate-800">{model.name}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${model.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {model.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasPermission('VMOD_UPDATE') && (
                          <button onClick={() => openModal(model)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('VMOD_DELETE') && (
                          <button onClick={() => handleDelete(model.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Modelo' : 'Nuevo Modelo'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Marca</label>
                <select
                  required
                  value={formData.brand_id}
                  onChange={e => setFormData({...formData, brand_id: Number(e.target.value)})}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value={0} disabled>Seleccione una marca</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nombre del Modelo</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ej. Yaris, Explorer"
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
                  Modelo Activo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-blue-600/20"
                >
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

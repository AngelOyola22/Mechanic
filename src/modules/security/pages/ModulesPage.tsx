import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Layers, Plus, Trash2, ChevronRight, AlertCircle, Pencil, X } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DynamicIcon } from '../../../components/ui/DynamicIcon';

interface ModuleDb {
  id: number;
  name: string;
  description?: string;
  icon?: string | null;
}

interface ScreenDb {
  id: number;
  module_id: number;
  name: string;
  route: string;
  icon?: string | null;
}

export const ModulesPage = () => {
  const { hasPermission } = usePermissions();
  const [modules, setModules] = useState<ModuleDb[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleDb | null>(null);
  const [screens, setScreens] = useState<ScreenDb[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null);
  
  // Forms State
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [newModuleIcon, setNewModuleIcon] = useState('');
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenRoute, setNewScreenRoute] = useState('');
  const [newScreenIcon, setNewScreenIcon] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Fetch initial modules
  useEffect(() => {
    fetchModules();
  }, []);

  // Fetch screens when a module is selected
  useEffect(() => {
    if (selectedModule) {
      fetchScreens(selectedModule.id);
    } else {
      setScreens([]);
    }
  }, [selectedModule]);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('seg_modules').select('*').order('id', { ascending: true });
      if (error) throw error;
      setModules(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar módulos');
    } finally {
      setLoading(false);
    }
  };

  const fetchScreens = async (moduleId: number) => {
    try {
      const { data, error } = await supabase.from('seg_screens').select('*').eq('module_id', moduleId).order('id', { ascending: true });
      if (error) throw error;
      setScreens(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pantallas');
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingModuleId && !hasPermission('MOD_UPDATE')) {
      setError('No tienes permisos para editar módulos.');
      return;
    }
    if (!editingModuleId && !hasPermission('MOD_CREATE')) {
      setError('No tienes permisos para crear módulos.');
      return;
    }
    if (!newModuleName.trim()) return;
    
    try {
      setError(null);
      if (editingModuleId) {
        const { error } = await supabase.from('seg_modules').update({ 
          name: newModuleName, 
          description: newModuleDesc,
          icon: newModuleIcon || null
        }).eq('id', editingModuleId);
        
        if (error) throw error;
        
        setModules(modules.map(m => m.id === editingModuleId ? { ...m, name: newModuleName, description: newModuleDesc, icon: newModuleIcon || null } : m));
        setEditingModuleId(null);
      } else {
        const { data, error } = await supabase.from('seg_modules').insert([{ 
          name: newModuleName, 
          description: newModuleDesc,
          icon: newModuleIcon || null
        }]).select().single();
        if (error) throw error;
        
        setModules([...modules, data]);
      }
      
      setNewModuleName('');
      setNewModuleDesc('');
      setNewModuleIcon('');
    } catch (err: any) {
      setError(err.message || 'Error al guardar módulo');
    }
  };

  const handleDeleteModule = (id: number) => {
    if (!hasPermission('MOD_DELETE')) {
      setError('No tienes permisos para eliminar módulos.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Módulo',
      message: '¿Seguro que deseas eliminar este módulo? También se eliminarán sus pantallas.',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('seg_modules').delete().eq('id', id);
          if (error) throw error;
          setModules(modules.filter(m => m.id !== id));
          if (selectedModule?.id === id) setSelectedModule(null);
        } catch (err: any) {
          setError(err.message || 'Error al eliminar módulo');
        }
      }
    });
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('MOD_UPDATE')) {
      setError('No tienes permisos para gestionar pantallas.');
      return;
    }
    if (!selectedModule || !newScreenName.trim() || !newScreenRoute.trim()) return;
    
    try {
      setError(null);
      const routeValue = newScreenRoute.startsWith('/') ? newScreenRoute : `/${newScreenRoute}`;
      
      if (editingScreenId) {
        const { error } = await supabase.from('seg_screens').update({ 
          name: newScreenName, 
          route: routeValue,
          icon: newScreenIcon || null
        }).eq('id', editingScreenId);
        
        if (error) throw error;
        
        setScreens(screens.map(s => s.id === editingScreenId ? { ...s, name: newScreenName, route: routeValue, icon: newScreenIcon || null } : s));
        setEditingScreenId(null);
      } else {
        const { data, error } = await supabase.from('seg_screens').insert([{ 
          module_id: selectedModule.id, 
          name: newScreenName, 
          route: routeValue,
          icon: newScreenIcon || null
        }]).select().single();
        if (error) throw error;
        
        setScreens([...screens, data]);
      }
      
      setNewScreenName('');
      setNewScreenRoute('');
      setNewScreenIcon('');
    } catch (err: any) {
      setError(err.message || 'Error al guardar pantalla');
    }
  };

  const handleDeleteScreen = (id: number) => {
    if (!hasPermission('MOD_UPDATE')) {
      setError('No tienes permisos para eliminar pantallas de un módulo.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Pantalla',
      message: '¿Seguro que deseas eliminar esta pantalla?',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('seg_screens').delete().eq('id', id);
          if (error) throw error;
          setScreens(screens.filter(s => s.id !== id));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar pantalla');
        }
      }
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando datos...</div>;
  }

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
        title="Gestión de Módulos y Pantallas"
        description="Crea y configura los módulos principales del sistema y las rutas de las pantallas asociadas."
        icon={<Layers />}
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Contenedor Dual Pane */}
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-[500px]">
        
        {/* PANEL IZQUIERDO: MÓDULOS */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 text-lg">Módulos del Sistema</h2>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            {modules.length === 0 ? (
              <p className="text-slate-500 text-sm text-center my-8">No hay módulos creados.</p>
            ) : (
              <ul className="space-y-2">
                {modules.map(mod => (
                  <li 
                    key={mod.id}
                    onClick={() => setSelectedModule(mod)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${
                      selectedModule?.id === mod.id 
                        ? 'border-blue-500 bg-blue-50/50' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedModule?.id === mod.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors'
                      }`}>
                        <DynamicIcon name={mod.icon} className="w-5 h-5" defaultIcon="Blocks" />
                      </div>
                      <div>
                        <p className={`font-semibold ${selectedModule?.id === mod.id ? 'text-blue-700' : 'text-slate-700'}`}>
                          {mod.name}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-1">{mod.description || 'Sin descripción'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingModuleId(mod.id);
                          setNewModuleName(mod.name);
                          setNewModuleDesc(mod.description || '');
                          setNewModuleIcon(mod.icon || '');
                        }}
                        disabled={!hasPermission('MOD_UPDATE')}
                        className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${!hasPermission('MOD_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={!hasPermission('MOD_UPDATE') ? "Sin permiso para editar" : "Editar Módulo"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id); }}
                        disabled={!hasPermission('MOD_DELETE')}
                        className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${!hasPermission('MOD_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('MOD_DELETE') ? "Sin permiso para eliminar" : "Eliminar Módulo"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 ml-1 ${selectedModule?.id === mod.id ? 'text-blue-500' : 'text-slate-400'}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {editingModuleId ? 'Editar Módulo' : 'Nuevo Módulo'}
            </h3>
            <form onSubmit={handleCreateModule} className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Nombre (ej. Seguridad)"
                value={newModuleName}
                disabled={(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE'))}
                onChange={e => setNewModuleName(e.target.value)}
                className={`w-full text-sm rounded-lg py-2 px-3 border outline-none ${(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
              />
              <input 
                type="text" 
                placeholder="Descripción (opcional)"
                value={newModuleDesc}
                disabled={(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE'))}
                onChange={e => setNewModuleDesc(e.target.value)}
                className={`w-full text-sm rounded-lg py-2 px-3 border outline-none ${(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
              />
              <div className="flex gap-2 items-center mt-1">
                <input 
                  type="text" 
                  placeholder="Ícono (ej. Shield, Users)"
                  value={newModuleIcon}
                  disabled={(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE'))}
                  onChange={e => setNewModuleIcon(e.target.value)}
                  className={`w-full text-sm rounded-lg py-2 px-3 border outline-none ${(!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                />
                <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-500">
                  <DynamicIcon name={newModuleIcon} className="w-5 h-5" defaultIcon="Blocks" />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button 
                  type="submit"
                  disabled={!newModuleName.trim() || (!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE'))}
                  className={`flex-1 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-1 ${
                    (!editingModuleId && !hasPermission('MOD_CREATE')) || (!!editingModuleId && !hasPermission('MOD_UPDATE'))
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  {editingModuleId ? 'Guardar Cambios' : 'Crear'}
                </button>
                {editingModuleId && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingModuleId(null);
                      setNewModuleName('');
                      setNewModuleDesc('');
                      setNewModuleIcon('');
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: PANTALLAS */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          {!selectedModule ? (
            <EmptyState 
              icon={<Layers className="w-8 h-8" />}
              title="Selecciona un módulo"
              description="Para visualizar y gestionar sus pantallas"
            />
          ) : (
            <>
              <div className="bg-blue-50/50 p-4 border-b border-blue-100">
                <h2 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                  Pantallas en: {selectedModule.name}
                </h2>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto">
                {screens.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center my-8">Este módulo aún no tiene pantallas.</p>
                ) : (
                  <ul className="space-y-2">
                    {screens.map(screen => (
                      <li key={screen.id} className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                            <DynamicIcon name={screen.icon} className="w-4 h-4" defaultIcon="CircleDot" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700">{screen.name}</p>
                            <p className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                              {screen.route}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingScreenId(screen.id);
                              setNewScreenName(screen.name);
                              setNewScreenRoute(screen.route);
                              setNewScreenIcon(screen.icon || '');
                            }}
                            disabled={!hasPermission('MOD_UPDATE')}
                            className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${!hasPermission('MOD_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            title={!hasPermission('MOD_UPDATE') ? "Sin permiso para editar" : "Editar Pantalla"}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteScreen(screen.id)}
                            disabled={!hasPermission('MOD_UPDATE')}
                            className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${!hasPermission('MOD_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                            title={!hasPermission('MOD_UPDATE') ? "Sin permiso para eliminar" : "Eliminar Pantalla"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {editingScreenId ? 'Editar Pantalla' : 'Nueva Pantalla'}
                </h3>
                <form onSubmit={handleCreateScreen} className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      placeholder="Nombre (ej. Usuarios)"
                      value={newScreenName}
                      disabled={!hasPermission('MOD_UPDATE')}
                      onChange={e => setNewScreenName(e.target.value)}
                      className={`flex-1 text-sm rounded-lg py-2 px-3 border outline-none ${!hasPermission('MOD_UPDATE') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                    />
                    <input 
                      type="text" 
                      placeholder="Ruta (ej. /security/users)"
                      value={newScreenRoute}
                      disabled={!hasPermission('MOD_UPDATE')}
                      onChange={e => setNewScreenRoute(e.target.value)}
                      className={`flex-1 text-sm rounded-lg py-2 px-3 border outline-none font-mono ${!hasPermission('MOD_UPDATE') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                    />
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input 
                      type="text" 
                      placeholder="Ícono (ej. Users, Package)"
                      value={newScreenIcon}
                      disabled={!hasPermission('MOD_UPDATE')}
                      onChange={e => setNewScreenIcon(e.target.value)}
                      className={`w-full text-sm rounded-lg py-2 px-3 border outline-none ${!hasPermission('MOD_UPDATE') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
                    />
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-slate-500">
                      <DynamicIcon name={newScreenIcon} className="w-5 h-5" defaultIcon="CircleDot" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      disabled={!newScreenName.trim() || !newScreenRoute.trim() || !hasPermission('MOD_UPDATE')}
                      title={!hasPermission('MOD_UPDATE') ? "Sin permiso para agregar pantallas" : ""}
                      className={`flex-1 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-1 ${
                        !hasPermission('MOD_UPDATE') 
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      {editingScreenId ? 'Guardar Cambios' : 'Crear'}
                    </button>
                    {editingScreenId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingScreenId(null);
                          setNewScreenName('');
                          setNewScreenRoute('');
                          setNewScreenIcon('');
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

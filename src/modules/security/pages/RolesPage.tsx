import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Shield, ShieldAlert, Plus, Trash2, ChevronRight, AlertCircle, Check } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DynamicIcon } from '../../../components/ui/DynamicIcon';

interface RoleDb {
  id: number;
  name: string;
  is_active: boolean;
}

interface ModuleDb { id: number; name: string; icon?: string | null; }
interface ScreenDb { id: number; module_id: number; name: string; icon?: string | null; route?: string; }
interface ActionDb {
  id: number;
  screen_id: number;
  name: string;
  code: string;
}

export const RolesPage = () => {
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<RoleDb[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDb | null>(null);
  
  // Árbol de permisos
  const [modules, setModules] = useState<ModuleDb[]>([]);
  const [screens, setScreens] = useState<ScreenDb[]>([]);
  const [actions, setActions] = useState<ActionDb[]>([]);
  
  // Permisos asignados al rol seleccionado (solo guardamos los action_ids)
  const [assignedActionIds, setAssignedActionIds] = useState<number[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole.id);
    } else {
      setAssignedActionIds([]);
    }
  }, [selectedRole]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Traemos todo en paralelo
      const [rolesRes, modRes, screenRes, actionRes] = await Promise.all([
        supabase.from('seg_roles').select('*').order('id', { ascending: true }),
        supabase.from('seg_modules').select('*').order('id', { ascending: true }),
        supabase.from('seg_screens').select('*').order('id', { ascending: true }),
        supabase.from('seg_actions').select('*').order('id', { ascending: true }),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (modRes.error) throw modRes.error;
      if (screenRes.error) throw screenRes.error;
      if (actionRes.error) throw actionRes.error;

      setRoles(rolesRes.data || []);
      setModules(modRes.data || []);
      setScreens(screenRes.data || []);
      setActions(actionRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos base');
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      const { data, error } = await supabase
        .from('seg_role_permissions')
        .select('action_id')
        .eq('role_id', roleId);
        
      if (error) throw error;
      setAssignedActionIds((data || []).map(p => p.action_id));
    } catch (err: any) {
      setError(err.message || 'Error al cargar los permisos del rol');
    }
  };

  // --- CRUD ROLES ---
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('ROL_CREATE')) {
      setError('No tienes permisos para crear roles.');
      return;
    }
    if (!newRoleName.trim()) return;
    
    try {
      setError(null);
      const { data, error } = await supabase.from('seg_roles').insert([{ name: newRoleName }]).select().single();
      if (error) throw error;
      
      setRoles([...roles, data]);
      setNewRoleName('');
    } catch (err: any) {
      setError(err.message || 'Error al crear rol');
    }
  };

  const handleDeleteRole = (id: number) => {
    if (!hasPermission('ROL_DELETE')) {
      setError('No tienes permisos para eliminar roles.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Rol',
      message: '¿Seguro que deseas eliminar este rol? Se borrarán todos sus permisos.',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('seg_roles').delete().eq('id', id);
          if (error) throw error;
          setRoles(roles.filter(r => r.id !== id));
          if (selectedRole?.id === id) setSelectedRole(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar rol');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // --- TOGGLE PERMISOS ---
  const togglePermission = async (actionId: number) => {
    if (!hasPermission('ROL_UPDATE')) {
      setError('No tienes permisos para modificar los permisos de los roles.');
      return;
    }
    if (!selectedRole) return;
    const hasPermissionVal = assignedActionIds.includes(actionId);
    
    try {
      setError(null);
      if (hasPermissionVal) {
        // Revocar
        const { error } = await supabase
          .from('seg_role_permissions')
          .delete()
          .match({ role_id: selectedRole.id, action_id: actionId });
        if (error) throw error;
        setAssignedActionIds(prev => prev.filter(id => id !== actionId));
      } else {
        // Asignar
        const { error } = await supabase
          .from('seg_role_permissions')
          .insert([{ role_id: selectedRole.id, action_id: actionId }]);
        if (error) throw error;
        setAssignedActionIds(prev => [...prev, actionId]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el permiso');
      // Refrescamos en caso de error de concurrencia
      fetchRolePermissions(selectedRole.id);
    }
  };

  const handleCheckAll = async () => {
    if (!hasPermission('ROL_UPDATE')) return;
    if (!selectedRole) return;
    try {
      setError(null);
      
      const missingIds = actions
        .map(a => a.id)
        .filter(id => !assignedActionIds.includes(id));
        
      if (missingIds.length === 0) return;

      const inserts = missingIds.map(action_id => ({
        role_id: selectedRole.id,
        action_id
      }));

      const { error } = await supabase.from('seg_role_permissions').insert(inserts);
      if (error) throw error;
      
      setAssignedActionIds(actions.map(a => a.id));
    } catch (err: any) {
      setError(err.message || 'Error al asignar todos los permisos');
    }
  };

  const handleUncheckAll = async () => {
    if (!hasPermission('ROL_UPDATE')) return;
    if (!selectedRole) return;
    try {
      setError(null);
      const { error } = await supabase
        .from('seg_role_permissions')
        .delete()
        .eq('role_id', selectedRole.id);
        
      if (error) throw error;
      setAssignedActionIds([]);
    } catch (err: any) {
      setError(err.message || 'Error al remover todos los permisos');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando matriz de seguridad...</div>;
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
        title="Gestión de Roles y Permisos"
        description="Administra los perfiles de acceso y define con granularidad qué pantallas pueden ver o modificar."
        icon={<Shield />}
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Contenedor Dual Pane */}
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-[500px]">
        
        {/* PANEL IZQUIERDO: ROLES */}
        <div className="md:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 text-lg">Perfiles del Sistema</h2>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            {roles.length === 0 ? (
              <p className="text-slate-500 text-sm text-center my-8">No hay roles creados.</p>
            ) : (
              <ul className="space-y-2">
                {roles.map(role => (
                  <li 
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${
                      selectedRole?.id === role.id 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className={`font-semibold ${selectedRole?.id === role.id ? 'text-blue-700' : 'text-slate-700'}`}>
                        {role.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                        disabled={!hasPermission('ROL_DELETE')}
                        className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${!hasPermission('ROL_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('ROL_DELETE') ? "Sin permiso para eliminar" : "Eliminar Rol"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 ${selectedRole?.id === role.id ? 'text-blue-500' : 'text-slate-400'}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <form onSubmit={handleCreateRole} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Nombre (ej. Cajero)"
                value={newRoleName}
                disabled={!hasPermission('ROL_CREATE')}
                onChange={e => setNewRoleName(e.target.value)}
                className={`flex-1 text-sm rounded-lg py-2 px-3 border outline-none ${!hasPermission('ROL_CREATE') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
              />
              <button 
                type="submit"
                disabled={!newRoleName.trim() || !hasPermission('ROL_CREATE')}
                title={!hasPermission('ROL_CREATE') ? "No tienes permisos para crear roles" : ""}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  !hasPermission('ROL_CREATE') 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: MATRIZ DE PERMISOS */}
        <div className="md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          {!selectedRole ? (
            <EmptyState 
              icon={<ShieldAlert className="w-8 h-8" />}
              title="Selecciona un rol"
              description="Para visualizar y editar su matriz de permisos"
            />
          ) : (
            <>
              <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                  Permisos de: {selectedRole.name}
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleUncheckAll}
                    disabled={!hasPermission('ROL_UPDATE')}
                    title={!hasPermission('ROL_UPDATE') ? "Sin permiso para actualizar" : ""}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors shadow-sm ${
                      !hasPermission('ROL_UPDATE') ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed' : 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                    }`}
                  >
                    Quitar Todos
                  </button>
                  <button 
                    onClick={handleCheckAll}
                    disabled={!hasPermission('ROL_UPDATE')}
                    title={!hasPermission('ROL_UPDATE') ? "Sin permiso para actualizar" : ""}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors shadow-sm ${
                      !hasPermission('ROL_UPDATE') ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed' : 'border-blue-600 text-white bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Marcar Todos
                  </button>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto space-y-8">
                {modules.map(mod => {
                  const modScreens = screens.filter(s => s.module_id === mod.id);
                  if (modScreens.length === 0) return null;

                  return (
                    <div key={mod.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-200/50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                        <DynamicIcon name={mod.icon} className="w-4 h-4 text-slate-500" defaultIcon="Blocks" />
                        <h3 className="font-bold text-slate-700 uppercase tracking-wider text-xs">{mod.name}</h3>
                      </div>
                      
                      <div className="divide-y divide-slate-100">
                        {modScreens.map(screen => {
                          const screenActions = actions.filter(a => a.screen_id === screen.id);
                          if (screenActions.length === 0) return null;

                          return (
                            <div key={screen.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white transition-colors">
                              <div className="sm:w-1/3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                  <DynamicIcon name={screen.icon} className="w-4 h-4" defaultIcon="CircleDot" />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">{screen.name}</p>
                                  <p className="text-xs text-slate-400 font-mono mt-0.5">{screen.route}</p>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-3 flex-1">
                                {screenActions.map(action => {
                                  const isChecked = assignedActionIds.includes(action.id);
                                  return (
                                    <label 
                                      key={action.id} 
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-sm ${
                                        isChecked 
                                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                      }`}
                                    >
                                      <input 
                                        type="checkbox"
                                        className="hidden"
                                        checked={isChecked}
                                        disabled={!hasPermission('ROL_UPDATE')}
                                        onChange={() => togglePermission(action.id)}
                                      />
                                      <div className={`w-4 h-4 rounded flex items-center justify-center ${isChecked ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                        {isChecked && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <span className="font-medium">{action.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {modules.length === 0 && (
                  <p className="text-slate-500 text-center">No hay módulos configurados en el sistema.</p>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

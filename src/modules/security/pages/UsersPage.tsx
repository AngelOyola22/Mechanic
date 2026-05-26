import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../../config/supabase';
import { Users, Plus, Trash2, Shield, AlertCircle, X, Search, Pencil } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';

interface UserDb {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
  role_id?: number;
  role_name?: string;
}

interface RoleDb {
  id: number;
  name: string;
}

export const UsersPage = () => {
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<UserDb[]>([]);
  const [roles, setRoles] = useState<RoleDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: rolesData, error: rolesError } = await supabase.from('seg_roles').select('*');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      const { data: usersData, error: usersError } = await supabase.from('seg_users').select('*').order('id', { ascending: false });
      if (usersError) throw usersError;

      const { data: userRolesData, error: userRolesError } = await supabase.from('seg_user_roles').select('*');
      if (userRolesError) throw userRolesError;

      const combinedUsers = (usersData || []).map(u => {
        const userRole = userRolesData?.find(ur => ur.user_id === u.id);
        const role = rolesData?.find(r => r.id === userRole?.role_id);
        return {
          ...u,
          role_id: role?.id,
          role_name: role?.name || 'Sin Rol Asignado'
        };
      });

      setUsers(combinedUsers);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUserId && !hasPermission('USR_UPDATE')) {
      setError('No tienes permisos para editar usuarios.');
      return;
    }
    if (!editingUserId && !hasPermission('USR_CREATE')) {
      setError('No tienes permisos para crear usuarios.');
      return;
    }

    if (!newFullName || !newEmail || !selectedRoleId) {
      setError('Nombre, Correo y Rol son obligatorios');
      return;
    }

    try {
      setError(null);
      
      if (editingUserId) {
        // --- MODO EDICIÓN ---
        
        // 1. Actualizar datos base del usuario
        const { error: userError } = await supabase
          .from('seg_users')
          .update({ email: newEmail, full_name: newFullName })
          .eq('id', editingUserId);
          
        if (userError) throw userError;

        // 2. Actualizar el rol
        // Primero borramos la asignación anterior (si existe) y luego insertamos la nueva
        // (es más seguro que hacer update por si el usuario no tenía rol previo)
        await supabase.from('seg_user_roles').delete().eq('user_id', editingUserId);
        const { error: roleError } = await supabase
          .from('seg_user_roles')
          .insert([{ user_id: editingUserId, role_id: Number(selectedRoleId) }]);
          
        if (roleError) throw roleError;

      } else {
        // --- MODO CREACIÓN ---
        if (!newPassword) {
          setError('La contraseña es obligatoria para usuarios nuevos');
          return;
        }

        if (!supabaseAdmin) {
          throw new Error('No se ha configurado VITE_SUPABASE_SERVICE_ROLE_KEY para crear usuarios.');
        }

        // 1. Crear en auth.users con Supabase Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: newEmail,
          password: newPassword,
          email_confirm: true // Para que no requiera verificación por correo
        });

        if (authError) throw authError;

        // 2. Insertar en nuestra tabla de negocio vinculando el auth_user_id
        const { data: newUser, error: userError } = await supabase
          .from('seg_users')
          .insert([{ 
            auth_user_id: authData.user.id,
            email: newEmail, 
            full_name: newFullName 
          }])
          .select()
          .single();
          
        if (userError) {
          // Fallback manual en caso de error (idealmente borraríamos el user de auth también)
          throw userError;
        }

        // 3. Asignar Rol
        const { error: roleError } = await supabase
          .from('seg_user_roles')
          .insert([{ user_id: newUser.id, role_id: Number(selectedRoleId) }]);
          
        if (roleError) throw roleError;
      }

      await fetchData();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el usuario.');
    }
  };

  const handleDeleteUser = (id: number) => {
    if (!hasPermission('USR_DELETE')) {
      setError('No tienes permisos para eliminar usuarios.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: '¿Seguro que deseas eliminar este usuario del sistema?',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('seg_users').delete().eq('id', id);
          if (error) throw error;
          setUsers(users.filter(u => u.id !== id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar usuario');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const openModalForCreate = () => {
    setEditingUserId(null);
    setNewFullName('');
    setNewEmail('');
    setNewPassword('');
    setSelectedRoleId('');
    setError(null);
    setIsModalOpen(true);
  };

  const openModalForEdit = (user: UserDb) => {
    setEditingUserId(user.id);
    setNewFullName(user.full_name);
    setNewEmail(user.email);
    setNewPassword(''); // No mostramos la contraseña al editar
    setSelectedRoleId(user.role_id || '');
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>;

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
        title="Gestión de Usuarios"
        description="Administra los accesos, correos y roles del personal."
        icon={<Users />}
        actionButton={{
          label: 'Nuevo Usuario',
          onClick: () => openModalForCreate(),
          disabled: !hasPermission('USR_CREATE'),
          disabledTitle: 'No tienes permisos para crear usuarios',
        }}
      />

      {error && !isModalOpen && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o correo..."
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-72"
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">{users.length} usuarios registrados</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Usuario</th>
                <th className="px-6 py-4 font-semibold">Rol Asignado</th>
                <th className="px-6 py-4 font-semibold">Fecha Registro</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{user.full_name}</p>
                        <p className="text-slate-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      user.role_name === 'Super Admin' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {user.role_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModalForEdit(user)}
                        disabled={!hasPermission('USR_UPDATE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('USR_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={!hasPermission('USR_UPDATE') ? "Sin permiso para editar" : "Editar Usuario"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={!hasPermission('USR_DELETE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('USR_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('USR_DELETE') ? "Sin permiso para eliminar" : "Eliminar Usuario"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState 
                      icon={<Users className="w-8 h-8" />}
                      title="No hay usuarios registrados"
                      description="No se encontraron usuarios en el sistema."
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
        title={editingUserId ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveUser} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 border outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 border outline-none"
                  placeholder="juan@empresa.com"
                />
              </div>
              
              {!editingUserId && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña Inicial</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 border outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <p className="text-xs text-slate-500 mt-1">El usuario podrá cambiarla después.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Asignar Rol</label>
                <select 
                  value={selectedRoleId}
                  onChange={e => setSelectedRoleId(Number(e.target.value))}
                  className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 border outline-none bg-white"
                >
                  <option value="" disabled>Selecciona un perfil...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
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
                  {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

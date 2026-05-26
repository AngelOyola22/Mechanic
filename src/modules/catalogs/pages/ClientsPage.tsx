import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { Users, Plus, Search, Trash2, Pencil, AlertCircle, X, Check, Building2, User } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';

interface ClientDb {
  id: number;
  document_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export const ClientsPage = () => {
  const { hasPermission } = usePermissions();
  const [clients, setClients] = useState<ClientDb[]>([]);
  
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
  const [documentId, setDocumentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cat_clients')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar permisos antes de procesar
    if (editingId && !hasPermission('CLI_UPDATE')) {
      setError('No tienes permisos para editar clientes.');
      return;
    }
    if (!editingId && !hasPermission('CLI_CREATE')) {
      setError('No tienes permisos para crear clientes.');
      return;
    }

    if (!documentId || !name) {
      setError('El Documento de Identidad y Nombre son obligatorios');
      return;
    }

    try {
      setError(null);
      
      const payload = {
        document_id: documentId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
      };

      if (editingId) {
        const { error } = await supabase.from('cat_clients').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cat_clients').insert([payload]);
        if (error) throw error;
      }

      await fetchClients();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente');
    }
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('CLI_DELETE')) {
      setError('No tienes permisos para eliminar clientes.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Cliente',
      message: '¿Seguro que deseas eliminar este cliente?',
      onConfirm: async () => {
        try {
          setError(null);
          const { error } = await supabase.from('cat_clients').delete().eq('id', id);
          if (error) throw error;
          setClients(clients.filter(c => c.id !== id));
        } catch (err: any) {
          setError(err.message || 'Error al eliminar cliente');
        }
      }
    });
  };

  const openModal = (client?: ClientDb) => {
    setError(null);
    if (client) {
      setEditingId(client.id);
      setDocumentId(client.document_id);
      setName(client.name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
    } else {
      setEditingId(null);
      setDocumentId('');
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.document_id.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando catálogo de clientes...</div>;

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
        title="Catálogo de Clientes"
        description="Gestiona la base de datos de personas y empresas."
        icon={<Users />}
        actionButton={{
          label: 'Nuevo Cliente',
          onClick: () => openModal(),
          disabled: !hasPermission('CLI_CREATE'),
          disabledTitle: 'No tienes permisos para crear clientes',
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
              placeholder="Buscar por cédula/RUC o nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-80"
            />
          </div>
          <p className="text-sm text-slate-500 font-medium">{filteredClients.length} clientes encontrados</p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Cédula / RUC</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        client.document_id.length > 10 ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {client.document_id.length > 10 ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{client.name}</p>
                        <p className="text-slate-500 text-xs truncate max-wxs">{client.address || 'Sin dirección'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{client.document_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-700">{client.email || '-'}</p>
                    <p className="text-slate-500 text-xs">{client.phone || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModal(client)}
                        disabled={!hasPermission('CLI_UPDATE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('CLI_UPDATE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={!hasPermission('CLI_UPDATE') ? "Sin permiso para editar" : "Editar Cliente"}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(client.id)}
                        disabled={!hasPermission('CLI_DELETE')}
                        className={`p-2 rounded-lg transition-colors ${!hasPermission('CLI_DELETE') ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                        title={!hasPermission('CLI_DELETE') ? "Sin permiso para eliminar" : "Eliminar Cliente"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState 
                      icon={<Users className="w-8 h-8" />}
                      title="No se encontraron clientes"
                      description="Intenta con otro término de búsqueda o registra un nuevo cliente."
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
        title={editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cédula o RUC *</label>
                  <input 
                    type="text" 
                    value={documentId}
                    onChange={e => setDocumentId(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="Ej. 0912345678"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Razón Social / Nombres *</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="correo@empresa.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none"
                    placeholder="099..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección</label>
                  <textarea 
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2 px-4 border outline-none resize-none"
                    placeholder="Dirección completa..."
                    rows={2}
                  />
                </div>
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
                  {editingId ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

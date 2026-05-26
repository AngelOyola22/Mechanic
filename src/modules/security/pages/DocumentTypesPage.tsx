import React, { useEffect, useState } from 'react';
import { supabase } from '../../../config/supabase';
import { FileText, Plus, Trash2, Pencil, Search, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../../context/AuthContext';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

interface DocumentTypeDb {
  id: number;
  name: string;
  prefix: string;
  establishment: string;
  emission_point: string;
  current_sequence: number;
  is_active: boolean;
}

export const DocumentTypesPage = () => {
  const { hasPermission } = usePermissions();
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    prefix: '', 
    establishment: '001', 
    emission_point: '001', 
    current_sequence: 0, 
    is_active: true 
  });
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('sys_document_types').select('*').order('name');
      if (error) throw error;
      setDocumentTypes(data || []);
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
        const { error } = await supabase.from('sys_document_types').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sys_document_types').insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchDocumentTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Tipo de Documento',
      message: '¿Estás seguro de que deseas eliminar este tipo de documento? Podría afectar las transacciones si ya se ha utilizado.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('sys_document_types').delete().eq('id', id);
          if (error) throw error;
          fetchDocumentTypes();
        } catch (err: any) {
          setError(err.message);
        }
      }
    });
  };

  const openModal = (docType?: DocumentTypeDb) => {
    if (docType) {
      setEditingId(docType.id);
      setFormData({ 
        name: docType.name, 
        prefix: docType.prefix, 
        establishment: docType.establishment, 
        emission_point: docType.emission_point, 
        current_sequence: docType.current_sequence, 
        is_active: docType.is_active 
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        prefix: '', 
        establishment: '001', 
        emission_point: '001', 
        current_sequence: 0, 
        is_active: true 
      });
    }
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando tipos de documentos...</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader 
        title="Tipos de Documentos y Secuenciales"
        description="Configura los tipos de documentos y sus numeraciones automáticas (Facturas, Recibos, etc.)."
        icon={<FileText />}
        actionButton={
          hasPermission('DOC_CREATE') ? {
            label: 'Nuevo Documento',
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

      {documentTypes.length === 0 && !loading && !error ? (
        <EmptyState 
          icon={<FileText className="w-8 h-8" />}
          title="No hay tipos de documentos"
          description="Comienza creando la primera configuración de documentos."
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-semibold w-16">ID</th>
                  <th className="p-4 font-semibold">Documento</th>
                  <th className="p-4 font-semibold text-center">Prefijo</th>
                  <th className="p-4 font-semibold text-center">Establecimiento</th>
                  <th className="p-4 font-semibold text-center">Secuencia Actual</th>
                  <th className="p-4 font-semibold text-center">Ejemplo</th>
                  <th className="p-4 font-semibold w-32 text-center">Estado</th>
                  <th className="p-4 font-semibold w-32 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentTypes.map(doc => {
                  const exampleNumber = `${doc.prefix}-${doc.establishment}-${doc.emission_point}-${String(doc.current_sequence + 1).padStart(9, '0')}`;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-slate-400 font-mono text-sm">{doc.id}</td>
                      <td className="p-4 font-bold text-slate-800">{doc.name}</td>
                      <td className="p-4 text-center font-mono font-medium text-slate-600">{doc.prefix}</td>
                      <td className="p-4 text-center font-mono text-slate-500">{doc.establishment}-{doc.emission_point}</td>
                      <td className="p-4 text-center font-mono font-bold text-blue-600">{doc.current_sequence}</td>
                      <td className="p-4 text-center">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{exampleNumber}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${doc.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {doc.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {hasPermission('DOC_UPDATE') && (
                            <button onClick={() => openModal(doc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('DOC_DELETE') && (
                            <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Documento' : 'Nuevo Documento'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nombre (Ej. Factura, Recibo)</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Prefijo</label>
                  <input 
                    type="text" 
                    required
                    maxLength={10}
                    value={formData.prefix}
                    onChange={e => setFormData({...formData, prefix: e.target.value.toUpperCase()})}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
                    placeholder="FAC"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Estab.</label>
                  <input 
                    type="text" 
                    required
                    maxLength={3}
                    value={formData.establishment}
                    onChange={e => setFormData({...formData, establishment: e.target.value.padStart(3, '0')})}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-center"
                    placeholder="001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Pto. Emis.</label>
                  <input 
                    type="text" 
                    required
                    maxLength={3}
                    value={formData.emission_point}
                    onChange={e => setFormData({...formData, emission_point: e.target.value.padStart(3, '0')})}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-center"
                    placeholder="001"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Secuencia Actual (0 = iniciará en 1)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={formData.current_sequence}
                  onChange={e => setFormData({...formData, current_sequence: Number(e.target.value)})}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
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
                  Activo
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

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 flex gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
            <p className="text-sm text-slate-500">{message}</p>
          </div>
        </div>
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors font-medium text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors font-medium text-sm shadow-sm shadow-red-600/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

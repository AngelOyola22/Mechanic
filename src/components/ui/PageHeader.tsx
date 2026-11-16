import React, { ReactNode } from 'react';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionButton?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    disabledTitle?: string;
    icon?: ReactNode;
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  actionButton,
}) => {
  return (
    <div className="flex justify-between items-end">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {icon && <span className="text-blue-600">{icon}</span>}
          {title}
        </h1>
        {description && <p className="text-slate-500 mt-1">{description}</p>}
      </div>
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          disabled={actionButton.disabled}
          title={actionButton.disabled ? actionButton.disabledTitle : ''}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm font-medium ${
            actionButton.disabled
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
          }`}
        >
          {actionButton.icon || <Plus className="w-5 h-5" />}
          {actionButton.label}
        </button>
      )}
    </div>
  );
};

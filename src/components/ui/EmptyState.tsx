import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl m-4">
      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300 mb-4">
        {icon}
      </div>
      <p className="text-lg font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm text-slate-500">{description}</p>}
    </div>
  );
};

import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-[0%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]" />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <Outlet />
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, 
  ChevronRight, 
  Menu,
  Wrench
} from 'lucide-react';
import { DynamicIcon } from '../components/ui/DynamicIcon';
import { supabase } from '../config/supabase';



export const MainLayout = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [companySettings, setCompanySettings] = useState<{company_name: string, logo_url: string} | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      supabase.from('sys_settings').select('company_name, logo_url').single().then(({ data }) => {
        if (data) setCompanySettings(data);
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Dinámico basado en BD */}
      <aside 
        className={`bg-slate-900 text-white shadow-xl z-10 hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div className={`flex items-center mb-10 p-6 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 min-w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden">
              {companySettings?.logo_url ? (
                <img src={companySettings.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Wrench className="w-5 h-5 text-white" />
              )}
            </div>
            {!isCollapsed && <h2 className="text-xl font-bold text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{companySettings?.company_name || 'Mechanic'}</h2>}
          </div>
        </div>

        {/* Botón para colapsar */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-7 right-[-12px] bg-slate-800 p-1.5 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors z-20"
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav className="flex-1 space-y-6 px-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Módulos Dinámicos desde el Backend */}
          {user?.modules.map((module) => (
            <div key={module.id} className="space-y-2">
              {!isCollapsed ? (
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-3 mb-2 flex items-center gap-1.5">
                  <DynamicIcon name={module.icon} className="w-4 h-4" defaultIcon="Blocks" />
                  {module.name}
                </h3>
              ) : (
                <div className="flex justify-center mb-2 text-slate-500" title={module.name}>
                  <DynamicIcon name={module.icon} className="w-4 h-4" defaultIcon="Blocks" />
                </div>
              )}
              
              <div className="space-y-1">
                {module.screens.map((screen) => {
                  const isActive = location.pathname.startsWith(screen.route);
                  return (
                    <Link
                      key={screen.id}
                      to={screen.route}
                      title={isCollapsed ? screen.name : undefined}
                      className={`flex items-center px-3 py-2 rounded-xl transition-all duration-200 group ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                    >
                      <div className="flex items-center gap-3">
                        <DynamicIcon name={screen.icon} className="w-5 h-5" defaultIcon="CircleDot" />
                        {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{screen.name}</span>}
                      </div>
                      {!isCollapsed && (
                        <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="border-t border-slate-800 pt-6 mt-6 p-4">
          {!isCollapsed && (
            <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">Usuario Activo</p>
              <p className="text-sm font-bold text-white truncate">{user?.fullName}</p>
            </div>
          )}
          <button 
            onClick={logout}
            title={isCollapsed ? "Cerrar Sesión" : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 font-medium hover:bg-red-950/30 hover:text-red-300 transition-colors border border-transparent hover:border-red-900/50 ${
              isCollapsed ? 'justify-center' : 'justify-center'
            }`}
          >
            <LogOut className="w-5 h-5 min-w-5" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white p-4 shadow-sm flex justify-between items-center md:hidden border-b border-slate-200">
          <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
            {companySettings?.logo_url ? (
              <img src={companySettings.logo_url} alt="Logo" className="w-8 h-8 rounded-md object-cover" />
            ) : (
              <Wrench className="w-5 h-5 text-blue-600" />
            )}
            {companySettings?.company_name || 'Mechanic'}
          </h2>
          <button onClick={logout} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

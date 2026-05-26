import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { useAuth } from '../context/AuthContext';
import { Wrench } from 'lucide-react';

// Importando las pantallas reales de los módulos
import { UsersPage } from '../modules/security/pages/UsersPage';
import { RolesPage } from '../modules/security/pages/RolesPage';
import { ModulesPage } from '../modules/security/pages/ModulesPage';
import { SettingsPage } from '../modules/security/pages/SettingsPage';
import { DocumentTypesPage } from '../modules/security/pages/DocumentTypesPage';
import { ClientsPage } from '../modules/catalogs/pages/ClientsPage';
import { ProductsPage } from '../modules/catalogs/pages/ProductsPage';
import { VehicleBrandsPage } from '../modules/catalogs/pages/VehicleBrandsPage';
import { VehicleModelsPage } from '../modules/catalogs/pages/VehicleModelsPage';
import { PartsBrandsPage } from '../modules/catalogs/pages/PartsBrandsPage';
import { MeasurementUnitsPage } from '../modules/catalogs/pages/MeasurementUnitsPage';
import { SalesPage } from '../modules/transactions/pages/SalesPage';
import { PurchasesPage } from '../modules/transactions/pages/PurchasesPage';
import { KardexPage } from '../modules/transactions/pages/KardexPage';
import { WarehousesPage } from '../modules/catalogs/pages/WarehousesPage';
import { BranchesPage } from '../modules/catalogs/pages/BranchesPage';
import { StockReportPage } from '../modules/transactions/pages/StockReportPage';

// Placeholder Dashboard Component
const DashboardPlaceholder = () => (
  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-[60vh] flex flex-col items-center justify-center text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
      <Wrench className="w-8 h-8 text-slate-400" />
    </div>
    <h1 className="text-3xl font-bold text-slate-800 mb-4">Bienvenido a Mechanic</h1>
    <p className="text-slate-500 max-w-md">Selecciona un módulo en el menú lateral para comenzar. Desde aquí podrás gestionar catálogos, transacciones y la seguridad del sistema.</p>
  </div>
);

// Fallback por si la base de datos envía una ruta que aún no hemos programado
const GenericScreenPlaceholder = ({ route }: { route: string }) => (
  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 min-h-[50vh] flex flex-col items-center justify-center">
    <h2 className="text-2xl font-bold text-slate-800 mb-2">Pantalla en construcción</h2>
    <p className="text-slate-500">La ruta solicitada ({route}) aún no tiene un componente React asignado.</p>
  </div>
);

// Diccionario que mapea la ruta de la base de datos con el componente físico
const COMPONENT_REGISTRY: Record<string, React.ReactNode> = {
  '/security/users': <UsersPage />,
  '/security/roles': <RolesPage />,
  '/security/modules': <ModulesPage />,
  '/security/settings': <SettingsPage />,
  '/security/documents': <DocumentTypesPage />,
  '/catalogs/clients': <ClientsPage />,
  '/catalogs/products': <ProductsPage />,
  '/catalogs/vehicle-brands': <VehicleBrandsPage />,
  '/catalogs/vehicle-models': <VehicleModelsPage />,
  '/catalogs/parts-brands': <PartsBrandsPage />,
  '/catalogs/measurement-units': <MeasurementUnitsPage />,
  '/transactions/sales': <SalesPage />,
  '/transactions/purchases': <PurchasesPage />,
  '/transactions/kardex': <KardexPage />,
  '/catalogs/warehouses': <WarehousesPage />,
  '/catalogs/branches': <BranchesPage />,
  '/transactions/stock': <StockReportPage />,
};

export const AppRouter = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas / Auth */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="" element={<Navigate to="login" replace />} />
        </Route>

        {/* Rutas Privadas / Main */}
        <Route path="/*" element={<MainLayout />}>
          <Route index element={<DashboardPlaceholder />} />
          
          {/* RUTEADOR DINÁMICO: 
              - Lee las pantallas a las que el usuario tiene acceso
              - Busca el componente en el COMPONENT_REGISTRY
              - Si no lo encuentra, pinta el Placeholder
          */}
          {user?.modules.map(module => 
            module.screens.map(screen => {
              const path = screen.route.replace(/^\//, ''); // Quita el slash inicial
              const Component = COMPONENT_REGISTRY[screen.route] || <GenericScreenPlaceholder route={screen.route} />;
              
              return (
                <Route 
                  key={screen.id} 
                  path={path} 
                  element={Component} 
                />
              );
            })
          )}
          
          {/* Redirigir cualquier otra ruta no encontrada al dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

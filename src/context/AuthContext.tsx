import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../config/supabase';

export interface Screen {
  id: number;
  name: string;
  route: string;
  icon?: string | null;
  actions: string[];
}

export interface Module {
  id: number;
  name: string;
  icon?: string | null;
  screens: Screen[];
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  modules: Module[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Al cargar la app, revisamos si hay una sesión activa en Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    // Escuchamos cambios de estado (si el token expira, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (authUserId: string, email: string) => {
    try {
      // 1. Buscamos el usuario en tu tabla `seg_users` por el auth_user_id de Supabase
      const { data: dbUser, error: userError } = await supabase
        .from('seg_users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (userError || !dbUser) throw new Error('Usuario no encontrado en la base de datos');

      // 2. Llamada RPC a la base de datos para traer módulos, pantallas y acciones exactas del usuario
      const { data: modules, error: rpcError } = await supabase.rpc('get_user_modules', { p_user_id: dbUser.id });
      
      if (rpcError) {
        console.error("Error RPC:", rpcError);
        throw new Error('Error al calcular los permisos de seguridad.');
      }

      const userModules: Module[] = modules || [];

      setUser({
        id: dbUser.id,
        email: email,
        fullName: dbUser.full_name,
        modules: userModules
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Opcional: forzar cierre de sesión si el usuario no existe en seg_users o hay error
      // supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      setLoading(true);
      await fetchUserData(data.user.id, data.user.email!);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      login, 
      logout,
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Helper Hook para Validar Permisos (Botones) ---
export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasPermission = (actionCode: string) => {
    if (!user || !user.modules) return false;
    for (const mod of user.modules) {
      if (!mod.screens) continue;
      for (const screen of mod.screens) {
        if (screen.actions && screen.actions.includes(actionCode)) {
          return true;
        }
      }
    }
    return false;
  };
  
  return { hasPermission };
};

import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Wrench, ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirigir si ya está autenticado
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      try {
        setError('');
        setLoading(true);
        await login(email, password);
        // Al tener éxito, redirigimos al inicio
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error("Login Error capturado:", err);
        
        // Supabase puede devolver el error de distintas formas
        const errorText = (err.message || '').toLowerCase();
        const status = err.status || 0;
        
        if (status === 400 || errorText.includes('invalid') || errorText.includes('credential')) {
          setError('Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.');
        } else if (errorText.includes('email not confirmed')) {
          setError('Por favor, confirma tu correo electrónico antes de iniciar sesión.');
        } else if (errorText.includes('fetch') || status === 0) {
          setError('Error de conexión. Revisa tu internet o intenta más tarde.');
        } else {
          setError(`Error: ${err.message || 'Ocurrió un problema desconocido.'}`);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/50">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
          <Wrench className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Mechanic</h1>
        <p className="text-slate-400 mt-2 text-sm">Ingresa a tu cuenta para continuar</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Correo Electrónico</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg leading-5 bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              placeholder="tu@email.com"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">Contraseña</label>
            <a href="#" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg leading-5 bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-all duration-300 group disabled:opacity-80 disabled:cursor-wait"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            <>
              Iniciar Sesión
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

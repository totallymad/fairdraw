import { Link, useLocation } from 'react-router-dom';
import { useDrawStore } from '../store/drawStore';
import { Shuffle, LogIn, LogOut, Plus } from 'lucide-react';

export function Header() {
  const { isAuthenticated, logout } = useDrawStore();
  const location = useLocation();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-800 hover:text-indigo-600 transition-colors">
            <Shuffle className="w-6 h-6 text-indigo-600" />
            <span>FairDraw</span>
          </Link>
          
          <nav className="flex items-center gap-3">
            {location.pathname === '/' && isAuthenticated && (
              <Link
                to="/create"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Новый розыгрыш
              </Link>
            )}
            
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors text-sm"
              >
                <LogIn className="w-4 h-4" />
                Войти
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

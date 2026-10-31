import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrawStore } from '../store/drawStore';
import { Lock, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useDrawStore();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    if (success) {
      navigate('/');
    } else {
      setError('Неверный пароль. Минимум 4 символа.');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-20">
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 mb-3">
            <Lock className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Вход в FairDraw</h1>
          <p className="text-sm text-slate-500 mt-1">Введите пароль администратора</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Введите пароль"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            Войти
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          В демо-режиме подойдёт любой пароль от 4 символов
        </p>
      </div>
    </div>
  );
}

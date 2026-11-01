import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDrawStore } from '../store/drawStore';
import { Users, Trophy, Clock, ChevronRight, Shuffle, Loader2 } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-amber-100 text-amber-700' },
  finalized: { label: 'Ожидание', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Завершён', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Ошибка', color: 'bg-red-100 text-red-700' },
};

export function HomePage() {
  const { draws, isAuthenticated, isLoading, loadDraws } = useDrawStore();

  useEffect(() => {
    // Загружаем розыгрыши для всех пользователей
    loadDraws();
  }, [loadDraws]);

  // Для неавторизованных показываем только завершённые розыгрыши
  const visibleDraws = isAuthenticated 
    ? draws 
    : draws.filter(d => d.status === 'completed');

  const sortedDraws = [...visibleDraws].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 mb-6">
          <Shuffle className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 mb-3">
          Прозрачные розыгрыши
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          FairDraw проводит честные и проверяемые розыгрыши с использованием 
          криптографически безопасного генератора случайных чисел.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      )}

      {/* Draws List */}
      {!isLoading && sortedDraws.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-4">
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-medium text-slate-600 mb-2">
            Пока нет розыгрышей
          </h3>
          <p className="text-slate-400 mb-6">
            {isAuthenticated 
              ? 'Создайте первый розыгрыш, чтобы начать' 
              : 'Войдите, чтобы создать розыгрыш'}
          </p>
          {isAuthenticated && (
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
            >
              Создать розыгрыш
            </Link>
          )}
        </div>
      ) : !isLoading && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-800">
            Все розыгрыши ({sortedDraws.length})
          </h2>
          <div className="grid gap-4">
            {sortedDraws.map(draw => {
              const status = statusLabels[draw.status];
              const winner = draw.winner_id 
                ? draw.participants.find(p => p.id === draw.winner_id)
                : null;
              
              return (
                <Link
                  key={draw.id}
                  to={isAuthenticated ? `/draw/${draw.id}` : `/public/${draw.id}`}
                  className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800 truncate">
                          {draw.title}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {draw.description && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                          {draw.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {draw.participants.length} участников
                        </span>
                        {winner && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Trophy className="w-3.5 h-3.5" />
                            {winner.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(draw.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDrawStore } from '../store/drawStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, Users, Trophy, Lock, Play, Copy, Download,
  ExternalLink, CheckCircle, AlertCircle, Clock, Hash,
  ChevronDown, ChevronUp, Trash2, Plus, Shield, Loader2
} from 'lucide-react';

export function DrawDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDraw, addParticipant, removeParticipant, finalizeDraw, executeDraw, isAuthenticated, loadDraw, isLoading, error, setError } = useDrawStore();
  
  const draw = getDraw(id || '');

  const [newName, setNewName] = useState('');
  const [newVkUrl, setNewVkUrl] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (id) {
      loadDraw(id).then(() => setIsLoaded(true));
    }
  }, [id, loadDraw]);

  if (!isLoaded || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!draw) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Розыгрыш не найден</h1>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          На главную
        </button>
      </div>
    );
  }

  const winner = draw.winner_id ? draw.participants.find(p => p.id === draw.winner_id) : null;
  const publicUrl = `${window.location.origin}/#/public/${draw.id}`;

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addParticipant(draw.id, newName.trim(), newVkUrl.trim() || undefined);
    setNewName('');
    setNewVkUrl('');
  };

  const handleFinalize = async () => {
    if (draw.participants.length < 2) {
      setError('Минимум 2 участника для розыгрыша');
      return;
    }
    try {
      await finalizeDraw(draw.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка фиксации');
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await executeDraw(draw.id);
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
        });
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при получении случайности');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const data = {
      draw_id: draw.id,
      title: draw.title,
      description: draw.description,
      status: draw.status,
      participants: draw.participants.map(p => ({
        name: p.name,
        vk_url: p.vk_url || null,
        position: p.position,
      })),
      participants_hash: draw.participants_hash,
      drand_chain_hash: draw.drand_chain_hash,
      drand_round: draw.drand_round,
      randomness: draw.randomness,
      signature: draw.signature,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        position: winner.position,
      } : null,
      created_at: draw.created_at,
      finalized_at: draw.finalized_at,
      completed_at: draw.completed_at,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairdraw-${draw.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canEdit = draw.status === 'draft' && isAuthenticated;
  const canFinalize = draw.status === 'draft' && isAuthenticated && draw.participants.length >= 2;
  const canExecute = draw.status === 'finalized' && isAuthenticated;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к списку
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Draw Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">{draw.title}</h1>
            {draw.description && (
              <p className="text-slate-500">{draw.description}</p>
            )}
          </div>
          <StatusBadge status={draw.status} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {draw.participants.length} участников
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(draw.created_at).toLocaleString('ru-RU')}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </button>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать JSON
          </button>
          <Link
            to={`/public/${draw.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Публичная страница
          </Link>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Участники
          </h2>
          {canEdit && (
            <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              Режим редактирования
            </span>
          )}
        </div>

        {canEdit && (
          <form onSubmit={handleAddParticipant} className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Имя участника"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                maxLength={100}
                required
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <input
              type="url"
              value={newVkUrl}
              onChange={e => setNewVkUrl(e.target.value)}
              placeholder="Ссылка на VK (необязательно)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              maxLength={500}
            />
          </form>
        )}

        {draw.participants.length === 0 ? (
          <p className="text-center text-slate-400 py-8">
            {canEdit ? 'Добавьте участников для начала розыгрыша' : 'Нет участников'}
          </p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {draw.participants.map((p, index) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    winner?.id === p.id 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {p.position}
                    </span>
                    <div>
                      <span className="font-medium text-slate-700">{p.name}</span>
                      {winner?.id === p.id && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <Trophy className="w-3 h-3" />
                          Победитель
                        </span>
                      )}
                      {p.vk_url && (
                        <a
                          href={p.vk_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-indigo-500 hover:text-indigo-700"
                        >
                          VK ↗
                        </a>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeParticipant(draw.id, p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {canFinalize && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleFinalize}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium"
            >
              <Lock className="w-4 h-4" />
              Зафиксировать список
            </button>
            <p className="mt-2 text-xs text-slate-400">
              После фиксации список участников нельзя будет изменить
            </p>
          </div>
        )}
      </div>

      {/* Drand Round / Execute */}
      {draw.status === 'finalized' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Ожидание раунда drand
          </h2>
          <div className="space-y-2 text-sm text-slate-600 mb-4">
            <p>Раунд: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">{draw.drand_round}</code></p>
            <p>Хеш списка: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs break-all">{draw.participants_hash}</code></p>
          </div>
          {canExecute && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
            >
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isExecuting ? 'Получение случайности...' : 'Провести розыгрыш'}
            </button>
          )}
        </div>
      )}

      {/* Winner */}
      {draw.status === 'completed' && winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-6 text-center"
        >
          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Победитель: {winner.name}
          </h2>
          <p className="text-slate-500">
            Позиция #{winner.position} из {draw.participants.length}
          </p>
          {winner.vk_url && (
            <a
              href={winner.vk_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-800 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Профиль VK
            </a>
          )}
        </motion.div>
      )}

      {/* Verification Data */}
      {draw.status === 'completed' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <button
            onClick={() => setShowVerification(!showVerification)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Hash className="w-5 h-5 text-slate-400" />
              Данные верификации
            </h2>
            {showVerification ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          <AnimatePresence>
            {showVerification && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3 text-sm">
                  <VerificationRow label="ID розыгрыша" value={draw.id} />
                  <VerificationRow label="Хеш списка участников" value={draw.participants_hash || ''} mono />
                  <VerificationRow label="Хеш цепочки drand" value={draw.drand_chain_hash || ''} mono />
                  <VerificationRow label="Раунд drand" value={String(draw.drand_round || '')} />
                  <VerificationRow label="Случайность (randomness)" value={draw.randomness || ''} mono />
                  <VerificationRow label="Подпись (signature)" value={draw.signature || ''} mono />
                  <VerificationRow label="Победитель" value={winner ? `${winner.name} (позиция #${winner.position})` : ''} />
                  <VerificationRow label="Всего участников" value={String(draw.participants.length)} />
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-slate-500 text-xs">
                      Метод верификации: SHA-256 хеш канонического представления списка → 
                      drand randomness → rejection sampling без modulo bias
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Failed status */}
      {draw.status === 'failed' && (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-700 mb-1">Ошибка розыгрыша</h2>
          <p className="text-red-500 text-sm">
            Не удалось получить или верифицировать случайность drand.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: 'Черновик', color: 'bg-amber-100 text-amber-700' },
    finalized: { label: 'Ожидание', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Завершён', color: 'bg-green-100 text-green-700' },
    failed: { label: 'Ошибка', color: 'bg-red-100 text-red-700' },
  };
  const { label, color } = config[status] || config.draft;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function VerificationRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <span className="text-slate-500 min-w-[180px] flex-shrink-0">{label}:</span>
      <span className={`${mono ? 'font-mono text-xs break-all bg-slate-50 px-2 py-1 rounded' : ''} text-slate-700`}>
        {value}
      </span>
    </div>
  );
}

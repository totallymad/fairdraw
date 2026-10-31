import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDrawStore } from '../store/drawStore';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import {
  ArrowLeft, Users, Trophy, Copy, Download, ExternalLink,
  CheckCircle, Clock, Hash, ChevronDown, ChevronUp, Shield, Loader2
} from 'lucide-react';
import type { Draw } from '../types';

export function PublicDrawPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [draw, setDraw] = useState<Draw | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      api.getDraw(id)
        .then(data => setDraw(data))
        .catch(err => console.error('Load error:', err))
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  if (isLoading) {
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
        <p className="text-slate-500 mb-6">Возможно, он был удалён или ссылка неверна</p>
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
      verification: {
        method: 'SHA-256 + drand Quicknet + rejection sampling',
        chain_hash: draw.drand_chain_hash,
        round: draw.drand_round,
        participants_hash: draw.participants_hash,
        randomness: draw.randomness,
        signature: draw.signature,
        total_participants: draw.participants.length,
        winner_position: winner?.position,
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairdraw-verify-${draw.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Черновик', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '📝' },
    finalized: { label: 'Ожидание раунда drand', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '⏳' },
    completed: { label: 'Завершён', color: 'bg-green-100 text-green-700 border-green-200', icon: '✅' },
    failed: { label: 'Ошибка', color: 'bg-red-100 text-red-700 border-red-200', icon: '❌' },
  };

  const status = statusLabels[draw.status] || statusLabels.draft;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Public badge */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4" />
        <span>Публичная страница розыгрыша</span>
      </div>

      {/* Draw Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">{draw.title}</h1>
            {draw.description && (
              <p className="text-slate-500">{draw.description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {draw.participants.length} участников
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(draw.created_at).toLocaleString('ru-RU')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </button>
          {draw.status === 'completed' && (
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать данные проверки
            </button>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Участники ({draw.participants.length})
        </h2>

        {draw.participants.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Нет участников</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {draw.participants.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  winner?.id === p.id
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                  {p.position}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-700 text-sm truncate block">{p.name}</span>
                  {p.vk_url && (
                    <a
                      href={p.vk_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      VK
                    </a>
                  )}
                </div>
                {winner?.id === p.id && (
                  <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Winner */}
      {draw.status === 'completed' && winner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-200 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          </motion.div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {winner.name}
          </h2>
          <p className="text-slate-500 mb-1">
            Победитель розыгрыша
          </p>
          <p className="text-sm text-slate-400">
            Позиция #{winner.position} из {draw.participants.length}
          </p>
          {winner.vk_url && (
            <a
              href={winner.vk_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-white border border-indigo-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть профиль VK
            </a>
          )}
        </motion.div>
      )}

      {/* Hash info */}
      {draw.participants_hash && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Hash className="w-5 h-5 text-slate-400" />
            Хеш списка участников
          </h2>
          <code className="block text-xs bg-slate-50 p-3 rounded-xl text-slate-600 break-all font-mono">
            {draw.participants_hash}
          </code>
          <p className="mt-2 text-xs text-slate-400">
            SHA-256 хеш канонического представления списка. Используется для привязки к randomness drand.
          </p>
        </div>
      )}

      {/* Verification Data */}
      {draw.status === 'completed' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <button
            onClick={() => setShowVerification(!showVerification)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              Данные для проверки результата
            </h2>
            {showVerification ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showVerification && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3 text-sm">
                <VRow label="ID розыгрыша" value={draw.id} />
                <VRow label="Хеш списка" value={draw.participants_hash || ''} mono />
                <VRow label="Цепочка drand" value={draw.drand_chain_hash || ''} mono />
                <VRow label="Раунд" value={String(draw.drand_round || '')} />
                <VRow label="Randomness" value={draw.randomness || ''} mono />
                <VRow label="Signature" value={draw.signature || ''} mono />
                <VRow label="Победитель" value={winner ? `${winner.name} (#${winner.position})` : ''} />
                <VRow label="Участников" value={String(draw.participants.length)} />
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    <strong>Как проверить:</strong> Вычислите SHA-256 хеш канонического JSON списка участников. 
                    Убедитесь, что randomness получена из drand API для указанного раунда и цепочки. 
                    Проверьте BLS-подпись. Победитель определяется через rejection sampling: 
                    первые 8 hex-символов randomness → число → mod количество_участников.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Back link */}
      <div className="text-center pt-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 mx-auto text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}

function VRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <span className="text-slate-500 min-w-[150px] flex-shrink-0">{label}:</span>
      <span className={`${mono ? 'font-mono text-xs break-all bg-slate-50 px-2 py-1 rounded' : ''} text-slate-700`}>
        {value}
      </span>
    </div>
  );
}

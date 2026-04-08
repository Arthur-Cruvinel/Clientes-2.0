import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  mensagem: string;
  tipo?: 'sucesso' | 'erro';
  duracao?: number;
  onFechar: () => void;
}

export function Toast({ mensagem, tipo = 'sucesso', duracao = 3000, onFechar }: ToastProps) {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisivel(false);
      setTimeout(onFechar, 300);
    }, duracao);
    return () => clearTimeout(timer);
  }, [duracao, onFechar]);

  const Icon = tipo === 'sucesso' ? CheckCircle : AlertCircle;
  const cor = tipo === 'sucesso' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg transition-opacity duration-300 ${cor} ${visivel ? 'opacity-100' : 'opacity-0'}`}>
      <Icon size={18} />
      <span className="text-sm font-medium">{mensagem}</span>
      <button onClick={onFechar} className="ml-2 opacity-60 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}

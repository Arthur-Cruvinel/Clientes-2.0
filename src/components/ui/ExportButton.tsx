// --- ExportButton ---
// Botão discreto com dropdown para exportar Excel ou PDF.

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
  loading?: boolean;
  label?: string;
  variant?: 'light' | 'dark';
}

export function ExportButton({
  onExportExcel,
  onExportPdf,
  loading = false,
  label = 'Exportar',
  variant = 'light',
}: ExportButtonProps) {
  const isDark = variant === 'dark';
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [aberto]);

  return (
    <div ref={ref} className="relative inline-block">
      {/* Botão principal */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={loading}
        className={
          isDark
            ? 'flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2 transition-all duration-150 disabled:opacity-60'
            : 'flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition-all duration-150 disabled:opacity-60'
        }
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" style={{ color: isDark ? '#ffffff' : '#6b6b8a' }} />
        ) : (
          <Download size={15} style={{ color: isDark ? '#ffffff' : '#6b6b8a' }} />
        )}
        <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#374151' }}>
          {label}
        </span>
        <ChevronDown size={12} style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#9ca3af' }} />
      </button>

      {/* Dropdown */}
      {aberto && (
        <div
          className="absolute right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1"
          style={{ width: 192, zIndex: 50 }}
        >
          {/* Excel */}
          <button
            type="button"
            onClick={() => { onExportExcel(); setAberto(false); }}
            className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-green-50 transition-colors"
          >
            <FileSpreadsheet size={16} className="mt-0.5 shrink-0" style={{ color: '#16a34a' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#374151' }}>
                Excel (.xlsx)
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Dados para análise
              </p>
            </div>
          </button>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f3f4f6' }} />

          {/* PDF */}
          <button
            type="button"
            onClick={() => { onExportPdf(); setAberto(false); }}
            className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-red-50 transition-colors"
          >
            <FileText size={16} className="mt-0.5 shrink-0" style={{ color: '#dc2626' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#374151' }}>
                PDF (.pdf)
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Relatório formatado
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

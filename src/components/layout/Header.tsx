// --- Header do dashboard ---
// Tema claro: fundo branco, textos escuros, acentos da marca nos controles.

import { useApp } from '../../state/AppContext';
import { useAuth } from '../../state/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import type { RegimeTributario, VisaoFinanceira } from '../../types';
import { LayoutDashboard, Copy } from 'lucide-react';

const isDev = import.meta.env.MODE === 'development';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Gera opções de período dos últimos 24 meses. Valor: "2025-12", label: "2025 - Dez". */
function gerarOpcoesPeriodo(): { valor: string; label: string }[] {
  const opcoes: { valor: string; label: string }[] = [];
  const hoje = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mesIdx = d.getMonth();
    const valor = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
    opcoes.push({ valor, label: `${ano} - ${MESES_ABREV[mesIdx]}` });
  }
  return opcoes;
}

const OPCOES_PERIODO = gerarOpcoesPeriodo();

export function Header() {
  const { periodoSelecionado, setPeriodoSelecionado, regime, setRegime, visaoFinanceira, setVisaoFinanceira, dadosPeriodo, loading, iniciarCopiaManual } = useApp();
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';

  const receitaTotal = dadosPeriodo?.totais.receita_bruta ?? 0;
  // Período "tem dados" se o wrapper tem resultados ou clientes carregados.
  const periodoTemDados = !!dadosPeriodo
    && (dadosPeriodo.resultados.length > 0 || dadosPeriodo.clientes.length > 0);

  return (
    <header
      className="px-6 py-3 flex items-center justify-between"
      style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e2e8' }}
    >
      {/* Lado esquerdo: título + badge DEV */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #0065FF, #D000BB)' }}>
          <LayoutDashboard size={18} color="#ffffff" />
        </div>
        {isDev && (
          <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded">
            DEV
          </span>
        )}
      </div>

      {/* Lado direito: controles */}
      <div className="flex items-center gap-4">
        {/* Badge receita bruta total */}
        {dadosPeriodo && !loading && (
          <div
            className="px-3 py-1.5 rounded-lg text-right"
            style={{ backgroundColor: '#0065FF' }}
          >
            <p className="text-[10px] text-white/70 leading-tight">Receita Bruta</p>
            <p className="text-sm font-bold text-white">{formatCurrency(receitaTotal)}</p>
          </div>
        )}

        {/* Toggle regime tributário */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid #e2e2e8' }}
        >
          {(['presumido', 'real'] as RegimeTributario[]).map((r) => (
            <button
              key={r}
              onClick={() => setRegime(r)}
              className={`px-4 py-1.5 text-xs font-medium transition-all ${
                regime === r ? 'bg-gradient-brand text-white' : ''
              }`}
              style={regime !== r ? { backgroundColor: '#ffffff', color: '#6b6b8a' } : undefined}
            >
              {r === 'presumido' ? 'Presumido' : 'Real'}
            </button>
          ))}
        </div>

        {/* Toggle visão financeira */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid #e2e2e8' }}
        >
          {(['margem_contribuicao', 'ebitda'] as VisaoFinanceira[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisaoFinanceira(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                visaoFinanceira === v ? 'bg-gradient-brand text-white' : ''
              }`}
              style={visaoFinanceira !== v ? { backgroundColor: '#ffffff', color: '#6b6b8a' } : undefined}
            >
              {v === 'margem_contribuicao' ? 'Mg. Contrib.' : 'EBITDA'}
            </button>
          ))}
        </div>

        {/* Seletor de período */}
        <select
          value={periodoSelecionado}
          onChange={(e) => setPeriodoSelecionado(e.target.value)}
          className="select-dark rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e2e8',
            color: '#160F41',
          }}
        >
          <option value="">Selecione o período</option>
          {OPCOES_PERIODO.map((p) => (
            <option key={p.valor} value={p.valor}>{p.label}</option>
          ))}
        </select>

        {/* Cópia manual — só admin, desabilitado quando período já tem dados */}
        {isAdmin && periodoSelecionado && (
          <button onClick={iniciarCopiaManual} disabled={periodoTemDados}
            title={periodoTemDados
              ? 'Período já possui dados — cópia indisponível'
              : 'Copiar dados do período anterior para este período'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <Copy size={13} /> Copiar período anterior
          </button>
        )}

        {/* Indicador de loading */}
        {loading && (
          <div
            className="animate-spin rounded-full h-5 w-5 border-b-2"
            style={{ borderColor: '#0065FF' }}
          />
        )}
      </div>
    </header>
  );
}

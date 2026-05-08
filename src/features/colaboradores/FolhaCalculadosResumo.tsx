// --- Resumo auditável dos campos calculados da Folha ---
// Display de leitura para o ResultadoFolha (CLT). Pro-labore exibe um
// subset enxuto. Atualizado em tempo real conforme o usuário edita teto,
// líquido acordado, dependentes e benefícios.

import { formatCurrency } from '../../utils/formatters';
import { ANO_FOLHA_VIGENTE } from '../../utils/constants';
import type { ResultadoFolha } from '../../types';

interface Props {
  resultado: ResultadoFolha;
  isCLT: boolean;
  localidade: 'SP' | 'RJ';
}

function Linha({ label, valor, total }: { label: string; valor: string; total?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${total ? 'font-bold' : ''}`}
      style={{ color: total ? '#160F41' : '#6b6b8a' }}>
      <span className="text-xs">{label}</span>
      <span className="text-xs tabular-nums">{valor}</span>
    </div>
  );
}

export function FolhaCalculadosResumo({ resultado: r, isCLT, localidade }: Props) {
  const aliquotaInssEfetiva = r.salario_teto_cargo > 0
    ? (r.inss / r.salario_teto_cargo) * 100 : 0;

  return (
    <div className="rounded-lg border p-3 space-y-1"
      style={{ borderColor: '#e2e2e8', backgroundColor: '#f9f9fb' }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6b6b8a' }}>
        Cálculos da folha (somente leitura)
      </p>

      {isCLT ? (
        <>
          <Linha label={`INSS (alíquota efetiva: ${aliquotaInssEfetiva.toFixed(2)}%)`}
            valor={formatCurrency(r.inss)} />
          <Linha label="IRRF bruto" valor={formatCurrency(r.irrf)} />
          {r.redutor_ir_2026 > 0 && (
            <Linha label="Redutor IR 2026" valor={`− ${formatCurrency(r.redutor_ir_2026)}`} />
          )}
          <Linha label="IRRF líquido" valor={formatCurrency(r.irrf_liquido)} />
          <Linha label="Líquido do teto" valor={formatCurrency(r.liquido_do_teto)} />
          <div className="border-t my-1" style={{ borderColor: '#e2e2e8' }} />
          <Linha label="Complemento PLR" valor={formatCurrency(r.complemento_plr)} />
          <Linha label="13º + Férias PLR / mês" valor={formatCurrency(r.reflexos_plr_mensal)} />
          <Linha label="Encargos patronais (28%)" valor={formatCurrency(r.encargos_patronais)} />
          <Linha label="13º + Férias CLT / mês" valor={formatCurrency(r.decimo_terceiro_ferias)} />
        </>
      ) : (
        <>
          <Linha label="Encargos patronais (20% INSS)" valor={formatCurrency(r.encargos_patronais)} />
          <p className="text-[10px] italic" style={{ color: '#6b6b8a' }}>
            Pró-labore: sem 13º/férias/PLR.
          </p>
        </>
      )}

      <div className="border-t my-2" style={{ borderColor: '#e2e2e8' }} />
      <Linha label="Custo total mensal" valor={formatCurrency(r.custo_total_mensal)} total />
      <Linha label={`Custo/hora (${localidade})`} valor={formatCurrency(r.custo_hora)} total />

      <p className="text-[10px] mt-2" style={{ color: '#6b6b8a' }}>
        Tabela INSS {ANO_FOLHA_VIGENTE} · IRRF {ANO_FOLHA_VIGENTE}
        {' · '}Fontes: Portaria MPS + Receita Federal
      </p>
    </div>
  );
}

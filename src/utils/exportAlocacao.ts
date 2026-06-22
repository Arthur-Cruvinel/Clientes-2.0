// --- Exportação Excel: Alocação em Lote (uma aba por colaborador × função) ---
// SheetJS community: suporta FÓRMULAS, larguras e formato numérico — NÃO
// suporta estilo de célula (fundo/negrito/cor). A coluna editável é sinalizada
// no cabeçalho. Cada aba é um "mini-calculador": editar a col E recalcula F e G.

import * as XLSX from 'xlsx';
import {
  HORAS_PACOTE, HORAS_CLT_MES, HORAS_PRODUTIVAS_MES_POR_LOCALIDADE,
} from './constants';
import type { Cliente, Colaborador, FuncaoAlocacao } from '../types';
import type { Vinculo } from '../types/vinculo';

const LABEL_FUNCAO: Record<FuncaoAlocacao, string> = {
  consultoria_gestao: 'Gestão', consultoria_planejamento: 'Planejamento',
  consultoria_financeira: 'Financeira', operacional_financeiro: 'Operacional',
  serv_adm: 'Adm', serv_aux_adm: 'Aux Adm',
};

/** Nome de aba válido no Excel: ≤31 chars, sem : \ / ? * [ ]; deduplicado. */
function nomeAbaUnico(base: string, usados: Set<string>): string {
  let nome = base.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim();
  if (!nome) nome = 'Aba';
  let final = nome; let i = 2;
  while (usados.has(final)) {
    const sufixo = ` (${i++})`;
    final = nome.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(final);
  return final;
}

export function exportAlocacaoExcel(
  colaboradoresComFuncoes: Record<string, FuncaoAlocacao[]>,
  todosClientes: Cliente[],
  vinculos: Vinculo[],
  colaboradores: Colaborador[],
  periodo: string,
): void {
  // Índices O(1): colaborador por nome + pct de vínculo por (idColab|idCli|funcao).
  const colabPorNome = new Map(colaboradores.map(c => [c.nome_colaborador, c]));
  const vincPct = new Map<string, number>();
  for (const v of vinculos) vincPct.set(`${v.id_estavel_colaborador}|${v.id_estavel_cliente}|${v.funcao}`, v.pct);

  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  const headers = ['Cliente', 'Pacote', 'Pct pacote (%)', 'Pct atual (%)', '% dedicação (%) — editável', 'Horas efetivas', 'Sobrecarga'];

  // Pares (colaborador × função) em ordem: nome ASC, depois função.
  const pares: { nome: string; funcao: FuncaoAlocacao }[] = [];
  for (const nome of Object.keys(colaboradoresComFuncoes).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    for (const f of colaboradoresComFuncoes[nome]) pares.push({ nome, funcao: f });
  }

  for (const { nome, funcao } of pares) {
    const colab = colabPorNome.get(nome);
    const palocavel = colab?.percentual_alocavel ?? 0;
    const horasProdMes = HORAS_PRODUTIVAS_MES_POR_LOCALIDADE[colab?.localidade ?? 'SP']
      ?? HORAS_PRODUTIVAS_MES_POR_LOCALIDADE.SP;
    const horasDisponiveis = horasProdMes * palocavel;
    const paPct = palocavel * 100;   // orçamento alocável em pontos percentuais

    const clientes = todosClientes
      .filter(c => (c[funcao] as string | undefined) === nome)
      .sort((a, b) => a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR'));

    // Cabeçalho (5 linhas) + header (linha 6) + dados (7+) + total.
    const aoa: (string | number | null)[][] = [
      ['Galácticos CFO — Alocação em Lote'],
      [`Colaborador: ${nome} | Função: ${LABEL_FUNCAO[funcao]}`],
      [`Período: ${periodo} | Exportado em: ${new Date().toLocaleString('pt-BR')}`],
      [`Disponível: ${horasDisponiveis.toFixed(0)}h (${paPct.toFixed(0)}% de ${HORAS_PRODUTIVAS_MES_POR_LOCALIDADE.SP.toFixed(0)}h)`],
      [],
      headers,
    ];

    for (const c of clientes) {
      const pctRef = ((HORAS_PACOTE[c.pacote_servico]?.[funcao] ?? 0) / HORAS_CLT_MES) * 100;
      const vinc = (colab?.id_estavel && c.id_estavel)
        ? vincPct.get(`${colab.id_estavel}|${c.id_estavel}|${funcao}`) : undefined;
      const legado = (c[`pct_${funcao}` as keyof Cliente] as number | undefined) ?? 0;
      const pctAtual = ((vinc !== undefined && vinc > 0) ? vinc : legado) * 100;
      // F e G entram como fórmula abaixo (placeholder aqui).
      aoa.push([c.nome_cliente, c.pacote_servico, pctRef, pctAtual, pctAtual, 0, 0]);
    }
    aoa.push(['TOTAL', '', '', '', 0, 0, 0]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const primeira = 7;                          // 1ª linha de dados (Excel, 1-based)
    const ultima = 6 + clientes.length;          // última linha de dados
    const totalR = ultima + 1;                   // linha de totais

    // Fórmulas por cliente: F = E/100*168 ; G = (E/100)/(C/100) com guarda.
    for (let r = primeira; r <= ultima; r++) {
      const e = `E${r}`, c = `C${r}`;
      const eVal = (ws[e]?.v as number) ?? 0;
      const cVal = (ws[c]?.v as number) ?? 0;
      ws[`F${r}`] = { t: 'n', f: `${e}/100*${HORAS_CLT_MES}`, v: (eVal / 100) * HORAS_CLT_MES, z: '#,##0.0' };
      ws[`G${r}`] = { t: 'n', f: `IF(${c}=0,0,(${e}/100)/(${c}/100))`, v: cVal > 0 ? (eVal / 100) / (cVal / 100) : 0, z: '0.00' };
      // Formatos das colunas numéricas de % (pontos percentuais).
      for (const col of ['C', 'D', 'E']) if (ws[`${col}${r}`]) ws[`${col}${r}`].z = '0.0';
    }

    // Totais: ΣE, ΣF e % do disponível (col G) = ΣE / orçamento alocável.
    if (clientes.length > 0) {
      ws[`E${totalR}`] = { t: 'n', f: `SUM(E${primeira}:E${ultima})`, z: '0.0' };
      ws[`F${totalR}`] = { t: 'n', f: `SUM(F${primeira}:F${ultima})`, z: '#,##0.0' };
      ws[`G${totalR}`] = paPct > 0
        ? { t: 'n', f: `E${totalR}/${paPct}*100`, z: '0.0' }
        : { t: 'n', v: 0, z: '0.0' };
    }
    // Rótulo auxiliar do "% do disponível" na coluna F do total já tem ΣHoras;
    // marcamos a célula D do total para indicar o que G representa.
    ws[`D${totalR}`] = { t: 's', v: '% do disponível →' };

    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 22 }, { wch: 12 }, { wch: 9 }];
    XLSX.utils.book_append_sheet(wb, ws, nomeAbaUnico(`${nome.split(' ')[0]} ${LABEL_FUNCAO[funcao]}`, usados));
  }

  if (wb.SheetNames.length === 0) {
    const vazia = XLSX.utils.aoa_to_sheet([['Sem colaboradores com clientes no período.']]);
    XLSX.utils.book_append_sheet(wb, vazia, 'Vazio');
  }

  XLSX.writeFile(wb, `alocacao_${periodo}_${Date.now()}.xlsx`);
}

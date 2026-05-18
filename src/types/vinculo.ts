// --- Interface Vinculo (Fase 2.5 — Peça 1) ---
// Fonte da verdade: docs/fase-2.5-vinculos-plano.md
//
// Por que vínculo é entidade própria:
//   - Antes, a alocação cliente↔colaborador morava DENTRO do documento de
//     cliente (campos consultoria_gestao, pct_*, etc.), referenciando o
//     colaborador por NOME — o que gerou os 5 nomes quebrados diagnosticados.
//   - O vínculo concentra a relação num único registro, referenciando o
//     colaborador por id_estavel (UUID v4, imutável) e desacoplando mudanças
//     de equipe dos documentos de cliente.
//
// Decisões fechadas (sessão de design, CFO 2026-05-18):
//   - Campo de intensidade: `pct` (não `fator`). Mantém a semântica atual.
//   - DocId: {slug_colab}_{slug_cli}_{funcao}. Composto, determinístico —
//     o mesmo trio (colab, cli, função) nunca gera dois vínculos.
//   - Snapshot por período (Decisão 4 do plano): cada período tem seu próprio
//     conjunto de vínculos em fechamentos/{periodo}/vinculos/. Replicação
//     mês-a-mês copia os vínculos quando nada muda.
//   - Pure Asset (pacote_servico='asset_only') NÃO gera vínculos — clientes
//     pure asset não consomem horas de CFO; pct_* = 0 por definição.

import type { FuncaoAlocacao } from './index';

export interface Vinculo {
  // docId quando lido do Firestore — formato {slug_colab}_{slug_cli}_{funcao}.
  // Opcional aqui porque o doc do Firestore não tem campo "id"; o docId vem
  // do snapshot.id quando lido. Mantido só para conveniência em memória.
  id?: string;

  // Período do snapshot. Formato 'YYYY-MM' (ex: '2026-01') OU literal
  // 'SANDBOX' (período de teste, não-produção — Etapa 3 da Peça 1).
  periodo: string;

  // ── REFERÊNCIAS POR id_estavel (Decisão 3 do plano) ──────────────────────
  // Nunca por nome. id_estavel é UUID v4 imutável, criado uma vez na Fase 3.
  // Cross-coleção sempre via id_estavel — nome muda, id não.
  id_estavel_colaborador: string;
  id_estavel_cliente: string;

  // ── NOMES (denormalizados para leitura rápida) ────────────────────────────
  // Não são fonte de verdade — apenas conveniência para listagens/logs sem
  // precisar de join. A fonte canônica do nome vive em colaboradores_base/
  // e clientes_base/, indexada pelo id_estavel acima.
  nome_colaborador: string;
  nome_cliente: string;

  // Uma das 6 funções de FuncaoAlocacao. Um cliente atendido integralmente
  // pode ter até 6 vínculos no mesmo período (um por função).
  funcao: FuncaoAlocacao;

  // Intensidade da alocação — fração do tempo do colaborador dedicada a
  // este cliente nesta função. Decimal (ex: 0.12 = 12% do mês). Soma dos
  // pct de todos os vínculos de um colaborador num período deve ser
  // ≤ percentual_alocavel do colaborador (validação de sobrecarga).
  pct: number;

  // ── RASTREABILIDADE ──────────────────────────────────────────────────────
  // De onde veio este vínculo. Exemplos esperados:
  //   'migracao_fase_2_5'  → criado pela Peça 2 (migração inicial)
  //   'sandbox'            → criado em fechamentos/SANDBOX/ para teste
  //   'manual'             → criado pelo CFO via UI (Peça 6)
  //   'alocacao_em_lote'   → criado pelo painel de Alocação em Lote
  origem: string;

  // ISO timestamp da criação do registro (não da vigência — vigência é
  // implícita no campo `periodo`).
  data_criacao: string;
}

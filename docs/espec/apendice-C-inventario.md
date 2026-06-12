# Apêndice C — Inventário de telas, rotas e componentes

> Mapa para a equipe de reconstrução localizar o comportamento descrito na Parte
> IV. Lista, por módulo, a rota, o componente de entrada, o hook de lógica e os
> componentes principais (modais, tabelas, colunas, exporters). Caminhos relativos
> a `src/`.

---

## C.1 Navegação e estrutura

| Elemento | Local |
|---|---|
| Roteamento (lazy por módulo) | `App.tsx` |
| Navegação lateral (rotas) | `components/layout/Sidebar.tsx` |
| Layout principal | `components/layout/MainLayout.tsx` |
| Estado global (período, regime, parâmetros, dados processados) | `state/AppContext.tsx` |
| Acesso/perfil | `state/AuthContext.tsx`, `features/auth/` |

**Rotas ativas** (path → componente): `visao-geral`, `gestores`, `simulador`
(Precificação), `capacidade`, `perfil`, `poupanca` (AUM), `patrimonio`, `upload`,
`configuracoes`. **Reservadas:** `projecao`, `cenarios`, `pipeline`, `matriz`,
`risco`, `evolucao`, `patrimonial`.

---

## C.2 Visão Geral — `features/visao-geral/`

| Papel | Arquivo |
|---|---|
| Tela | `VisaoGeral.tsx` |
| Hook/derivações | (no próprio `VisaoGeral.tsx`) + adapter `utils/dadosClienteAdapter.ts` |
| Tabela + totais | `TabelaClientes.tsx` |
| Definição de colunas + visão MC/EBITDA | `columns.tsx` |
| Filtro por coluna | `FiltroColuna.tsx` |
| Drill-down custo direto/dedicado | `CustoDiretoModal.tsx` |
| Drill-down custo indireto | `CustoIndiretoModal.tsx` |
| Drill-down impostos | `ImpostosModal.tsx` |
| Ranking de empresários | `RankingEmpresariosModal.tsx` |
| Agente de validação | `features/agente/AgenteValidacao.tsx` |
| Exports | `utils/exporters/exportExcel.ts`, `exportPdf.ts` |
| Fechar/copiar período | `services/firebase.ts` (`fecharPeriodo`, `reabrirPeriodo`, replicação) |

---

## C.3 Configurações — `features/configuracoes/`

| Papel | Arquivo |
|---|---|
| Tela (abas + Manutenção) | `Configuracoes.tsx` |
| Hook | `useConfiguracoes.ts` |
| Custos | `TabRebate.tsx` (rebate), `features/custos-indiretos/CustosIndiretos.tsx` + `useCustosIndiretos.ts` |
| Pacotes de serviço | `TabPacotes.tsx` |
| Colaboradores | `ColaboradoresVisao.tsx`, `features/colaboradores/` (`ColaboradorModal.tsx`, `useColaboradores.ts`, `RenomearColaboradorModal.tsx`) |
| Metodologia | `features/metodologia/Metodologia.tsx` |
| Custos/seed/upsert/propagação | `services/firebase.ts` (`semearCustosIndiretos`, `definirCustoIndireto`, `atualizarValorCustoIndireto`, `planejarPropagacaoCustos`, `executarPropagacaoCustos`) |
| Folha/propagação/renome | `services/firebase.ts` (`salvarColaboradorPeriodo`, `propagarFolhaColaborador`, `propagarFolhaTodosColaboradores`, `renomearColaborador`, `buscarDadosFolhaPorPeriodo`) |
| Manutenção (siglas/poupança/tombamento) | `services/firebase.ts` (`corrigirNomeClientePoupanca`, `cadastrarSiglaNova`, `corrigirEntradaMapeamentoSiglas`, `zerarCampoTombamento`), `utils/migrarMapeamentoSiglas.ts` |

---

## C.4 Ficha do cliente — `features/perfil/`

| Papel | Arquivo |
|---|---|
| Tela (visões + abas) | `Perfil.tsx` |
| Novo cliente | `NovoClienteModal.tsx` |
| Editar cliente (abas + exclusão) | `EditarClienteModal.tsx` |
| Perfil de complexidade | `PerfilComplexidadeTab.tsx` |
| Atribuição em lote (banker/empresário) | `AlocacaoLote.tsx` |
| Ordenação | `ordenacaoAlocacao.ts` |
| Exclusão (período/permanente) | `services/firebase.ts` (`excluirClientePeriodo`, `excluirClientePermanente`) |
| Criação/persistência | `services/firebase.ts` (`salvarClienteBase`, `criarClienteNovo`) |

---

## C.5 Alocação em Lote — `features/perfil/`

| Papel | Arquivo |
|---|---|
| Tela | `AlocacaoEmLote.tsx` |
| Hook | `useAlocacaoEmLote.ts` |
| Distribuição/sugestão | `utils/financials.alocacao.ts` (`calcularPctDistribuido`, `ocupacaoConsolidada`, `horasProdutivasMes`) |
| Escrita de alocação | `services/firebase.ts` (`salvarVinculosPct`, `sincronizarVinculoFuncao`) |

---

## C.6 Capacidade — `features/capacidade/`

| Papel | Arquivo |
|---|---|
| Tela | `Capacidade.tsx` |
| Hook | `useCapacidade.ts` |
| Drill-down | `CapacidadeDrillDown.tsx` |
| Demanda/escopo | `utils/financials.alocacao.ts`, `utils/constants.ts` (`HORAS_PACOTE`) |

---

## C.7 Gestores — `features/gestores/`

| Papel | Arquivo |
|---|---|
| Tela | `Gestores.tsx` |
| Hook (cobertura, devoluções) | `useGestores.ts` |
| Bases do motor | `utils/financials.custos.ts` (`somarPctPorColaborador`), `utils/financials.alocacao.ts` (`ocupacaoConsolidada`) |

---

## C.8 Precificação — `features/simulador/`

| Papel | Arquivo |
|---|---|
| Tela (wrapper de abas) | `Simulador.tsx` |
| Barra da razão de referência | `BarraOverheadRef.tsx` |
| Reajustes (eixos/filtros) | `Reajustes.tsx` + `useReajustes.ts` |
| Gerador de propostas | `GeradorProposta.tsx` |
| Base de demanda/overhead | `precificacaoBase.ts` |
| Template institucional | `propostaTemplate.ts` (+ asset `logoGalaticos.svg`) |
| Propostas (persistência) | `services/firebase.ts` (`salvarProposta`, `buscarPropostas`, `atualizarPropostaStatus`, `excluirProposta`), `salvarOverheadRatioReferencia` |

---

## C.9 AUM & Performance — `features/poupanca/`

| Papel | Arquivo |
|---|---|
| Tela | `Poupanca.tsx` |
| Hook (NNM, MM6, burn, projeção) | `usePoupanca.ts` |
| KPIs | `PoupancaKpis.tsx` |
| Tabela por cliente (TWR) | `PoupancaTabela.tsx` |
| Detalhe individual | `DetalheTabela.tsx`, `DetalheLinhaEdit.tsx` |
| Modais burn/projeção | `BurnRateModal.tsx`, `ProjecaoModal.tsx` |
| Importação | `import/ImportPoupanca.tsx`, `useImportPoupanca.ts`, `parsers/parseComClaude.ts` |
| Resolução de siglas | `import/ResolverSiglasModal.tsx`, `import/BannerQuarentena.tsx`, `import/MAPEAMENTO_SIGLAS.ts` |
| Sub-módulo Banker | `banker/BankerVisao.tsx`, `BankerDetalhe.tsx`, `useBanker.ts` |
| Integração AUM (Pure Asset/rebate) | `services/aumIntegration.ts` |
| Persistência poupança | `services/firebase.ts` (`buscarRegistrosPoupancaPorPeriodo`, edição/normalização) |
| Exports | `utils/exporters/` (AUM, burn, projeção) |
| Harness de reconciliação (auditoria, CLI read-only) | `scripts/reconciliacao-harness.mjs` |

---

## C.10 Importação central — `features/upload/`

| Papel | Arquivo |
|---|---|
| Central (3 abas) | `Upload.tsx` (ETL Excel + Importar Poupança + Gerenciar Dados) |
| ETL inicial | `features/upload/` (template Excel) |
| Importar poupança | reusa `features/poupanca/import/` |

---

## C.11 Catálogos e constantes — `utils/`

| Conteúdo | Arquivo |
|---|---|
| Constantes financeiras, pacotes, alíquotas, tabelas INSS/IRRF, categorias de custo | `utils/constants.ts` |
| Catálogo de atividades (coeficientes de horas) | `utils/atividadesServico.ts` |
| Formatadores | `utils/formatters.ts` |
| Motor (ver Apêndice B) | `utils/financials.*.ts` |
| Tipos do domínio (ver Apêndice A) | `types/index.ts`, `types/vinculo.ts` |

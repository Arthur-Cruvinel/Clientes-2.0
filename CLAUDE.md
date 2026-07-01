# CLAUDE.md

Este arquivo é a fonte da verdade para o Claude Code ao trabalhar neste repositório. Leia integralmente antes de qualquer alteração.

---

## Visão Geral do Projeto

**Clientes 360** — Plataforma financeira da Galácticos Capital (family office especializado em atletas de futebol). Calcula rentabilidade por cliente combinando pacotes de serviço, fatores de utilização por função, custos indiretos (OPEX) e receitas sob diferentes regimes tributários (Lucro Presumido vs Lucro Real). Interface multi-abas voltada para o CFO.

**Autor:** Arthur Cruvinel — Diretor Financeiro (CFO), autodidata em programação. Comentários didáticos são bem-vindos — explicar o "porquê" das decisões, não só o "como".

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite |
| Banco de dados | Firebase Firestore (SDK modular v9+) |
| Autenticação | Firebase Auth (email/senha) + `role` no Firestore — `AuthContext`, `LoginPage`, `PrivateRoute` |
| Estilo | Tailwind CSS (via @tailwindcss/vite) |
| Gráficos | Recharts |
| Exportação de dados | SheetJS/xlsx (Excel) + jsPDF/jspdf-autotable (PDF de TABELAS — AUM/burn/projeção, em `utils/exporters/exportPdf.ts`) |
| Geração de documentos (PDF) | PDFShift via Netlify Function `gerar-pdf` (proposta e orçamento — página única) |
| Ícones | Lucide React |
| Deploy | Netlify (em produção) |

**Nunca usar compat mode do Firebase** — sempre SDK modular v9+ com imports nomeados.

---

## Ambiente de Desenvolvimento

- **OS:** Windows (máquina corporativa — Galácticos Capital)
- **Rede:** Corporativa com proxy. Usar `experimentalForceLongPolling: true` no Firestore (obrigatório).
- **Node.js:** Instalado localmente (npm disponível)
- **Git:** Instalado localmente, integrado ao VS Code
- **Deploy:** Netlify (push para branch main → deploy automático)
- **Fonte:** Inter (substituto da fonte proprietária do brandbook)

---

## Estrutura de Pastas

```
clientes-360/
├── public/
├── src/
│   ├── components/
│   │   ├── layout/                # Sidebar, Header, MainLayout
│   │   └── ui/                    # Button, Modal, Toast, Badge, KpiCard, DataTable
│   ├── hooks/                     # Custom hooks (lógica separada da UI)
│   ├── services/
│   │   ├── firebase.ts            # Inicialização + cliente Firestore
│   │   └── parsers.ts             # parseNumericValue, parseCSV
│   ├── features/                  # Cada aba = 1 feature isolada
│   │   ├── visao-geral/
│   │   ├── gestores/
│   │   ├── projecao/
│   │   ├── simulador/
│   │   ├── cenarios/
│   │   ├── pipeline/
│   │   ├── capacidade/
│   │   ├── matriz/
│   │   ├── risco/
│   │   ├── perfil/
│   │   ├── poupanca/
│   │   ├── evolucao/
│   │   └── patrimonial/
│   ├── state/                     # React Contexts (AppContext)
│   ├── types/                     # Interfaces TypeScript
│   ├── utils/
│   │   ├── constants.ts           # Constantes financeiras e de pacotes
│   │   ├── formatters.ts          # formatCurrency, formatPercent, formatDate
│   │   └── financials.ts          # DRE, rateio, margens, tributária, custo direto
│   ├── App.tsx
│   └── main.tsx
├── .env                           # Único arquivo de env (produção apenas)
├── .gitignore
├── CLAUDE.md
└── ARQUITETURA_DESENVOLVIMENTO.md
```

Cada feature segue o padrão:
```
features/visao-geral/
├── VisaoGeral.tsx        # Componente (apresentação)
├── useVisaoGeral.ts      # Hook (lógica e dados)
└── columns.ts            # Definição de colunas (se houver tabela)
```

---

## Princípios de Código

1. **Arquivos pequenos:** máximo 150 linhas. Se passar, dividir com responsabilidade única.
2. **TypeScript estrito:** interfaces para todos os modelos. Sem `any` quando evitável.
3. **Componentes pequenos:** cada componente faz uma coisa. Composição sobre monolitos.
4. **Hooks para lógica:** separar lógica (`hooks/`) da apresentação (`components/`).
5. **Services para infraestrutura:** Firebase e parsers ficam em `services/`.
6. **Constantes centralizadas:** todos os valores fixos em `utils/constants.ts`.
7. **Tratamento de erros:** try/catch em toda operação assíncrona. Logs com prefixo do módulo (ex: `[Firebase]`, `[DRE]`, `[Folha]`).
8. **Memoização:** `React.memo`, `useMemo`, `useCallback` em componentes com arrays grandes.
9. **Lazy loading:** `React.lazy` + `Suspense` para features (abas).
10. **Ordenação em tabelas:** toda tabela de dados deve ter ordenação por coluna.
    Default sempre alfabético (`localeCompare 'pt-BR'`) pela coluna de nome/identificador
    principal. Usar o componente genérico `HeaderOrdenavel` em
    `src/components/ui/HeaderOrdenavel.tsx` — não criar variações novas.
    Estado de ordenação sempre no hook da feature, nunca no componente.

---

## Princípios de Arquitetura

Princípios transversais que orientam COMO o sistema cresce. Diferem dos
"Princípios de Código" (estilo/organização) — aqui é sobre reuso, descoberta e
consistência. Contexto: migração para desenvolvimento IA-first, onde
previsibilidade é pré-condição para o sistema ser legível por IA e por novos
membros da equipe.

### Princípio 1 — Reuso antes de criação (funções não se duplicam)

Antes de criar qualquer função, módulo ou estrutura nova, verificar se já existe
algo que faça aquilo — ou que possa ser generalizado pra fazer. Lógica
genuinamente igual deve ser **compartilhada** (um motor, reusado), não reescrita
em vários lugares.

Exemplo: o Orçador de Extraordinário reusou a Netlify Function `gerar-pdf` e
espelhou 1:1 a persistência de propostas (coleção `orcamentos/` análoga a
`propostas/`), em vez de inventar do zero.

**Ressalva (evita o exagero):** NÃO forçar a compartilhar o que só PARECE igual.
Quando duas coisas se assemelham mas podem divergir, uma duplicação leve é mais
segura que um acoplamento que quebra uma feature quando se mexe na outra.
Exemplo: o `logoSVG` foi **re-importado** no template do orçamento em vez de
extraído, pra não tocar o `propostaTemplate` estável.

**Regra:** reusar o que é o mesmo; duplicar conscientemente o que só parece
igual. Evitar tanto a duplicação desnecessária quanto a abstração prematura.

### Princípio 2 — Read-only antes de qualquer implementação

Sempre fazer um diagnóstico read-only (olhar o código existente) **antes** de
implementar. É o que torna o Princípio 1 possível: o sistema não duplica por
querer, duplica por NÃO SABER que algo já existe — o read-only dá essa
informação.

Exemplo: o diagnóstico antes do Orçador descobriu que a persistência de
propostas já existia (coleção `propostas/` com CRUD completo), poupando de criar
do zero e revelando o padrão a copiar.

A intenção (P1) sem a informação (P2) ainda duplica. **Os dois andam juntos.**

### Princípio 3 — Consistência de padrões

Padrões repetíveis devem ser **idênticos** em todo o sistema:

- **Persistência de documento** espelha o mesmo modelo: `status`, `id_estavel`
  (UUID), `criado_em`/`atualizado_em`, e CRUD `salvar`/`buscar`/
  `atualizarStatus`/`excluir`. (Ex.: `propostas/` e `orcamentos/`.)
- **Geração de PDF** usa sempre a mesma Netlify Function `gerar-pdf` (PDFShift,
  formato `1152xauto` página-única, `use_print:false`).

Previsibilidade é pré-condição para o sistema ser legível por IA e por novos
membros da equipe.

---

## Modelo de Dados — Firestore

### Estrutura Temporal (fechamento mensal)

```
fechamentos/
  {ano-mes}/                        # ex: "2025-12"
    clientes/           {documentos}
    colaboradores/      {documentos}
    custosIndiretos/    {documentos}
    vinculos/           {documentos} # Fase 2.5 — alocação colab↔cli×função

# Dados com histórico próprio:
poupanca/             {documentos por cliente/mês}
historico_fluxo/      {documentos por cliente/mês}
evolucao_pl/          {documentos por cliente/mês}
patrimonial/          {documentos por cliente}
```

`vinculos/` tem também o período especial `fechamentos/SANDBOX/vinculos/` —
usado pela Etapa 3 da Peça 1 para validar a estrutura sem tocar em períodos
de produção. Não é processado pelo motor financeiro.

### Interface Cliente

```typescript
interface Cliente {
  nome_cliente: string;
  empresario?: string;

  // Receita
  receita_fee: number;

  // ── PARÂMETROS DE REBATE (taxas contratuais — estáticas) ───────────────────
  // PL usado no cálculo vem do RegistroPoupanca do período correspondente.
  // Não armazenar PL no cadastro do cliente — ele muda todo mês.
  percentual_rebate_anual_onshore: number;
  percentual_rebate_anual_offshore?: number;
  aliquota_impostos_rebate: number;

  // Custos dedicados
  custo_contabilidade_dedicado?: number;
  custo_pagamento_dedicado?: number;
  custo_administrativo_dedicado?: number;

  // Flags de serviço
  utiliza_servico_juridico: boolean;
  utiliza_conciliacao: boolean;

  // ── MODELO DE ALOCAÇÃO ──────────────────────────────────────────
  // Pacote de serviço contratado — define as horas-direito por função.
  // 'asset_only' = cliente apenas patrimonial (rebate), sem fee/serviço de CFO —
  // todos os pct_* devem ser 0.
  pacote_servico: 'full' | 'advanced' | 'light' | 'future' | 'asset_only';

  // Colaborador responsável por função (quem atende)
  consultoria_gestao?: string;
  consultoria_planejamento?: string;
  consultoria_financeira?: string;
  operacional_financeiro?: string;
  serv_adm?: string;
  serv_aux_adm?: string;

  // ── PERCENTUAIS DE DEDICAÇÃO POR FUNÇÃO ────────────────────────────────────
  // Informado pelo próprio colaborador responsável pela função.
  // Representa a fração do tempo total do colaborador dedicada a este cliente.
  // Ex: 0.12 = o colaborador dedica 12% do seu tempo mensal a este cliente.
  // Atualizado mensalmente ou trimestralmente conforme revisão de carteira.
  // Pure asset (receita_fee = 0): todos os pct_* devem ser 0.
  pct_consultoria_gestao: number;
  pct_consultoria_planejamento: number;
  pct_consultoria_financeira: number;
  pct_operacional_financeiro: number;
  pct_serv_adm: number;
  pct_serv_aux_adm: number;

  // ── INDICADORES DE ESCOPO (calculados pelo sistema — nunca editar) ──────────
  // fator = pct_real / pct_normativo
  // pct_normativo = HORAS_PACOTE[pacote][funcao] / HORAS_CLT_MES
  // fator > 1.0 → cliente consumindo acima do escopo do pacote → alerta
  // fator < 1.0 → cliente subutilizando o pacote
  // fator calculado apenas para clientes com receita_fee > 0
  fator_consultoria_gestao?: number;
  fator_consultoria_planejamento?: number;
  fator_consultoria_financeira?: number;
  fator_operacional_financeiro?: number;
  fator_serv_adm?: number;
  fator_serv_aux_adm?: number;

  // Rateio de indiretos
  peso_juridico?: number;          // peso relativo para rateio jurídico (default 1.0)
  volume_movimentos_mes?: number;  // média de movimentos bancários mensais (conciliação)
}
```

### Interface Colaborador

```typescript
interface Colaborador {
  nome_colaborador: string;
  cargo: string;
  localidade: 'SP' | 'RJ';
  // Define o calendário de feriados aplicável ao colaborador
  // Impacta diretamente o custo/hora via HORAS_PRODUTIVAS_POR_LOCALIDADE
  funcao_principal: FuncaoAlocacao;
  alocavel: boolean;
  tipo_vinculo: 'clt' | 'pro_labore';
  // 'clt'        → CLT padrão com encargos completos (13º, férias, FGTS, INSS patronal)
  // 'pro_labore' → Sócio/diretor. Encargos simplificados: só INSS patronal (20%).
  //                Sem 13º, sem férias, sem FGTS.
  //                Pode ser alocável (atende clientes) ou 100% institucional.

  // Percentuais de alocação
  percentual_alocavel: number;        // fração do tempo dedicada a clientes (ex: 0.7)
  percentual_institucional: number;   // fração do tempo institucional (ex: 0.3)
  // Regra: percentual_alocavel + percentual_institucional = 1.0

  // ── REMUNERAÇÃO ──────────────────────────────────────────────────────────
  // CLT: inputs são salario_teto_cargo + liquido_acordado + qtd_dependentes;
  //      o motor calcula INSS, IRRF, complemento PLR e reflexos.
  // Pro_labore: input é salario_base direto; sem 13º/férias/PLR.
  salario_teto_cargo: number;          // CLT — salário em carteira (base dos encargos patronais)
  liquido_acordado?: number;           // CLT — líquido alvo; gera complemento PLR se > líquido do teto
  qtd_dependentes?: number;            // CLT — dedução IRRF (default 0)
  beneficios_fixos: number;            // VT, VR, plano de saúde — fora da base de encargos
  salario_base: number;                // pro_labore: base mensal direta. @deprecated CLT — usar liquido_acordado

  // ── HISTÓRICO DE REAJUSTES ───────────────────────────────────────────────
  // Lista ordenada por vigencia ASC. O motor (buscarTetoPorPeriodo) usa a
  // entrada com vigencia <= periodo processado mais recente. Sem histórico
  // → fallback p/ salario_teto_cargo / liquido_acordado direto.
  // Pro_labore não usa histórico (motor lê salario_base direto).
  historico_reajustes?: ReajusteSalarial[];

  // ── CAMPOS CALCULADOS (nunca editar diretamente) ─────────────────────────
  // Derivados de calcularFolhaColaborador(). Persistidos para auditoria; o
  // motor sempre recalcula a partir dos inputs (tabelas INSS/IRRF mudam ao ano).
  inss?: number;
  irrf?: number;
  complemento_plr?: number;            // max(0, liquido_acordado − liquido_do_teto)
  reflexos_plr_mensal?: number;        // complemento_plr × 1,3333 / 12 (13º proporcional + 1/3 férias)
  encargos_patronais?: number;         // CLT: teto × 0,28 | pro_labore: base × 0,20
  decimo_terceiro_ferias?: number;     // CLT: (teto / 12) × 1,3333 | pro_labore: 0
  custo_total_mensal: number;
  // CLT:        teto + benefícios + encargos + decimo_terceiro_ferias
  //             + complemento_plr + reflexos_plr_mensal
  // Pro_labore: salario_base + benefícios + (salario_base × 0,20)
  custo_hora: number;                  // (custo_total_mensal × 12) / HORAS_PRODUTIVAS_POR_LOCALIDADE
}

// ── PERFIS DE COLABORADOR ────────────────────────────────────────────────────
// 1. CLT alocável (maioria da equipe)
//    alocavel = true, tipo_vinculo = 'clt'
//    Custo direto via pct_* + percentual_institucional vai para pool indireto geral
//
// 2. Pró-labore misto (Viviane, Priscilla)
//    alocavel = true, tipo_vinculo = 'pro_labore'
//    Mesmo comportamento do CLT alocável — parte vai para direto, parte para indireto
//    Diferença: custo_total_mensal calculado com encargos de pro_labore
//
// 3. Pró-labore fixo (Amilcar)
//    alocavel = false, tipo_vinculo = 'pro_labore', percentual_alocavel = 0
//    100% do custo vai para pool de indiretos gerais como custo institucional
//    Nunca aparece como custo direto de nenhum cliente

type FuncaoAlocacao =
  | 'consultoria_gestao'
  | 'consultoria_planejamento'
  | 'consultoria_financeira'
  | 'operacional_financeiro'
  | 'serv_adm'
  | 'serv_aux_adm';
```

### Interface ReajusteSalarial

Histórico de mudanças contratuais de remuneração CLT por colaborador.
Persistido em `fechamentos/{periodo}/colaboradores/{id}.historico_reajustes`.

```typescript
interface ReajusteSalarial {
  vigencia: string;           // 'YYYY-MM' — primeiro mês de vigência
  salario_teto_cargo: number; // novo teto CLT a partir desta vigência
  liquido_acordado: number;   // novo líquido acordado a partir desta vigência
  observacao?: string;        // ex: "Promoção", "Reajuste anual"
  registrado_em?: string;     // ISO timestamp do registro
  registrado_por?: string;    // usuário que registrou
}
```

**Validação de `liquido_acordado`:**

| Valor | Significado | Aceitação |
|---|---|---|
| `> 0` | CLT com complemento PLR (líquido alvo > líquido do teto) | ✓ válido |
| `= 0` | CLT puro, sem complemento PLR | ✓ válido |
| `< 0` | inválido | ✗ recusado |

`teto = liquido + INSS + IRRF` quando líquido = 0; o complemento PLR só existe
quando `liquido_acordado > liquido_do_teto`.

**Construção do histórico — automática.** O usuário **não cadastra reajustes
manualmente**. O fluxo é:

1. Ao abrir o modal de Folha em um período, o form inicializa via
   `buscarTetoPorPeriodo(colaborador, periodoSelecionado)` — então abrir
   Fev/2026 carrega os valores de Jan/2026 se não houve reajuste no meio.
2. Ao clicar **Salvar Folha**, o motor compara teto/líquido do form com o
   baseline (vigente no `inicial`). Se mudou, injeta uma entrada
   `{ vigencia: periodoSelecionado, observacao: 'Reajuste automático',
   registrado_em, registrado_por }`. Se o mesmo período já tinha entrada,
   ela é substituída.
3. `HistoricoReajustes.tsx` é **somente leitura** — log auditável. O usuário
   só pode excluir entradas **não-vigentes** (para corrigir erros pontuais);
   a vigente nunca pode ser excluída.

**Lógica de busca por período** (`buscarTetoPorPeriodo` em `financials.custos.ts`):

1. Sem `historico_reajustes` ou array vazio → fallback para `salario_teto_cargo`
   e `liquido_acordado` diretos do colaborador (retrocompatibilidade).
2. Com histórico → entrada com `vigencia <= periodo` mais recente.
3. Caso raro (período anterior à 1ª entrada) → usa a entrada mais antiga.

**Propagação flexível multi-período** (`propagarFolhaColaborador` em
`firebase.ts`): aplica `historico_reajustes` no subconjunto de períodos
selecionados pelo usuário via wizard de 3 etapas (modal "Propagar folha…"):

1. **Base** — período de referência (default = período do header). Mostra o
   teto/líquido vigentes naquele período via `buscarTetoPorPeriodo`.
2. **Destino** — direção da propagação:
   - `'a_partir_de'` → períodos `>= base` (deste mês em diante)
   - `'ate'` → períodos `<= base` (até este mês, retroativo)
   - `'todos'` → todos os períodos do colaborador
   - `'intervalo'` → `[periodoInicio, periodoFim]` arbitrário
3. **Confirmar** — resumo da operação + lista dos períodos afetados.

Para cada período-destino, o motor resolve teto/líquido próprios via
`buscarTetoPorPeriodo(stub, periodo)` — cada mês recebe o valor contratualmente
correto da época, não o do período-base. Atualizações em batches de
`BATCH_LIMIT`; erros por batch acumulados sem abortar o restante.

`buscarPeriodosDoColaborador(colaboradorId)` — lista os períodos onde o
colaborador existe (varre `collectionGroup('colaboradores')`); usado pelo
wizard para popular os selects e estimar o número de períodos afetados.

O botão "Propagar folha…" no rodapé do modal de Folha está sempre visível
em modo edição (admin pode rodar a qualquer momento, independente de ter
mexido no histórico na sessão).

**Renomeação de colaborador.** O campo `nome_colaborador` é editável no topo
da aba Folha (modos editar e criar). Ao Salvar Folha em modo editar com nome
diferente do original, o sistema dispara automaticamente
`renomearColaborador(antigo, novo)` em `firebase.ts` — propagação completa:

1. `fechamentos/{periodo}/clientes/{id}` via `collectionGroup('clientes')` —
   substitui o nome em qualquer dos 6 campos de função (match exato OU
   normalizado).
2. `clientes_base/{slug}` via `getDocs(collection)` — mesma substituição
   (collectionGroup não alcança top-level com outro nome).
3. `fechamentos/{periodo}/colaboradores/{id}` via
   `collectionGroup('colaboradores')` — atualiza `nome_colaborador` em
   todos os períodos. Tenta `where('nome_colaborador', '==', nomeAntigo)`
   primeiro; cai em scan completo + filtro normalizado quando o índice
   composite não existe ou a query vem vazia.

Match normalizado: NFD + remoção de combining marks + lowercase + trim +
colapsa espaços. Tudo em batches de `BATCH_LIMIT`. Acumula
`clientesAtualizados` (slugs únicos) e `periodosAtualizados` (períodos
únicos atingidos em qualquer das 3 etapas); erros não-fatais por batch.

A UI do progresso vive em `RenomearColaboradorModal.tsx` (state-machine
confirmando → renomeando → concluido/erro). Aberto pelo `ColaboradoresVisao`
ao detectar mudança de nome no callback de save. Após cobertura completa,
o lookup cliente→colaborador permanece consistente em qualquer período,
presente ou passado.

`buscarDadosFolhaPorPeriodo(colaboradores, periodo)` em `firebase.ts` lê os
campos diretos `salario_teto_cargo` e `liquido_acordado` salvos em
`fechamentos/{periodo}/colaboradores/{id}` — sem passar por histórico. Usado
pelo preview da propagação em massa e pelo snapshot da própria propagação,
garantindo WYSIWYG: o que aparece no preview é exatamente o que será aplicado.

**Propagação em massa** (`propagarFolhaTodosColaboradores` em `firebase.ts`):
disponível em **Configurações → Colaboradores → "Propagar folha em massa"**
(restrito a admin). Wizard de 3 etapas + execução: (1) selecionar período
base — exibe tabela com `teto`/`líquido`/`vigência` resolvidos via
`buscarTetoPorPeriodo` para cada colaborador; (2) selecionar destino (mesmas
4 opções da propagação single-colab); (3) confirmar com aviso de
irreversibilidade. Diferente da single-colab, esta operação **não toca em
`historico_reajustes`** — apenas fixa `salario_teto_cargo` e `liquido_acordado`
em todos os documentos `fechamentos/{periodo}/colaboradores/{id}` selecionados,
usando o snapshot do período base de cada colaborador. Pré-busca todos os
docs via `collectionGroup` para só atualizar onde existem (colaboradores que
não cobrem todos os períodos não geram erro fatal — aparecem na lista de
erros não-fatais ao final).

O motor (`calcularFolhaColaborador(c, ano, periodo)`) chama `buscarTetoPorPeriodo`
quando `periodo` é informado, garantindo que cada mês processado use o teto
contratualmente vigente — não o teto atual do cadastro. Pro_labore ignora o
histórico (motor lê `salario_base` direto).

Os campos `salario_teto_cargo` / `liquido_acordado` no documento do colaborador
permanecem como **espelho da entrada mais recente** (maior vigência), para
exibição rápida em listagens. A UI sincroniza esses campos automaticamente
ao adicionar/remover entradas no histórico.

### Interface CustoIndireto

```typescript
interface CustoIndireto {
  descricao_custo: string;   // mapeado de 'categoria_dre' no Excel
  valor_mensal: number;
  tipo_custo: 'geral' | 'juridico' | 'conciliacao';  // mapeado de 'natureza' no Excel
  // 'geral'       → rateado entre clientes com custo_direto > 0
  //                  clientes pure asset (receita_fee = 0) são EXCLUÍDOS
  //                  base: proporcional ao custo direto
  // 'juridico'    → rateado entre clientes com utiliza_servico_juridico = true
  //                  base: campo peso_juridico (default 1.0, editável)
  // 'conciliacao' → rateado entre clientes com utiliza_conciliacao = true
  //                  E volume_movimentos_mes > 0
  //                  base: proporcional a volume_movimentos_mes
}
```

### Interface Vinculo (Fase 2.5 — Peça 1)

Alocação cliente↔colaborador como **entidade própria**, em
`fechamentos/{periodo}/vinculos/`. Substitui (em construção) os 6 campos de
função + `pct_*` que viviam no documento do cliente. Plano completo em
`galacticos-cfo/docs/fase-2.5-vinculos-plano.md`.

```typescript
interface Vinculo {
  id?: string;                     // docId quando lido — opcional em memória
  periodo: string;                 // 'YYYY-MM' ou literal 'SANDBOX'

  // Referências por id_estavel (Decisão 3 — nunca por nome)
  id_estavel_colaborador: string;
  id_estavel_cliente: string;

  // Nomes denormalizados (conveniência — fonte canônica em *_base/)
  nome_colaborador: string;
  nome_cliente: string;

  funcao: FuncaoAlocacao;          // uma das 6 funções
  pct: number;                     // fração decimal (ex: 0.12)

  origem: string;                  // 'migracao_fase_2_5' | 'sandbox' | 'manual' | …
  data_criacao: string;            // ISO timestamp
}
```

**docId determinístico:** `{slug_colab}_{slug_cli}_{funcao}` — exemplo
`arthur_cruvinel_kevin_santos_lopes_consultoria_gestao`. O mesmo trio
(colaborador, cliente, função) nunca gera dois vínculos no período.

**Granularidade:** um vínculo por combinação colab×cli×função×período. Um
cliente atendido integralmente pode ter até 6 vínculos no período (um por
função).

**Pure Asset não gera vínculos.** Clientes com `pacote_servico='asset_only'`
não consomem horas de CFO — `pct_*` é zero por definição. O motor de
migração (Peça 2) deve pular esses clientes; UI de alocação (Peça 6) não
deve permitir cadastro de vínculo apontando para eles.

**Período `SANDBOX`:** `fechamentos/SANDBOX/vinculos/` é período de teste,
não processado pelo motor. Usado para validar estrutura sem risco a dados
de produção.

### Interface PerfilComplexidade

Drivers de complexidade fixos (perenes) por cliente, salvos em
`clientes_base/{slug}.perfil_complexidade`. Volumetria mensal
(`volume_movimentos_mes`, `qtd_recebiveis_mes`, `qtd_contratacoes_mes`)
NÃO está aqui — vive em campos top-level do `Cliente` do período em
`fechamentos/{periodo}/clientes/{id}` para evitar duplicação.

```typescript
interface PerfilComplexidade {
  // Volumetria estrutural (raramente muda)
  grupos_financeiros: number;          // CPF/CNPJ/outros (default 1)

  // Patrimônio
  qtd_veiculos: number;
  qtd_imoveis: number;
  qtd_funcionarios_domesticos: number;

  // Serviços contratados
  planejamento_tributario: boolean;
  revisao_contratos: boolean;          // alerta se cliente sem pacote jurídico
  gestao_obra: boolean;                // alerta se ativo sem cobrança (fee = 0)
}
```

### Interface HorasReaisCalculadas

Saída de `calcularHorasReais(cliente, perfil)`. Distribui horas estimadas
do mês por função aplicando o catálogo de `ATIVIDADES_SERVICO` aos drivers
do perfil + volumetria do Cliente.

```typescript
interface HorasReaisCalculadas {
  por_funcao: Record<FuncaoAlocacao, number>;
  total: number;
  alertas: string[];
  detalhes: Array<{
    atividade: string;
    horas: number;
    funcao: FuncaoAlocacao;
    driver_valor: number;
  }>;
}
```

### ATIVIDADES_SERVICO

Catálogo de atividades com horas-base e driver, em
`utils/atividadesServico.ts`. Fonte: R9_Modelo_Precificação (Galácticos 2024).
Cada atividade aponta para uma `FuncaoAlocacao` e define como escala:

| Driver | Comportamento |
|---|---|
| `fixo` | horas constantes, independente de volume |
| `boolean` | flag liga/desliga (`boolean_campo` aponta para `PerfilComplexidade`) |
| `vol_movimentos` | escala por `cliente.volume_movimentos_mes ÷ driver_base` |
| `qtd_veiculos` / `qtd_imoveis` / `qtd_func_domesticos` | escala linearmente por contagem do `PerfilComplexidade` |
| `qtd_recebiveis` / `qtd_contratacoes` | escala linearmente por volumetria mensal do `Cliente` |
| `grupos_financeiros` | reservado — sem atividade ativa hoje |

**`gestao_obra` é tratado FORA do catálogo** — não tem horas-base normativas;
gera apenas alerta de cobrança quando ativo sem fee. A atividade `fluxo_caixa`
tem fórmula especial (`volume × 0,5min ÷ 60`), não usa `horas_base`.

### Vínculos cliente↔colaborador (Fase 2.5)

A alocação cliente↔colaborador vive em `fechamentos/{periodo}/vinculos/`,
com um documento por combinação `(cliente, colaborador, função)` por
período. Estrutura definida em `src/types/vinculo.ts`:

- `id_estavel_colaborador`, `id_estavel_cliente`: referências estáveis
  (UUID v4). Nunca por nome.
- `funcao`: uma das 6 de `FuncaoAlocacao`.
- `pct`: intensidade da alocação (fração do tempo do colaborador
  dedicada a este cliente nesta função).
- `origem`: `'migracao'`, `'manual'`, `'alocacao_em_lote'`, etc.
- `docId`: `{slug_colab}_{slug_cli}_{funcao}` (slug canônico via
  `clientes_base.docId`, NÃO o UUID do snapshot em fechamentos).

**Leitura dual no pipeline (Peça 5):** `calcularCustoDireto` em
`utils/financials.custos.ts` usa `resolverColaboradorParaFuncao` para
tentar resolver `(cliente, função) → colaborador` via vínculo primeiro:
se houver vínculo com `pct > 0` para esse par, usa-o (`fonte:'vinculo'`).
Senão, cai no fallback legado — nome no campo `cliente[funcao]`, match
exato + normalizado (`fonte:'cliente'`). Ausência de `pct > 0` em todos
os vínculos significa que o fallback dispara sempre — coexistência
controlada com o modelo antigo até a Peça 6 popular pct via UI.

**Migração automática:** assim que um vínculo tem `pct > 0`, a próxima
leitura do pipeline já o usa. Não há feature flag, não há alteração de
código — o pct é o gatilho.

**UI de Alocação em Lote (Peça 6):** `useAlocacaoEmLote` lê e escreve
exclusivamente em `fechamentos/{periodo}/vinculos/`. Leitura: para cada
cliente do colaborador selecionado, match em `dadosPeriodo.vinculos` por
`(id_estavel_colaborador, id_estavel_cliente, funcao)`; quando o vínculo
tem `pct > 0`, é fonte primária — caso contrário, fallback no campo
legado `cliente.pct_${funcao}` (simétrico ao pipeline). Escrita: `salvarTodos`
faz `batch.set` em `vinculos/{docId}` com payload `{ pct }` e
`merge: true`. DocId vem do `v.id` do vínculo encontrado; cliente sem
vínculo prévio cai no fallback de construção
`${slug_colab}_${slug_cli}_${funcao}`. **Bug Arquitetural #1 fecha
lateralmente** — o docId do vínculo é determinístico, então a UI dispensa
`resolverDocIdClientePorIdEstavel` (que precisava lidar com slug vs UUID
em `clientes/`). Campos `pct_*` em `fechamentos/{periodo}/clientes/`
tornam-se **legado de leitura** — ainda são lidos como fallback pelo
pipeline (Peça 5) e como fallback pela própria UI quando o vínculo tem
`pct=0`, mas nenhuma escrita do painel toca mais esses campos.

**`buscarVinculos`** em `services/firebase.ts`: lê
`fechamentos/{periodo}/vinculos/` e retorna `Vinculo[]`. Consumida pelo
AppContext junto com clientes, colaboradores, custosIndiretos e
registrosPoupanca, e propagada para `processarPeriodo` /
`calcularCustoDireto` / `calcularDRE` via parâmetro opcional
(default `[]` para retrocompat com chamadas isoladas).

**Normalização (Peça 3 integrada):** os 5 nomes quebrados conhecidos
(Flavia Santos → Flávia Santos Romeu; Cintia Alves → Cintia De Jesus
Alves; Luiz Nerone → Luis Eduardo Nerone; Lucas Silva → Lucas Henrique;
Vinicius Rodrigues → placeholder `vinicius_rodrigues_ex`) já foram
saneados no momento da migração da Peça 2. Vínculos com
`id_estavel_colaborador = 'vinicius_rodrigues_ex'` apontam para
placeholder intencional — quando `pct > 0` for setado, o pipeline loga
warning `[CustoDireto] Vínculo com id_estavel_colaborador não encontrado`
e cai no fallback do campo do cliente. Comportamento esperado; resolver
Vinicius (cadastrar sucessor) é decisão futura.

### Interface RegistroPoupanca

```typescript
interface RegistroPoupanca {
  nome_cliente: string;
  ano: number;
  mes: number;                        // 1–12

  // Estado de quarentena (Frente 1 — correção de siglas órfãs).
  // Quando o onshore não resolve a sigla via resolverSigla, o registro é
  // gravado com status='pendente_normalizacao' + sigla_bruta_origem (código
  // de carteira bruto do PDF). Ausência de status = 'ativo' (retrocompat com
  // todos os docs pré-Frente 1). Filtro de quarentena aplicado por consumidor
  // agregador (Frente 2). DocId quando em quarentena segue o padrão atual:
  // slug(sigla_bruta_origem)_${ano}_${mes} (sem prefixo "quarentena_").
  status?: 'ativo' | 'pendente_normalizacao';
  sigla_bruta_origem?: string;

  // Valores em BRL
  pl_onshore: number;
  pl_offshore: number;
  pl_total: number;

  // Valores offshore originais (para decomposição cambial)
  pl_offshore_usd?: number;           // PL em USD (fonte: lâminas dos custodiantes)
  ptax_fechamento?: number;           // PTAX BCB venda, último dia útil do mês

  // Movimentação
  aporte_mes_onshore: number;
  aporte_mes_offshore: number;
  aporte_mes_total: number;

  // Rentabilidade
  rentabilidade_onshore?: number;
  rentabilidade_offshore?: number;
  rentabilidade_total?: number;
  rentabilidade_pct?: number;

  // Metas
  sem_capacidade_poupanca: boolean;
  capacidade_poupanca_mensal?: number;
  meta_poupanca_mensal?: number;      // default: 50% da capacidade
}
```

### Quarentena de siglas órfãs (correção estrutural 2026-05)

Antes da correção, os dois fluxos onshore de import (single-period e
multi-período) tinham lookup inline de sigla→cliente que ignorava o
mapeamento canônico — quando a sigla não era encontrada, o fluxo gravava
um cliente fantasma com a sigla bruta (ou nome bruto do PDF) como
`nome_cliente`, contaminando AUM/NNM/rebate. O offshore já tinha proteção
correta (modal `ResolverSiglasModal` pausando o upload). A correção
estendeu paridade ao onshore com um modelo diferente:
**"importar e reconciliar depois"** (não pausar, marcar e seguir).

**Modelo:**

1. **Resolução canônica** (Frente 1) — onshore agora usa `resolverSigla`
   (`features/poupanca/import/parsers/parseComClaude.ts`) + fallback em
   `mapeamento_siglas/` (Firestore), idêntico ao offshore.
2. **Quarentena** — quando a sigla não resolve, o registro é gravado em
   `poupanca/{slug(sigla_bruta)}_{ano}_{mes}` com
   `status: 'pendente_normalizacao'` e `sigla_bruta_origem: <código bruto>`.
   `nome_cliente` fica vazio (encerra o vetor de geração de fantasmas).
   **DocId NÃO usa prefixo `quarentena_`** — preserva "Nunca alterar
   docId" (Opção D1 do plano): ao normalizar, só o conteúdo muda.
3. **Filtro nos consumidores** (Frente 2) — 7 consumidores agregadores
   filtram `status !== 'pendente_normalizacao'`:
   `usePoupanca`, `aumIntegration`, `buscarRegistrosPoupancaPorPeriodo`,
   `usePatrimonioCrud`, `useAgenteValidacao`, `GerenciarDados`,
   `Configuracoes.corrigirEntradaOffshore`. **AppContext herda proteção**
   via `aumIntegration` (Pure Asset synthesis) e
   `buscarRegistrosPoupancaPorPeriodo` (rebate no DRE).
4. **Banner persistente** (Frente 3) — `BannerQuarentena` em
   `features/poupanca/import/` é renderizado pela tela de upload
   (`ImportPoupanca.tsx`) sempre que o último upload tenha gerado
   pendências. Sem dismiss manual: some sozinho quando o `Set<string>`
   `siglasQuarentenaOnshore` (exposto pelo hook `useImportPoupanca`)
   esvaziar.
5. **Normalização** — feita em **Configurações → Manutenção → "Corrigir
   Nomes em Poupança"** (`corrigirNomeClientePoupanca` em `firebase.ts`).
   A função casa em `nome_cliente` OU em `sigla_bruta_origem` (campo
   novo). Ao normalizar um registro em quarentena, também remove `status`
   e `sigla_bruta_origem` (deleteField). Operação por sigla, não por
   documento — N meses do multi-período saem juntos da quarentena.

**Implicação prática:** registros em quarentena ficam em **limbo
controlado** — preservam o dado original, ficam visíveis na fila admin
do banner, mas não distorcem nenhum agregado financeiro até serem
normalizados. Ausência do campo `status` = registro ativo (retrocompat
total com docs pré-correção).

---

## Constantes Financeiras (utils/constants.ts)

```typescript
// ── HORAS PRODUTIVAS CLT ──────────────────────────────────────────────────
// Base: regime CLT, 44h semanais, 52 semanas/ano
// Carnaval: ponto facultativo adotado pela Galácticos (seg + ter)
// Feriados municipais: SP (25/jan, 09/jul) e RJ (20/jan, 23/abr)
// Metodologia auditável — ver aba Metodologia em Configurações

export const SEMANAS_ANO = 52;
export const HORAS_SEMANAIS_CLT = 44;
export const HORAS_DIA_UTIL = HORAS_SEMANAIS_CLT / 5;                   // 8,8h

// Férias: 30 dias corridos × (44h ÷ 7 dias) = 188h
export const HORAS_FERIAS_ANO = HORAS_SEMANAIS_CLT * (30 / 7);          // ~188h

// Feriados por localidade (nacionais + municipais + carnaval)
// Nacionais: 11 | Municipais SP: 2 | Municipais RJ: 2 | Carnaval: 2
export const FERIADOS_POR_LOCALIDADE: Record<string, number> = {
  SP: 15,   // 11 nacionais + 2 municipais (25/jan, 09/jul) + 2 carnaval
  RJ: 15,   // 11 nacionais + 2 municipais (20/jan, 23/abr) + 2 carnaval
};

export const HORAS_BRUTAS_ANO = SEMANAS_ANO * HORAS_SEMANAIS_CLT;       // 2.288h

// Horas produtivas por localidade
export const HORAS_PRODUTIVAS_POR_LOCALIDADE: Record<string, number> = {
  SP: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO
      - (FERIADOS_POR_LOCALIDADE.SP * HORAS_DIA_UTIL),                  // ~1.968h
  RJ: HORAS_BRUTAS_ANO - HORAS_FERIAS_ANO
      - (FERIADOS_POR_LOCALIDADE.RJ * HORAS_DIA_UTIL),                  // ~1.968h
};

export const HORAS_PRODUTIVAS_MES_POR_LOCALIDADE: Record<string, number> = {
  SP: HORAS_PRODUTIVAS_POR_LOCALIDADE.SP / 12,                          // ~164h
  RJ: HORAS_PRODUTIVAS_POR_LOCALIDADE.RJ / 12,                          // ~164h
};

// Compatibilidade: HORAS_CLT_MES mantido para uso em HORAS_PACOTE
// Para custo/hora usar HORAS_PRODUTIVAS_POR_LOCALIDADE
export const HORAS_CLT_MES = 168;

// ── PACOTES DE SERVIÇO ─────────────────────────────────────────────────────
// Horas de referência normativa por função para cada pacote.
// Usadas exclusivamente para calcular o indicador de escopo (fator_):
//   pct_normativo = horas_pacote[funcao] / HORAS_CLT_MES
//   fator = pct_dedicado_real / pct_normativo
// NÃO são a base do cálculo de custo direto — esse usa pct_ × custo_total_mensal.
// Fonte: planilha de Processos e Atividades (Galácticos Capital, 2024)
// Revisão: conforme redesenho de produto — não alterar sem decisão formal.

export const HORAS_PACOTE: Record<PacoteServico, Record<FuncaoAlocacao, number>> = {
  full: {
    consultoria_gestao:       16,   // gestão estratégica, reuniões, emergências
    consultoria_planejamento:  4,   // coordenação financeira (CFO)
    consultoria_financeira:   20,   // supervisão financeira, jurídico, fiscal
    operacional_financeiro:   36,   // pagamentos, recebíveis, conciliação
    serv_adm:                 20,   // docs, veículos, imóveis, fornecedores
    serv_aux_adm:              8,   // apoio administrativo
  },                                // total: 104h ≈ 103h catálogo original
  advanced: {
    consultoria_gestao:       10,
    consultoria_planejamento:  2,
    consultoria_financeira:   12,
    operacional_financeiro:   22,
    serv_adm:                 12,
    serv_aux_adm:              4,
  },                                // total: 62h ≈ 60h catálogo original
  light: {
    consultoria_gestao:        6,
    consultoria_planejamento:  1,
    consultoria_financeira:    6,
    operacional_financeiro:    8,
    serv_adm:                  4,
    serv_aux_adm:              0,
  },                                // total: 25h ✓
  future: {
    consultoria_gestao:        4,
    consultoria_planejamento:  1,
    consultoria_financeira:    3,
    operacional_financeiro:    2,
    serv_adm:                  0,
    serv_aux_adm:              0,
  },                                // total: 10h (cliente em desenvolvimento)
  asset_only: {                     // pure asset (rebate-only) — sem horas de CFO
    consultoria_gestao:        0,
    consultoria_planejamento:  0,
    consultoria_financeira:    0,
    operacional_financeiro:    0,
    serv_adm:                  0,
    serv_aux_adm:              0,
  },                                // total: 0h ✓
} as const;

export type PacoteServico = 'full' | 'advanced' | 'light' | 'future' | 'asset_only';

// ── ALÍQUOTAS TRIBUTÁRIAS ─────────────────────────────────────────────────
export const ALIQUOTAS = {
  presumido: {
    faturamento: 0.0865,   // PIS/COFINS/ISS
    lucro: 0.0768,         // IRPJ+CSLL (base presumida 32% × 24%)
  },
  real: {
    faturamento: 0.1425,   // PIS/COFINS não-cumulativo + ISS
    lucro: 0.34,           // IRPJ+CSLL sobre lucro real positivo
  },
} as const;

export const FATOR_TRIBUTARIO_RECEITA = 0.8367;  // 1 - (0.0865 + 0.0768)

export const REBATE_DEFAULT = {
  taxa_onshore: 0.006,     // 0,60% a.a.
  taxa_offshore: 0.006,    // 0,60% a.a.
  split_plataforma: 0.5,   // Galácticos retém 50%
} as const;

export const BATCH_LIMIT = 400;     // margem sobre limite de 500 do Firestore

export const PLR = {
  percentual: 0.30,
  provisionamento_mensal: 0.30 / 12,
} as const;

export const TETO_SALARIAL_PAGAMENTO_MESES = [2, 8];  // Fev e Ago

// ── PRECIFICAÇÃO (proposta/orçador) — em Parametros, editáveis em Configurações ──
// Não entram no motor de custo/DRE; alimentam calcularFee e precificarLinhaCalculada.
export const OVERHEAD_RATIO_REFERENCIA_DEFAULT = 1.3116;  // razão de referência (período validado)
export const MARGEM_ALVO_DEFAULT = 0.25;                 // 25% — margem EBITDA alvo do fee
export const CUSTO_HORA_JURIDICO_DEFAULT = 82.88;        // jurídico consultivo (salário-hora cru)
export const TEMPO_DEMANDA_JURIDICA_HORAS_DEFAULT = 2.5; // horas por demanda jurídica
// PARAMETROS_DEFAULT.extraordinario: faixas R$/% por tipo (jurídico cravado;
// ma/valuation/viabilidade nascem zerados) + textos-padrão do serviço
// (descricao_padrao/prazo_padrao/dependencias_padrao) — ver FaixaExtraordinario.
```

### Metodologia — Horas Produtivas CLT

Card auditável exposto na aba **Metodologia** em Configurações.

Feriados considerados por localidade:

- **SP**: 11 nacionais + 2 municipais (25/jan Aniversário SP, 09/jul Revolução
  Constitucionalista) + 2 carnaval (seg + ter, ponto facultativo adotado pela
  Galácticos) = **15 feriados → 132h/ano**
- **RJ**: 11 nacionais + 2 municipais (20/jan São Sebastião, 23/abr São Jorge)
  + 2 carnaval = **15 feriados → 132h/ano**

Cálculo:

```
HORAS_BRUTAS_ANO   = 52 semanas × 44h = 2.288h
HORAS_FERIAS_ANO   = 44h × (30 / 7) ≈ 188h
HORAS_FERIADOS_ANO = 15 × 8,8h = 132h

HORAS_PRODUTIVAS_ANO = 2.288 - 188 - 132 = 1.968h (~164h/mês)
```

---

## Pipeline de Processamento — Custo Direto

O cálculo de custo direto por cliente usa o **modelo de percentual de dedicação**.
A partir do redesenho de 2026, **`pct_*` é calculado automaticamente** por
distribuição proporcional das horas normativas dos pacotes dentro do
`percentual_alocavel` do colaborador. O usuário pode fazer **override manual**
por cliente — o painel "Alocação em Lote" trava o valor e redistribui o
restante proporcionalmente.

```
pct_distribuido[cliente] = (horas_norm[cliente] / Σ horas_norm)
                         × percentual_alocavel
// Σ pct_distribuido = percentual_alocavel  (100% da folha alocável capturada)

// horas_disponiveis = horas produtivas da localidade DISPONÍVEIS PARA CLIENTES.
// horasProdutivasMes(colab) já aplica essa escala (não o tempo integral).
horas_disponiveis = horas_produtivas_mes × percentual_alocavel

fator_sobrecarga = horas_disponiveis / Σ horas_norm   (POR colaborador)
  // < 1.0 → colaborador não consegue atender no nível dos pacotes
  // ≥ 1.0 → capacidade suficiente

capacidade_livre = horas_disponiveis − Σ horas_norm
  // > 0 → pode absorver novos clientes
  // < 0 → em sobrecarga
```

> **Dois conceitos de "fator" (histórico — nenhum é exibido como régua de tier hoje):**
>
> - **`fator_escopo`** (POR cliente × função) — `pct_real / pct_normativo`.
>   `calcularFatoresEscopo` ainda existe no motor, mas o indicador foi **removido
>   da UI** (Frentes 1-3) e a saída na DRE é dead code (ver "Indicador de escopo
>   por cliente — REMOVIDO"). Não julgar cliente contra o tier.
>
> - **`fator_sobrecarga`** (POR colaborador) — `horasProdutivasMes / Σ horas`.
>   Na Frente 2 a base do denominador passou de `HORAS_PACOTE` para a demanda de
>   VOLUME (`horasBaseClienteFuncao` — horas reais quando há perfil). Na Frente 3
>   a vista de capacidade-livre-por-colaborador **saiu da Alocação em Lote** e foi
>   realojada no **módulo Capacidade** (`useCapacidade.capacidadeLivrePorColaborador`,
>   vista provisória).
>
> Os campos legacy `fator_*` no tipo `Cliente` permanecem na interface apenas
> para retrocompatibilidade do histórico; nenhum código atual escreve esses campos.

Persistência: o motor lê `pct_*` salvo em `fechamentos/{periodo}/clientes/{id}`.
A sugestão automática só vira efetiva no DRE depois que o usuário clica
**Salvar Alocação** no painel "Alocação em Lote".

> **Base da distribuição — horas reais quando disponíveis.**
> `calcularPctDistribuido` usa as horas-base de cada cliente para ratear o
> `percentual_alocavel`. A escolha da base é por presença do objeto:
>
> - Cliente **com** `perfil_complexidade` salvo (objeto presente em
>   `clientes_base/{slug}`) → usa `calcularHorasReais(cliente, perfil)
>   .por_funcao[funcao]`. Reflete a complexidade real estimada do mês.
> - Cliente **sem** `perfil_complexidade` → fallback para
>   `HORAS_PACOTE[pacote][funcao]` (comportamento histórico, retrocompatível).
>
> O gate é por **presença do objeto**, não por valores específicos — evita
> zerar pct_* de clientes que ainda não tiveram o perfil configurado.
> Implementação: `horasBaseClienteFuncao` em `financials.alocacao.ts`.

### Cálculo do custo total do colaborador

`calcularFolhaColaborador(colaborador, ano = ANO_FOLHA_VIGENTE, periodo?)`
em `financials.custos.ts`. Branching por `tipo_vinculo`. CLT usa tabelas
progressivas de INSS/IRRF do ano vigente (`TABELA_INSS`, `TABELA_IRRF`,
`REDUTOR_IR_2026`).

> **Histórico de reajustes (CLT).** Quando `periodo` é informado, o motor
> chama `buscarTetoPorPeriodo` para resolver `salario_teto_cargo` e
> `liquido_acordado` da entrada vigente em `historico_reajustes`. Isso
> garante que períodos passados sejam reprocessados com o salário
> contratualmente correto da época, e não com o teto atual. Sem histórico
> → fallback automático para os campos diretos (retrocompatibilidade).
> O `AppContext` passa `periodoSelecionado` ao recalcular a folha.

**CLT — fluxo completo com complemento PLR:**

```typescript
// 1. INSS progressivo sobre o teto CLT (4 faixas; teto previdenciário
//    natural quando teto > último ate da tabela)
const inss = calcularINSS(salario_teto_cargo, ano);

// 2. IRRF sobre (teto − INSS − dependentes × R$ 189,59)
const irrf = calcularIRRF(salario_teto_cargo, inss, qtd_dependentes, ano);
// Em 2026 aplica-se redutor adicional: REDUTOR_IR_2026.formula(teto)
// (zero p/ rendas > R$ 7.350)

// 3. Líquido que o teto geraria
const liquido_do_teto = salario_teto_cargo − inss − irrf;

// 4. Complemento PLR fecha a diferença até o líquido acordado
const complemento_plr = max(0, liquido_acordado − liquido_do_teto);

// 5. Reflexos do PLR (13º proporcional + 1/3 férias):
//    13º   = complemento_plr / 12
//    Férias= (complemento_plr / 12) / 3
//    Total = complemento_plr / 12 × 4/3 ≈ complemento_plr / 12 × 1,3333
const reflexos_plr_mensal = (complemento_plr / 12) × (4 / 3);

// 6. Encargos patronais sobre o teto CLT (não sobre PLR):
const encargos_patronais   = salario_teto_cargo × 0,28;
const decimo_terceiro_ferias = (salario_teto_cargo / 12) × (4 / 3);

// 7. Custo total mensal
custo_total_mensal =
  salario_teto_cargo + beneficios_fixos + encargos_patronais
  + decimo_terceiro_ferias + complemento_plr + reflexos_plr_mensal;
```

**Pro_labore — sem PLR/13º/férias:**

```typescript
const encargos_patronais = salario_base × 0,20;  // só INSS patronal
custo_total_mensal       = salario_base + beneficios_fixos + encargos_patronais;
```

### Cálculo do custo/hora

```typescript
// Anualiza o custo mensal e divide pelas horas produtivas da localidade.
const horasProdutivas = HORAS_PRODUTIVAS_POR_LOCALIDADE[colaborador.localidade ?? 'SP'];
custo_hora = (custo_total_mensal × 12) / horasProdutivas;
```

### Tabelas Previdenciárias

`TABELA_INSS`, `TABELA_IRRF`, `REDUTOR_IR_2026`, `DEDUCAO_DEPENDENTE_IRRF` e
`ANO_FOLHA_VIGENTE` ficam em `utils/constants.ts`. **Atualizar todo janeiro**
quando a Receita Federal e a Previdência publicam as novas tabelas.

- Fontes: Portaria MPS (INSS) + Receita Federal (IRRF e redutor 2026)
- INSS: 4 faixas progressivas terminando no teto previdenciário; salários
  acima do último `ate` resultam naturalmente no INSS-teto, **sem faixa
  Infinity** (que duplicaria 14% acima do teto e violaria o teto)
- IRRF: 5 faixas progressivas com dedução por faixa e dedução por dependente
- Redutor IR 2026: isenção até R$ 5.000/mês com transição até R$ 7.350

### Fórmula principal

```typescript
// Para cada função alocada ao cliente:
const pctDedicado  = cliente[`pct_${funcao}`] ?? 0;
// Ex: 0.12 = gestor dedica 12% do tempo a este cliente

const custoFuncao  = colaborador.custo_total_mensal
                   * colaborador.percentual_alocavel   // fração do tempo disponível para clientes
                   * pctDedicado;                      // fração alocada a este cliente especificamente

// Custo direto total do cliente
const custoDireto = Σ(custoFuncao por função);

// Pure asset (receita_fee = 0): custoDireto = 0 por definição
// Não participam do rateio de custos indiretos gerais
```

### Indicador de escopo por cliente — REMOVIDO da UI (Frentes 1-3)

O antigo "indicador de escopo" (`fator = pct_dedicado / pct_normativo`, com
`pct_normativo = HORAS_PACOTE / HORAS_CLT_MES`) e o alerta visual `fator > 1.0` na
Alocação **foram removidos de todas as telas** (Caminho 1: o pacote é RÓTULO do
catálogo de serviços, não régua para julgar o cliente individual).
`calcularFatoresEscopo` (`financials.custos.ts`) permanece como **dead code
pré-existente** — ainda chamado por `financials.dre.ts` produzindo campos
(`fatores_escopo`/`algum_fator_acima_limite`) que **nenhum consumidor lê**. Não é
mais exibido.

O que vale hoje para julgar carga:
- **Matriz de excesso por CARTEIRA** (aba Capacidade,
  `useCapacidade.excessoPorColaborador`): só clientes com VÍNCULO (pct>0) na função
  principal do colaborador; compara REAL (`horasReaisPorCliente`, pct × 164) vs
  ESPERADO (demanda de VOLUME via `calcularHorasReais`) — não o tier.
- **Base de horas única:** `horasReaisPorCliente(pct) = pct × 164`
  (`financials.alocacao.ts`). `HORAS_PACOTE`/`HORAS_CLT_MES` (168) sobrevivem só em
  planejamento de capacidade e estimativa de prospect.

### Validação de sobrecarga por colaborador

```typescript
// A soma dos pct_* de todos os clientes de um colaborador
// deve ser ≤ percentual_alocavel do colaborador
const somaPctClientes = Σ(pct_[funcao] de todos os clientes atendidos pelo colaborador);
const sobrecarga = somaPctClientes > colaborador.percentual_alocavel;
// true → alerta: colaborador com mais clientes do que capacidade declarada
```

### Métricas de capacidade por função

```typescript
// Capacidade total disponível (em % de tempo) por função
const capacidadeTotal    = Σ(colaborador.percentual_alocavel) dos colaboradores da função;
const capacidadeUsada    = Σ(pct_[funcao]) de todos os clientes ativos da função;
const capacidadeLivre    = capacidadeTotal - capacidadeUsada;
// Indica folga para absorver novos clientes por função
```

### Custo institucional → pool de indiretos

```typescript
// O custo institucional de cada colaborador NÃO vai para nenhum cliente diretamente.
// Ele entra no pool de custos indiretos gerais e é rateado entre todos os clientes
// com custo direto > 0 (pure asset excluído).

const custoInstitucional = colaborador.custo_total_mensal
                         * colaborador.percentual_institucional;

// Pool geral final = Σ(itens tipo_custo='geral' do Firestore)
//                  + Σ(custoInstitucional de todos os colaboradores)

// Isso garante que 100% da folha seja capturada:
// - percentual_alocavel × pct_dedicado → custo direto do cliente
// - percentual_institucional           → custo indireto geral (rateado)
// Prova: percentual_alocavel + percentual_institucional = 1.0
//        portanto Σ(custo_direto) + Σ(custo_institucional) = custo_total_mensal ✓
```

---

## Pipeline de Processamento — Fluxo Completo

Executado a cada seleção de período (mês/ano):

1. **Busca paralela** das collections do período (`Promise.all`):
   - `fechamentos/{periodo}/clientes`
   - `fechamentos/{periodo}/colaboradores`
   - `fechamentos/{periodo}/custosIndiretos`
   - `poupanca/` filtrado por ano/mês do período
   (`RegistroPoupanca` é a fonte de PL para cálculo de rebate)
2. **Custo direto por cliente** via modelo de percentual de dedicação (ver seção acima)
   - Captura apenas a fração `percentual_alocavel × pct_dedicado` do custo do colaborador
   - Pure asset (`receita_fee = 0`): custo direto = 0, excluídos do rateio geral
3. **Custo indireto institucional** calculado dinamicamente a partir da folha
   - Para cada colaborador: `custo_institucional = custo_total_mensal × percentual_institucional`
   - Somado ao pool de custos indiretos gerais antes do rateio
   - Garante que 100% da folha seja capturada no modelo
4. **Custos indiretos rateados** por tipo (`geral` / `juridico` / `conciliacao`)
   - Pool geral = itens do Firestore com `tipo_custo='geral'` + `custo_institucional` dos colaboradores
   - Base de rateio: proporcional ao custo direto de cada cliente (pure asset excluído)
5. **Receita de rebate:**
   ```
   // PL vem do RegistroPoupanca do período — nunca do cadastro do cliente
   pl_onshore  = RegistroPoupanca.pl_onshore  ?? 0
   pl_offshore = RegistroPoupanca.pl_offshore ?? 0
   rebate = ((pl_onshore × taxa_onshore / 12) + (pl_offshore × taxa_offshore / 12))
            × (1 - aliquota_impostos_rebate) × 0.5
   // Fallback: se não existir RegistroPoupanca para o cliente no período,
   // receita_rebate = 0 (não usar PL do cadastro)
   ```
6. **Regime tributário** (selecionado via UI):
   - **Presumido:** `impostos_fat = fee × 0.0865` / `impostos_lucro = fee × 0.0768`
   - **Real:** `impostos_fat = fee × 0.1425` / `impostos_lucro = max(0, lucro_antes_IR) × 0.34`
7. **EBITDA:**
   ```
   EBITDA = receita_bruta - impostos_faturamento - custo_direto - custo_dedicado - custo_indireto_rateado
   ```
8. **PLR provisionado:** `EBITDA_acumulado_ytd × (0.30 / meses_decorridos)`
9. **Decomposição offshore** (quando `pl_offshore_usd` e `ptax_fechamento` disponíveis):
   ```
   efeito_cambial      = pl_offshore_usd(t-1) × (ptax(t) - ptax(t-1))
   efeito_rentabilidade = (pl_offshore_usd(t) - pl_offshore_usd(t-1) - nnm_usd(t)) × ptax(t)
   efeito_nnm          = nnm_usd(t) × ptax(t)
   ```

---

## Hierarquia de Funções

```typescript
export const MAPA_FUNCOES: Record<string, FuncaoAlocacao> = {
  Gestor:          'consultoria_gestao',
  Coordenador:     'consultoria_planejamento',
  Consultor:       'consultoria_financeira',
  Operador:        'operacional_financeiro',
  Administrativo:  'serv_adm',
  AuxAdm:          'serv_aux_adm',
} as const;
```

---

## Abas do Dashboard (sistema EM PRODUÇÃO)

Status conforme inventário do CFO (não inferido do código).

| Feature | Pasta | Status |
|---|---|---|
| Visão Geral | `features/visao-geral/` | **Ativo** |
| Gestores | `features/gestores/` | **Ativo** |
| Cenários | `features/cenarios/` | **Ativo** |
| Precificação (Simulador) | `features/simulador/` | **Ativo** — Reajustes + Gerador de Propostas + `calcularFee` |
| Orçador de Extraordinário | `features/extraordinario/` | **Ativo** — 3 naturezas + camada de serviço (sub-aba de Precificação) |
| Capacidade | `features/capacidade/` | **Ativo** — ocupação, matriz de excesso por carteira, absorção |
| Perfil | `features/perfil/` | **Ativo** — Alocação em Lote, Complexidade, edição de cliente |
| Colaboradores / Folha | `features/colaboradores/` | **Ativo** — folha, reajustes, alocação |
| Configurações | `features/configuracoes/` | **Ativo** — parâmetros, extraordinário, manutenção |
| Agente de Validação | `features/agente/` | **Ativo** |
| AUM & Performance | `features/poupanca/` | **Ativo** — tabela por cliente + sub-módulo Banker |
| — Sub-módulo Banker | `features/poupanca/banker/` | BankerVisao, BankerDetalhe, useBanker |
| Upload / ETL | `features/upload/` | **Ativo** — import inicial via template Excel |
| Projeção | `features/projecao/` | Placeholder |
| Pipeline | `features/pipeline/` | Placeholder |
| Matriz | `features/matriz/` | Placeholder |
| Risco | `features/risco/` | Placeholder |
| Evolução Patrimonial | `features/evolucao/` | Placeholder |
| Planejamento Patrimonial | `features/patrimonial/` | Placeholder |

---

## Mapeamento de siglas (lâminas offshore)

`src/features/poupanca/import/MAPEAMENTO_SIGLAS.ts` (hardcoded, ~440 entradas
+ `SIGLA_PARA_NOME`) é a fonte primária do parser de lâmina offshore. Em
adição, há um mapeamento Firestore em **`mapeamento_siglas/{codigoSanitizado}`**
para entradas adicionadas em runtime via UI.

Schema do doc:
```typescript
interface EntradaMapeamentoSigla {
  codigo: string;          // ex: 'E66777005'
  sigla: string;           // ex: 'RIA'
  nome_cliente: string;    // ex: 'RIA HOLDINGS LTD'
  registrado_em: string;   // ISO timestamp
  registrado_por?: string; // nome/email
  // Opcionais — populados pelo cadastro via Manutenção (cadastrarSiglaNova):
  id_estavel_cliente?: string;  // UUID v4 do cliente em clientes_base/ —
                                // permite join sem depender de nome
  criado_via?: string;          // 'manutencao_cfo' marca entradas criadas
                                // pelo fluxo "Cadastrar Sigla Nova"
  atualizado_em?: string;       // ISO — escrito por corrigirEntradaMapeamentoSiglas
}
```

**Resolução em 3 passos** (`parseOffshoreComClaude` em `parseComClaude.ts`):

1. `resolverSigla(codigo_conta)` no MAPEAMENTO_SIGLAS hardcoded.
2. `MAPEAMENTO_SIGLAS[nome_cliente]` (fallback por nome do PDF).
3. `mapeamentoFirestore[codigo_conta]` (entradas adicionadas via UI).

Se nenhum dos 3 resolver, **o item NÃO entra em `registros`** — vai para
`siglas_nao_mapeadas[]`. O hook `useImportPoupanca` pausa o upload e abre
`ResolverSiglasModal` (`src/features/poupanca/import/ResolverSiglasModal.tsx`).
Cada linha pede nome do cliente + sigla curta (sugerida pelas iniciais). Ao
confirmar, salva via `salvarEntradaMapeamento` em
`mapeamento_siglas/{codigoSanitizado}` e re-roda o parse com o mapeamento
atualizado — agora todos os códigos resolvem.

`buscarMapeamentoSiglas()` em `firebase.ts` lê toda a coleção e indexa por
`codigo` original (não o docId sanitizado). Lookup em runtime fica `O(1)`.

Cliente fantasma (parser entrava com `nome_cliente.toUpperCase()` quando o
código não estava mapeado) **deixa de existir** — a sigla nova passa pelo
modal antes de qualquer registro ser criado.

### Cadastrar Sigla Nova (Manutenção → CFO)

Para o caso onshore onde a lâmina cai em quarentena
(`status='pendente_normalizacao'`) por sigla desconhecida, o operador usa
**Configurações → Manutenção → "Cadastrar Sigla Nova"**. A função
`cadastrarSiglaNova` em `firebase.ts` faz tudo num único ato auditável:

1. Lê `clientes_base/{slug}` — aborta se cliente não existir ou se faltar
   `id_estavel` (Fase 3 incompleta).
2. Se `nomeCanonicoNovo` difere do `nome_cliente` atual:
   - Atualiza `clientes_base/{slug}.nome_cliente`.
   - Propaga para `fechamentos/*/clientes/` via
     `propagarNomeClientePorIdEstavel` (helper privado em `firebase.ts`) —
     match por `id_estavel` (não por nome), `writeBatch` em chunks de 400.
   - Chama `corrigirNomeClientePoupanca(nomeAntigo, nomeNovo)` para
     alinhar grafias antigas no histórico de `poupanca/`.
3. Cria `mapeamento_siglas/{siglaDocId(codigoCompleto)}` com `getDoc`
   antes para abortar se já existir (sem sobrescrever). Inclui
   `id_estavel_cliente` para join futuro.
4. Chama `corrigirNomeClientePoupanca(codigoCompleto, nomeNovo)` —
   encontra docs em quarentena com `sigla_bruta_origem=codigoCompleto`,
   atualiza `nome_cliente` e remove `status` + `sigla_bruta_origem`
   (`deleteField`). Docs deixam o limbo e voltam a contar nos agregados
   no próximo refresh.

DocId em `mapeamento_siglas/` segue o padrão atual (`siglaDocId(codigo)` —
`codigo` é o **código completo** como aparece na lâmina, ex: `AAE_BTG`).
Isso casa com o lookup do parser onshore (`mapeamento[codigoCarteira]`).
A sigla curta (`AAE`) fica apenas no campo `sigla`, para exibição.

Diferente de `corrigirEntradaMapeamentoSiglas` (que só edita uma entrada
existente), `cadastrarSiglaNova` é o caminho de **criação + normalização**
e não pode rodar duas vezes na mesma sigla — proteção contra sobrescrita
acidental.

#### Suporte a cliente novo no mesmo formulário

O formulário "Cadastrar Sigla Nova" também aceita cliente que ainda não
existe em `clientes_base/`. Detecção: o input de cliente dispara `onBlur`
que verifica se o nome digitado bate na lista de clientes existentes. Se
não bater, exibe bloco condicional com campos do cliente (pacote, fee,
rebates, alíquota, jurídico, conciliação, data de entrada). Equipe
(`consultoria_gestao` etc.) **fica de fora** — atribuída depois via
Alocação em Lote, alinhado ao `NovoClienteModal`.

Ao submeter no ramo "cliente novo": chama `criarClienteNovo` primeiro,
depois `cadastrarSiglaNova` usando o `slugCliente` recém-criado. Toast
unificado.

`criarClienteNovo` em `firebase.ts`:

```typescript
async function criarClienteNovo(params: {
  nomeCompleto: string;
  pacoteServico: PacoteServico;
  percentualRebateOnshore: number;    // decimal (já /100)
  percentualRebateOffshore: number;   // decimal
  aliquotaImpostosRebate: number;     // decimal
  receitaFee: number;                 // 0 se asset_only
  utilizaServicoJuridico: boolean;
  utilizaConciliacao: boolean;
  dataEntrada: string;                // 'YYYY-MM'
  periodo: string;                    // 'YYYY-MM' destino do snapshot
}): Promise<{ id_estavel; slugCliente; erros }>
```

Comportamento:
1. Slug = `slug(nomeCompleto)`. Uniqueness via `getDoc(clientes_base/{slug})` —
   aborta se já existir, retorna erro.
2. Gera `id_estavel = crypto.randomUUID()` (Princípio 5).
3. Monta `Cliente` com `pct_* = 0` e demais campos do formulário.
   `receita_fee = 0` se `pacote_servico === 'asset_only'`.
4. `salvarClienteBase(novo)` + `setDoc(fechamentos/{periodo}/clientes/{slug}, novo)`.

Consolida em um único helper as 2 escritas que o `NovoClienteModal` faz
inline — DRY + ponto único para futura adição de propagação cross-período
se for preciso.

## Agregação de contas por cliente (lâminas offshore)

`agregarItensPorCliente(items)` em `useImportPoupanca.ts` é aplicada ao final
de `processarArquivos`, **antes** de `setPreview` — então o usuário já vê o
resultado agregado e o save itera sem duplicatas.

**Motivo.** O `docId` no Firestore é `slugify(nome_cliente)_ano_mes`, derivado
do nome resolvido pela sigla. Quando duas contas distintas mapeiam para o mesmo
cliente (ex: `TAW019408` Andbanc + `D47226006` JP Morgan → `MLM` →
`MOISES LIMA MAGALHAES`), os dois items geram o **mesmo `docId`**. Sem
agregação, `salvarNoFirestore` dispara dois `setDoc` em paralelo via
`Promise.all` — `merge: true` **sobrescreve** campos com mesmo nome (não
soma), e a ordem de chegada é não-determinística → race condition silenciosa
em que sobra só o último a chegar.

**Estratégia de combinação:**

| Tipo de campo | Tratamento |
|---|---|
| `pl_offshore_usd`, `starting_value_usd`, `aporte_mes_offshore` (USD) | SOMA |
| `pl_onshore`, `pl_anterior`, `aporte_mes_onshore`, `rendimento_nominal_brl` | SOMA |
| `rentabilidade_offshore` (% mensal) | MÉDIA PONDERADA por `starting_value_usd` |
| `rentabilidade_onshore` (% mensal) | MÉDIA PONDERADA por `pl_anterior` |
| `dia_corte`, `ano`, `mes`, `ptax_fechamento` | mantém do primeiro (idênticos) |
| `_arquivo` | concatena ("a.pdf, b.pdf") |
| `contas_agregadas` | lista códigos das contas combinadas |

A média ponderada usa o PL **inicial** da conta como peso (base sobre a qual
o retorno foi gerado). Se o peso total for 0 (carteira nova começando do
zero), mantém a rentabilidade do primeiro item como fallback. Conversão
USD→BRL acontece downstream em `salvarNoFirestore` — a agregação trabalha
em USD para offshore e BRL para onshore, lidando com o subset de campos
preenchido em cada fluxo.

**Auditoria visual.** `PreviewItem` ganha `contas_agregadas?: string[]`. Quando
o array tem ≥ 2 elementos, `ImportPoupanca.tsx` mostra um sub-label âmbar
abaixo do nome do cliente: "↳ Agregado de N contas (TAW019408, D47226006)".
O parser offshore agora também propaga `codigo_conta` no `OffshoreResult`
para alimentar essa lista.

**Mapeamentos hardcoded de fallback.** Códigos das contas MSAL adicionados ao
`MAPEAMENTO_SIGLAS.ts` para garantir resolução mesmo sem entrada Firestore:
`TAW019408 → MLM` e `D47226006 → MLM`.

**Não está coberto** (TODO conhecido): se o mês ainda não tem entrada Firestore
e duas contas chegam com nomes brutos diferentes não cobertos pelo MAPEAMENTO,
elas vão para `ResolverSiglasModal` separadamente — o usuário precisa mapear
ambas para o mesmo cliente. Quando re-rodar, a agregação combina.

## Transferência interna entre contas do mesmo cliente

Movimentos onde o cliente apenas reorganiza patrimônio entre contas próprias
(ex: conta A offshore → conta B offshore) NÃO são poupança nem tombamento, e
não devem inflar NNM, MM6, burn rate ou projeção. Para isso há dois campos
opcionais em `RegistroPoupanca`:

```typescript
transferencia_interna_onshore?: number;   // default 0
transferencia_interna_offshore?: number;  // default 0
```

**Convenção de sinal**: positivo = saída da conta visível na lâmina, negativo
= entrada. Aceita qualquer valor numérico.

**Helper `nnmReal(r)`** em `utils/financials.ts` — fonte única de verdade do
NNM ajustado:

```typescript
nnmReal(r) = (aporte_mes_onshore + aporte_mes_offshore)
           − (transferencia_interna_onshore + transferencia_interna_offshore)
```

Usado por:
- `nnmPoupancaLiquida(r) = nnmReal(r) − nnm_tombamento` (poupança líquida).
- `mm6PorCliente.mm6_nnm_bruto` (base da capacidade esperada automática).
- `mediaNNMHistorica` (sugestão de meta global).
- `historicoMetaCumprimento.nnm` (gráficos do PoupancaMetaChart).
- `PoupancaTabela` — colunas Onshore/Offshore/Consolidado descontam transferência mês a mês.

**Não afeta**: tombamento, rentabilidade, ganho cambial, PL atual. Apenas a
conta corrente "NNM real" muda — o tombamento permanece como está e
rentabilidade segue independente.

**Preenchimento**: manual via `DetalheLinhaEdit` na aba AUM & Performance →
abrir cliente → editar mês. Dois inputs opcionais "Transferência Interna
Onshore" / "Offshore" abaixo do tombamento. Valores em branco viram `0`.
Tooltip nos inputs explica o sentido. Persistido em
`poupanca/{slug}_{ano}_{mes}.transferencia_interna_*` via `updateDoc`.

**Compatibilidade**: o campo `aporte_mes_total` (soma onshore+offshore
recomputada em runtime no `usePoupanca`) **continua sendo bruto** —
representa o cashflow original dos parsers. Apenas os consumidores acima
descontam transferência via `nnmReal`. Quem ler `aporte_mes_total` direto
continua vendo o valor pré-transferência (intencional: relatórios de
movimentação bancária precisam do bruto).

## Tombamento offshore espúrio — auditoria, correção, prevenção

**Causa raiz.** `useImportPoupanca.ts:541-555` grava `nnm_tombamento_offshore =
cashflowUsd × ptax` quando `!hasPrev && cashflowUsd > 0.01` (primeiro mês da
carteira offshore). A condição `hasPrev = false` dispara quando o doc do mês
anterior não tem `pl_offshore_usd` populado. Re-imports antigos com sequência
incompleta gravavam o tombamento; re-imports posteriores, com a sequência já
encadeada, **não tocam mais o campo** (`merge: true` preserva), deixando valor
stale por tempo indeterminado.

**Auditoria global** (script Node temporário READ-ONLY, executado pontualmente):
critério `nnm_tombamento_offshore > 5 × |aporte_mes_offshore|`. Sobre 806 docs
em 63 clientes:

- 23 docs com `nnm_tombamento_offshore > 0` (a maioria são primeiros meses
  legítimos).
- 3 docs problemáticos em 2 clientes:
  - `ademilson_braga_bispo_junior_2026_4` — R$ 20.606.134 (ratio 353×).
  - `wesley_ribeiro_da_silva_2025_4` — R$ 1.001.141 (ratio 459×).
  - `wesley_ribeiro_da_silva_2025_3` — R$ 1.001.141 (mesmo valor; doc sem
    `pl_offshore_usd` — duplicação por re-import).

Esses 3 docs foram **zerados em produção** via script temporário com sanity
check (tolerância R$ 1 entre valor encontrado e esperado da auditoria; aborto
se divergir). Resultado: 3 corrigidos, 0 abortados, valores conferidos ao
centavo antes do write.

**Correção pontual via UI.** `services/firebase.ts` expõe
`zerarCampoTombamento(docId, campo)` — read-then-write com `updateDoc({ campo:
0 })`. Não cria nem deleta o doc. Retorna `{ corrigido, mensagem }`. Caminho
não-destrutivo: se o campo já está vazio/zero, não escreve.

UI em **Configurações → Manutenção → "Zerar tombamento espúrio"** (admin only):
input do `docId` + select do campo (`nnm_tombamento_offshore` /
`nnm_tombamento_onshore` / `nnm_tombamento` legado) + botão âmbar. Toast
mostra o valor anterior que foi zerado.

**Prevenção no preview de upload.** `useImportPoupanca.ts` aplica heurística
após o parse offshore: se `|cashflow USD| > 0.5 × pl_offshore_usd`, marca
`tombamento_suspeito = true` e `tombamento_ratio` no `PreviewItem`. Sintoma:
o Claude leu a coluna errada do PDF (Ending Value como NCF). Quando esse
item cair em primeiro mês de carteira (`hasPrev=false`), o save geraria
tombamento desproporcional. `ImportPoupanca.tsx` exibe badge âmbar
`⚠ Tombamento suspeito (X×)` abaixo do nome do cliente, com tooltip
explicando o sintoma. Não bloqueia o save — pede revisão humana.

**Rede de segurança no save.** `salvarNoFirestore` agora confere `tombBrl > 5
× |aporteBrlFinal|` no momento de gravar `nnm_tombamento_offshore` e emite
`console.warn('[Tombamento] SAVE com ratio suspeito: ...')` para inspeção
pós-save. Não bloqueia (admin pode estar reimportando intencionalmente).

## Rentabilidade TWR + KPIs com média mensal (AUM & Performance)

A coluna "Rent.%" da `PoupancaTabela` usa **Time-Weighted Return** (composta
mês a mês, mesma fórmula do detalhe individual): `(1+r1)×(1+r2)×…×(1+rN)−1`.
Substitui a antiga fórmula simples `Σ rentBRL ÷ (PI + Σ NNM)` que inflava
artificialmente quando havia grandes resgates (denominador menor que a base
real exposta ao mercado).

Implementação: `twrUltimo()` em `PoupancaTabela.tsx` chama `calcularAcumulado`
(`utils/acumulado.ts`) sobre o array de retornos mensais coletado via
`pickR(r, visao, prev).rp` no mesmo loop principal — a fonte é única tanto
na tabela quanto no detalhe individual. Aplica para Consolidado, Onshore
e Offshore (Offshore ganhou TWR também — antes era média ponderada por
USD exposto).

**Ganho Cambial — distinção `null` vs `0`:**
- `null` = indisponível (cliente onshore-only, sem `pl_offshore_usd` em prev,
  ou sem `ptax_fechamento` em algum dos dois meses).
- `0` = calculado e zero (PTAX inalterada entre os dois meses).

Os exporters (`exportExcel.ts`, `exportPdf.ts`) renderizam:
- Excel: célula vazia para `null`; número (incl. zero) para valores.
- PDF: `'—'` para `null`; valor formatado para números.

**Fix do primeiro mês do intervalo:** `calcGC(sorted, regAnterior?)` aceita
o registro imediatamente anterior ao intervalo (vindo do hook como
`registroAnteriorPorCliente: Map<string, RegistroPoupanca | null>`). Sem
isso, o primeiro mês do filtro tinha `prev = null` e o ganho cambial do
mês ficava sempre 0.

**Cards consolidados (`PoupancaKpis`)** com subtítulos enriquecidos quando
`mesesNoPeriodo` e `aumInicialPeriodo` são passados:

- **AUM**: subtítulo `↑/↓ R$ X no período` (variação = AUM final − AUM
  inicial). Modo "sob gestão" mantém o split Galápagos/Legado.
- **NNM**: subtítulo `Média: R$ X/mês [· Líq.: R$ Y]` (NNM total ÷ meses).
- **Rent. Média Ponderada**: subtítulo `Média: X%/mês` (rent total ÷ meses
  — média linear simples, informativa, não-composta).

`mesesNoPeriodo` e `aumInicialPeriodo` são memos novos do hook, calculados
uma vez por filtro de período.

## MM6 — Modelo definitivo de burn rate, projeção e rebate em risco

**Janela MM6 = últimos 6 meses do HISTÓRICO COMPLETO de cada cliente**
(`todosRegistros`, não `registrosIntervalo`). Se o cliente tem menos de 6
meses, usa todos disponíveis. Implementação no helper `mm6PorCliente`
(`usePoupanca.ts`) + `useEffect` async `mm6Clientes` (precisa I/O para
buscar CDI realizado e projetado).

**Métricas MM6 por cliente** (`MM6Cliente` em `usePoupanca.ts`):

| Campo | Cálculo |
|---|---|
| `mm6_nnm_liquido` | média de `nnmPoupancaLiquida(r)` (NNM bruto − tombamento) — **base do PL projetado** |
| `mm6_nnm_bruto` | média de `aporte_mes_total` (sem subtrair tombamento) — base da capacidade auto |
| `mm6_tombamento` | média de `nnm_tombamento_onshore + nnm_tombamento_offshore` (fallback: `nnm_tombamento` legado quando dimensões = 0) |
| `mm6_rent_brl` | média de `pickR(r, 'consolidado', prev).rb` dos últimos 6 meses |
| `mm6_rent_pct` | média de `pickR(...).rp` (decimal/mês), ignora null |
| `mm6_cdi_pct` | média do CDI realizado (`buscarCDIMensal`) dos mesmos 6 meses |
| `spread` | `mm6_rent_pct / mm6_cdi_pct` (capped em [-10, +10]); 1.0 quando neutro |
| `variacao_mm6` | `mm6_nnm_liquido + mm6_rent_brl` (R$/mês) — **base do critério de burn** |
| `n_meses` | quantos meses históricos foram efetivamente usados |

**Critério de burn:** `em_burn = variacao_mm6 < 0`. Captura "movimento
patrimonial líquido" — cliente com aporte que não cobre as perdas, OU
cliente sem aporte com perdas reais. Diferente do critério antigo que só
olhava rentabilidade.

**Severidade** (`severidadeMM6` em `usePoupanca.ts`) — agora medida em
**% do PL atual** (não % de rentabilidade):

| `variacao_mm6 / pl_atual` | Severidade |
|---|---|
| `≥ 0` | `null` (sem burn) |
| `> −1%` do PL | `'leve'` |
| `> −3%` do PL | `'moderado'` |
| `≤ −3%` do PL | `'critico'` |

**Projeção mês a mês até Dez/anoFim** — compounding com CDI projetado:

```
Para cada mês t de (último_mes + 1) até Dez/anoFim:
  cdi_proj[t]  = await buscarCDIProjetado(ano, mes)   // curva SELIC Focus BCB
  rent_proj[t] = cdi_proj[t] × spread
  PL[t]        = PL[t−1] × (1 + rent_proj[t]) + mm6_nnm_liquido
```

Modelo aditivo: NNM entra todo mês como parcela linear; stock antigo
cresce pela rent. projetada (CDI × spread). Salvo no campo
`pl_projetado_por_mes[]` para drilldown e como `pl_projetado_fim_ano` para
agregação. CDI projetado vem de `services/cdiProjetado.ts` (curva SELIC
Focus do BCB; fallback SELIC = 14,25% se Focus indisponível).

**Rebate em risco (clientes em burn)** — soma mês a mês:

```
rebate_em_risco = Σ (t = próximo_mes até Dez) PL[t] × taxa_rebate × (1 − alíq) × 0.5
```

Onde `taxa_rebate = (taxa_onshore + taxa_offshore) / 2` (do
`clientes_base/`). Substitui o cálculo "fixo" antigo (que multiplicava
mediana por 12) por uma soma realista mês a mês — captura o efeito
combinado de queda de PL (por burn) + crescimento de PL (por CDI × spread)
sobre a receita futura de rebate. Só calculado para clientes em burn que
têm cadastro completo.

**Meta individual por cliente** — projeção do PL futuro USANDO a `capacidade
esperada` no lugar do `mm6_nnm_liquido`. Mesma fórmula do PL projetado, NNM
diferente:

```
PL_meta[t] = PL_meta[t−1] × (1 + CDI_proj × spread) + capacidade_esperada
```

Ponto de partida: PL atual (último mês realizado). Resultado expostos como
`meta_individual` (= PL_meta no último mês até Dez/anoFim) e
`gap_meta_individual = meta_individual − pl_projetado_fim_ano`.

**Capacidade esperada** (`capacidade_esperada`, `capacidade_fonte`):

1. **Manual** (prioridade): `regMaisRecente.capacidade_poupanca_mensal` —
   `capacidade_fonte = 'manual'`. Aceita qualquer sinal (negativo = cliente
   queima caixa esperadamente).
2. **Automática**: `mm6_nnm_bruto − mm6_tombamento` — `capacidade_fonte =
   'automatico'`. Matematicamente equivalente a `mm6_nnm_liquido`, mas
   exposto como subtração para auditoria/exibição. Quando capacidade auto =
   `mm6_nnm_liquido`, a `meta_individual` ≈ `pl_projetado_fim_ano` (gap ≈ 0).
3. **`meta_individual = null`** quando `regMaisRecente.sem_capacidade_poupanca
   = true` — o operador sinalizou explicitamente que o cliente não tem
   capacidade. `gap_meta_individual` também fica null.

**Insight**: como capacidade auto = mm6_nnm_liquido, o gap da meta individual
**só fica não-zero quando `capacidade_poupanca_mensal` está cadastrada
manualmente**. Isso é proposital — o gap reflete a diferença entre o que se
ESPERA (manual) e o que se PROJETA pela tendência histórica (mm6_nnm_liquido).

**Meta total (card)** = `metaAUM.valor` global de `config/poupanca`. Aparece
no `PoupancaKpis.tsx` no subtítulo do card de Projeção como referência
top-down ("Meta global: R$ X · Gap: ↑/↓ R$ Y"). **Não é mais distribuída
proporcionalmente por cliente** — cada cliente tem sua própria
`meta_individual`. O segundo subtítulo do card mostra
`{n_clientes_com_meta} de {n_clientes} com meta individual definida`.

**Meta NNM mensal informativa** (`meta_mensal`, `meta_fonte`) — alvo MENSAL
de NNM, distinta da meta_individual (que é PL projetado fim do ano):
manual de `meta_poupanca_mensal` quando cadastrada, senão `mm6_nnm_liquido`,
ou null se `sem_capacidade_poupanca`. Usada como tooltip no `ProjecaoModal`
e como informação na tabela MM6 NNM Líq./Mês.

**Série agregada para o gráfico** — `serieAumProjetadaMM6` agrega
`pl_projetado_por_mes` de todos os clientes por (ano, mês). Alimenta a
linha "Proj. (MM6)" do `PoupancaChart`. Quando vazia (loading inicial), o
chart cai em fallback **MM3** sobre o intervalo selecionado (extrapolação
linear da diferença média de PL — modelo legado, sem decompor NNM/rent).

**Cards e modais** (`PoupancaKpis.tsx`, `BurnRateModal.tsx`,
`ProjecaoModal.tsx`):

- **Clientes Queimando / Rebate em Risco** abrem `BurnRateModal`. Colunas:
  Cliente / PL Atual / **MM6 Rent./Mês** (BRL) / **MM6 Taxa/Mês** (%) /
  **MM6 NNM Líq./Mês** / **Variação MM6** (BRL) / PL Projetado Dez / Gap /
  Severidade. Tooltips dos headers MM6 explicam "média dos últimos 6 meses
  do histórico completo".
- **Projeção Dez/{anoFim}** (card largura dupla — `lg:col-span-2` no grid
  de 4 cols) abre `ProjecaoModal`. Subtítulo do card: gap da meta + linha
  com `MM6: N clientes · CDI × {spread médio ponderado}`. Modal mostra
  todos os clientes com colunas: Cliente / PL Atual / MM6 Rent./Mês /
  **MM6 NNM/Mês** (com badge `Manual` ou `Auto` para `meta_fonte`) /
  PL Projetado Dez / Meta / Gap / Status.

**Compatibilidade**: `variacaoPLPorCliente` (interface antiga
`VariacaoPLCliente`, baseada em mediana de `pickR.rp`) **continua
exportada** do `usePoupanca` para retrocompat de consumers que ainda
referenciam o pipeline antigo, mas **os exports `clientesQueimando`,
`rebateEmRiscoTotal`, `projecaoConsolidada` e `serieAumProjetadaMM6` agora
vêm do MM6**.

## Burn rate (legado — referência histórica)

**Critério antigo**: `taxa_media_mensal < 0`, onde
`taxa_media_mensal` é a **mediana das rentabilidades % mensais**
(`pickR(r, 'consolidado', prev).rp` por mês). Mediana e não média:
robusta a resgates pontuais que distorcem a média simples — um único mês
de queda massiva (resgate, marcação a mercado extrema) deixaria a média
aritmética irrealista, projetando PL negativo no modelo exponencial.
Mesma fonte da coluna Rent.% da tabela e do detalhe individual. Capta
**perda real de mercado** — distinto de resgates/aportes do cliente, que
reduzem PL mas não são burn.

`prev` no primeiro mês do intervalo vem de `registroAnteriorPorCliente`
(busca em `todosRegistros` o último registro antes do filtro) — corrige
offshore que precisa de PL_USD anterior para calcular `pickR` corretamente.

`usePoupanca` expõe a interface `VariacaoPLCliente` no return via 3 memos:

- **`variacaoPLPorCliente: VariacaoPLCliente[]`** — uma entrada por cliente:
  `taxa_media_mensal` (mediana das rent_pct mensais, decimal),
  `rent_brl_media_mensal` (mediana da rentabilidade BRL mensal),
  `nnm_esperado_mensal` (mediana do NNM líquido histórico ou
  `meta_poupanca_mensal` quando manual), `nnm_fonte`
  (`'manual' | 'automatico'`), `nnm_meses_historico` e
  `nnm_meses_excluidos` (auditoria do filtro de outliers), `pl_atual`,
  projeção (`pl_projetado_fim_ano`, `meses_para_fim_ano`),
  meta proporcional (`meta_aum`, `gap_meta`), classificação (`em_burn`,
  `severidade`) e `rebate_em_risco`.
- **`clientesEmBurnNovo`** — `variacaoPLPorCliente.filter(v => v.em_burn)`.
  Alimenta o `BurnRateModal` (drilldown do card "Clientes Queimando").
- **`projecaoConsolidada`** — `{ pl_total_atual, pl_total_projetado_fim_ano,
  meta_total, gap_total, meses_restantes }`. Alimenta o card "Projeção
  Dez/anoFim" e o `ProjecaoModal`. `pl_total_projetado_fim_ano` é a SOMA
  dos `pl_projetado_fim_ano` individuais (já incluindo o NNM mensal × meses
  de cada cliente).

**Cálculos:**

- `taxa_media_mensal` = **mediana** dos `pickR(r, 'consolidado', prev).rp`
  mensais (filtra null = mês sem dado de rentabilidade). Helper local
  `mediana()` em `usePoupanca.ts`. Apesar do nome herdado começar com
  "media_", o cálculo é mediana — robusto a outliers.
- `rent_brl_media_mensal` = mediana da `pickR(...).rb` mensal (todos os
  meses). Mesmo motivo: resistente a resgates pontuais.
- `prev` no `i=0` vem de `registroAnteriorPorCliente` (registro anterior ao
  intervalo) — necessário para o offshore calcular variação cambial correta.
- **`nnm_esperado_mensal`** = mediana do **histórico COMPLETO** de poupança
  líquida do cliente (`nnmPoupancaLiquida(r)` sobre `todosRegistros`, não
  só o intervalo selecionado), com filtro de outliers `>2σ` da média
  aritmética. Helper `medianaSemOutliers()` em `usePoupanca.ts` retorna
  `{ valor, kept, excluded }` para auditoria.
  - Histórico completo (não intervalo) porque queremos amostra robusta de
    aporte regular — intervalo curto distorce com eventos pontuais.
  - Filtro `|liq| > 0,01`: exclui meses fantasma e zerados antes do cálculo
    estatístico.
  - Filtro `>2σ`: descarta aporte ou resgate excepcional. `desvio = 0`
    (todos iguais) → não filtra. Filtro removeu tudo → fallback p/ mediana
    da lista original.
  - **Sobrescrita manual:** se `meta_poupanca_mensal` do último mês do
    intervalo está cadastrada, ela vira o `nnm_esperado_mensal` e
    `nnm_fonte = 'manual'`. Caso contrário, `nnm_fonte = 'automatico'`.
- **Rebate em risco:** `|rent_brl_media_mensal| × 12 × taxa_rebate_média ×
  (1 − alíquota) × 0.5`. Só calculado quando `em_burn` E o cliente tem
  cadastro em `clientes_base`. NNM esperado NÃO entra no cálculo de
  rebate em risco — é uma métrica separada de captação.
- **Projeção:**
  ```
  pl_projetado = pl_atual × (1 + max(taxa, −0.99))^meses
                + nnm_esperado_mensal × meses
  ```
  onde `meses = max(0, Dez/anoFim − último_mes_do_cliente)`. Cap em −99%
  evita PL negativo via `Math.pow`. NNM entra como parcela LINEAR (modelo
  aditivo simples — não capitaliza cada NNM mensal pelos meses restantes,
  irrelevante p/ horizontes curtos). **`pl_atual` é o PL do último mês
  realizado dentro do filtro** (ponto de partida da projeção, nunca
  recalculado a partir de tendência).
- **Meta proporcional por cliente:** `meta_aum_cliente = meta_global ×
  (pl_atual_cliente / pl_total_atual_global)` — distribui a meta global
  pelo peso atual de cada cliente. `gap_meta = pl_projetado − meta_aum`.
- **`em_burn` continua baseado APENAS em `taxa_media_mensal < 0`.** NNM
  esperado negativo (cliente histórico de resgate líquido) é informativo
  — aparece em vermelho na coluna NNM e é refletido na projeção via
  redução do `pl_projetado` — mas não dispara classificação de burn.

**Severidade do burn** (`severidadeBurn(taxa)`):

| Faixa de `taxa_media_mensal` | Severidade |
|---|---|
| `≥ 0` | `null` (sem burn) |
| `> −1%/mês` | `'leve'` (badge amarelo) |
| `−3% < taxa ≤ −1%/mês` | `'moderado'` (badge laranja) |
| `≤ −3%/mês` | `'critico'` (badge vermelho) |

**Cards e modais:**

`PoupancaKpis.tsx` tem 3 cards do bloco de burn/projeção, todos clicáveis
quando há dado relevante:

- **Clientes Queimando** → `BurnRateModal`. Subtítulo "queda média de PL".
  Colunas: Cliente / PL Atual / **Rent. Mediana/Mês** (BRL, da `pickR.rb`) /
  **Taxa Mediana/Mês** (da `pickR.rp`) / **NNM Esp./Mês** (informativa,
  com tooltip de auditoria — meses históricos e outliers excluídos) /
  PL Projetado Dez / Gap Meta / Severidade. Default ordenação
  `rent_brl_media_mensal ASC`. Headers das colunas de mediana têm `tooltip`
  via prop do `HeaderOrdenavel`.
- **Rebate em Risco** → mesmo `BurnRateModal`. Mantém fórmula histórica
  `|var_mensal| × 12 × taxa_rebate × (1 − alíquota) × 0.5`.
- **Projeção Dez/{anoFim}** → `ProjecaoModal.tsx`. Mostra `pl_projetado` em
  destaque + subtítulo `↑ R$ X acima da meta` (verde) ou `↓ R$ X abaixo`
  (vermelho) ou `Meta não definida` (cinza). Ícone `TrendingUp`/`TrendingDown`.

**`ProjecaoModal`** tem 4 cards de resumo no topo (AUM Atual / Projetado /
Meta total global / Gap), filtro rápido (Todos / Em burn / Abaixo da meta)
e tabela com TODOS os clientes. Colunas (headers ABREVIADOS com tooltip
do nome completo): Cliente / PL Atual / **Rent. MM6** / **NNM MM6** (com
badge `Manual` azul ou `Auto` cinza para indicar `meta_fonte` do alvo NNM
mensal) / **PL Proj.** / **Meta** (com badge `Manual` ou `Auto MM6` para
`capacidade_fonte` e tooltip explicando capacidade esperada × spread) /
**Gap** (= meta − projeção; verde = vai superar) / Status. Status por
cliente: `Em burn` (vermelho escuro) > `Sem meta` (cinza, quando
`sem_capacidade_poupanca`) > `Acima da meta` (verde, gap > 0) > `Abaixo
da meta` (vermelho). Default ordenação `gap_meta_individual ASC` —
clientes mais distantes da meta no topo. Subtítulo do header explica os
3 pilares (PL projetado, Meta individual, Gap).

**Largura e exportação dos modais.** `BurnRateModal` e `ProjecaoModal`
usam `Modal` com `largura="7xl"` (1280px) — elimina scroll horizontal
nas tabelas largas. O componente `Modal` (`components/ui/Modal.tsx`)
ganhou prop opcional `largura?: 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl'
| '7xl'` (default `'2xl'` — não quebra modais existentes). Headers
abreviados (Rent. MM6, Taxa MM6, NNM MM6, Var. MM6, PL Proj., Gap, etc.)
com tooltip do nome completo via `HeaderOrdenavel.tooltip`.

Ambos os modais usam `ExportButton` (dropdown Excel/PDF) em vez do botão
CSV antigo. Exporters dedicados em `utils/exporters/`:

- `exportBurnRateExcel(clientes, periodoLabel, anoFim)` →
  `burn-rate_{periodo}_{ts}.xlsx` com formatação numérica nativa
  (% como decimal Excel, BRL como `#,##0.00`).
- `exportBurnRatePdf(clientes, periodoLabel, anoFim)` →
  `burn-rate_{periodo}_{ts}.pdf` em landscape, header Galácticos
  padrão, autoTable com cores condicionais (vermelho para variação
  negativa, severidade crítica em destaque, "PL ZERADO" em vermelho
  bold).
- `exportProjecaoExcel(clientes, periodoLabel, anoFim)` —
  `projecao-aum_{periodo}_{ts}.xlsx`, mesma convenção.
- `exportProjecaoPdf(clientes, periodoLabel, anoFim, consolidado)` —
  `projecao-aum_{periodo}_{ts}.pdf`, inclui 4 KPIs no topo (AUM atual,
  projetado, meta total, gap) e tabela com status colorido.

`capacidadeNegativa` (memo legado) continua existindo como **alias derivado**
de `clientesEmBurnNovo` — `clientesQueimando.length`, `Σ |rent_brl_media_mensal|`
e `Σ rebate_em_risco`. Mantém os campos antigos do return (consumidores
legados) sem reintroduzir o critério antigo de NNM.

## Normalização de nomes (matching cross-source)

`nome_cliente` chega de fontes diferentes (`clientes_base/`,
`fechamentos/{periodo}/clientes/`, `poupanca/`, parsers de lâmina) e pode
divergir em acentos, caixa e espaços. Para casamento confiável o
**`AppContext`** e o **`aumIntegration`** normalizam por:
NFD + remoção de combining marks (`/[̀-ͯ]/g`) + UPPER + trim.

Isso garante que `"FUNDAÇÃO FENÔMENOS"` (cadastro mestre) case com
`"FUNDAÇÃO FENOMENOS"` (parser de lâmina) — sem normalização ficariam
duplicados, gerando Pure Asset fantasma.

**Atenção:** o `nome_cliente` exibido no objeto `Cliente` ainda pode ter
grafias divergentes entre `clientes_base/` e `poupanca/` — apenas o
matching é normalizado. Para corrigir grafias persistidas em
`poupanca/`, use `corrigirNomeClientePoupanca(nomeAntigo, nomeNovo)` em
`firebase.ts` (também disponível como botão admin em
**Configurações → Manutenção → "Corrigir Nomes em Poupança"** com 2 inputs).

**Correção pontual de entrada no mapeamento de siglas:** prefira usar a UI
em **Configurações → Manutenção → "Corrigir Entrada no Mapeamento de Siglas"**
(2 inputs: código + nome correto). Internamente chama
`corrigirEntradaMapeamentoSiglas(codigo, nomeNovo)` em `firebase.ts` —
sanitiza o código para o docId, faz `getDoc` para confirmar que existe,
aplica `updateDoc({ nome_cliente, atualizado_em })`. Não cria entrada
nova (retorna `{ atualizou: false, mensagem }`); o caminho normal de
criação é via `ResolverSiglasModal` (durante upload) ou
`executarMigracaoMapeamento` (one-shot inicial). Edição direta no Firebase
Console fica como fallback de último caso (ex: campo extra não exposto na UI).

## Visibilidade temporal de clientes (`data_entrada`)

Campo `data_entrada?: string` em `Cliente` (formato `'YYYY-MM'`, ex: `'2025-07'`).
Persistido em `clientes_base/{slug}` (cadastro mestre — permanente).
**Optional** para retrocompatibilidade: clientes antigos sem o campo são
sempre visíveis.

**Filtro aplicado no `AppContext` antes do motor:**

1. Após carregar `clientes` (de `clientes_base/` ou `fechamentos/{periodo}/clientes/`):
   ```typescript
   const clientesFiltrados = clientes.filter(c =>
     !c.data_entrada || (anoEnt * 12 + mesEnt) <= periodoAtual);
   ```
   Cliente com `data_entrada > periodoAtual` é removido antes do
   `processarPeriodo` — não aparece nos cálculos nem na UI.

2. **Pure Assets sintetizados também são filtrados.** Quando o AppContext
   sintetiza um Pure Asset a partir de `aumPeriodo` para clientes sem doc
   em `clientes/`, consulta um mapa `nome → data_entrada` montado a partir
   da lista bruta de `clientes` (não filtrada). Se o cadastro mestre tem
   `data_entrada > periodo`, o Pure Asset não é sintetizado — evita que o
   cliente apareça no relatório antes da entrada formal.

UI: `ClienteCard.tsx` exibe tooltip no badge de pacote no formato
`"Pacote: {pacote} · Entrada: Mmm/AAAA"` quando `data_entrada` está preenchida.

`NovoClienteModal.tsx` exige `data_entrada` (input `month` YYYY-MM nativo,
default = período selecionado). Cliente novo cadastrado em Jul/2026 só
aparece a partir desse mês — abrir Jun/2026 ou anterior não mostra.

## Cadastro de cliente (Novo Cliente)

`src/features/perfil/NovoClienteModal.tsx` — botão "Novo Cliente" no header
da aba Perfil (admin only). Campos obrigatórios: `nome_cliente`,
`pacote_servico`. Opcionais: `receita_fee`, taxas de rebate, alíquota,
flags de jurídico/conciliação. `pct_*` zerados — atribuição posterior via
**Alocação em Lote**.

Persistência: `clientes_base/{slug}` (cadastro mestre) +
`fechamentos/{periodo}/clientes/{slug}` (snapshot do período em que foi criado).
Validação de uniqueness via `getDoc(clientes_base/{slug})` antes do save —
bloqueia duplicatas (`slug` é determinístico via `clienteSlug()`).

## Exclusão de cliente

Dois níveis, ambos disparados pelo botão **Excluir** no rodapé do
`EditarClienteModal` (admin only):

1. **`excluirClientePeriodo(clienteId, periodo)`** — remove apenas
   `fechamentos/{periodo}/clientes/{id}`. Histórico em outros períodos +
   cadastro mestre permanecem. Útil para "cliente saiu da carteira em X mês"
   sem perder histórico.

2. **`excluirClientePermanente(clienteId, onProgress?)`** — varre
   `collectionGroup('clientes')` deletando o doc em todos os períodos +
   `clientes_base/{id}`. Reporta progresso por período. **Irreversível** —
   modal exige confirmação extra com aviso destacado em vermelho.

## Upload Administrativo / ETL (import inicial)

- Importação via template Excel com 5 abas: `colaboradores`, `custos_indiretos`, `clientes`, `poupanca`, `INSTRUCOES`
- Template atual: `templates_importacao_v23.xlsx` (v23 — sem `pl_*` na aba clientes, sem `fator_*`)
- Após import inicial: dados editados diretamente na plataforma
- Parser numérico trata formato brasileiro (`1.000,00`) com fallback para americano (`1,000.00`)
- Upload em lotes de 400 documentos por `WriteBatch`
- **Aba colaboradores:** validada e imutável — não alterar sem decisão explícita
- A aba `clientes` do v23 não contém `pl_onshore`, `pl_offshore`, `pl_offshore_usd`,
  `ptax_fechamento`. PL é gerenciado exclusivamente pelo módulo AUM & Performance
  (aba `poupanca` do template e collection `poupanca/`).

### Notas sobre a aba clientes (v23)

- Colunas `DEPRECATED_*_hora` removidas — modelo de horas vem de `HORAS_PACOTE`
- `pacote_servico`: define as horas-direito por função (full / advanced / light / future / asset_only)
- `pct_*`: percentual do tempo do colaborador dedicado ao cliente. Distribuição
  inicial vem do painel "Alocação em Lote" (proporcional às horas normativas);
  override manual é permitido. Pure asset: todos os `pct_* = 0`.
- `fator_*` **não consta no template v23** — nunca foi persistido. O antigo
  indicador `fator_escopo`/"alerta visual de extrapolação" foi **removido da UI**
  (Frentes 1-3); ver "Indicador de escopo por cliente — REMOVIDO".

### PTAX para conversão offshore

- Fonte oficial: BCB (moed.as / API PTAX)
- Sempre usar cotação de **venda**, **último dia útil** do mês
- PTAXs 2025 validados:

| Mês | PTAX (venda) | Último dia útil |
|---|---|---|
| Mar | 5,7422 | 31/03 |
| Abr | 5,6608 | 30/04 |
| Mai | 5,7087 | 30/05 |
| Jun | 5,4571 | 30/06 |
| Jul | 5,6021 | 31/07 |
| Ago | 5,4264 | 29/08 |
| Set | 5,3186 | 30/09 |
| Out | 5,3843 | 31/10 |
| Nov | 5,3338 | 28/11 |
| Dez | 5,5024 | 30/12 |

---

## Firebase — Configuração Obrigatória

```typescript
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp(config);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // obrigatório — rede corporativa com proxy
});
```

---

## Identidade Visual

- **Gradiente da marca:** `#0065FF → #D000BB`
- **Sidebar:** `#160F41` (azul escuro)
- **Painéis de conteúdo:** branco
- **Fonte:** Inter (substituto de fonte proprietária)
- **Logo:** SVG com gradiente oficial

---

## Autenticação e Controle de Acesso

### Estratégia
Firebase Auth (email/senha) + campo `role` no Firestore.
Implementado em abril/2026 — `AuthContext`, `LoginPage`, `PrivateRoute`.

### Perfis planejados

| Role | Descrição | Restrições |
|---|---|---|
| `admin` | Arthur Cruvinel | Acesso total + Upload + Configurações |
| `cfo` | CFO / Sócio | Todas as abas, sem Upload |
| `gestor` | Gestores de atletas | Só clientes da própria carteira |
| `visualizador` | Acesso somente leitura | Abas configuráveis por usuário |

### Estrutura de dados (Firestore)

Coleção `usuarios/{uid}`:
```typescript
interface Usuario {
  uid: string;           // Firebase Auth UID
  nome: string;
  email: string;
  role: 'admin' | 'cfo' | 'gestor' | 'visualizador';
  // Para role = 'gestor': filtrar clientes por campo
  // cliente.consultoria_gestao === usuario.nome
  // Para role = 'visualizador': lista de abas permitidas
  abas_permitidas?: string[];
  ativo: boolean;
  criado_em: Timestamp;
}
```

### Status de implementação
- [x] AuthContext com useAuth hook (`src/state/AuthContext.tsx`)
- [x] PrivateRoute que redireciona para /login (`src/features/auth/PrivateRoute.tsx`)
- [x] LoginPage com identidade visual (`src/features/auth/LoginPage.tsx`)
- [x] Sidebar com avatar, role badge e botão sair
- [ ] Aplicar filtro de carteira no AppContext para role 'gestor'
- [ ] Esconder item Upload na Sidebar para roles != 'admin'
- [ ] Configurar Firebase Auth no console (habilitar email/senha)
- [ ] Configurar Firestore Security Rules por role

---

## Deploy

Deploy via Netlify CLI direto do VS Code:

```
npm run deploy
```

Pré-requisito: netlify CLI autenticado (`netlify login`).
Push para main não precisa de nenhuma ação adicional se o auto-deploy estiver ativo no Netlify.

---

## Interfaces — Orçamento Extraordinário (`types/index.ts`)

Coleção `orcamentos/` (docId = `id_estavel` UUID). Cobrança = `ItemOrcamento`;
serviço = wrapper que agrupa cobranças do mesmo tipo.

```typescript
type NaturezaOrcamento = 'tabelado' | 'calculado' | 'success_fee';
type BaseSuccessFee = 'transacao' | 'mais_valia';

interface ItemOrcamento {          // a COBRANÇA
  tipo: TipoExtraordinario;
  descricao: string;
  natureza?: NaturezaOrcamento;    // ausente = 'tabelado' (retrocompat)
  valor: number;                   // fechado (tabelado/calculado); success_fee = 0
  clausula_pct?: number; clausula_informativa?: string;
  // calculado (esforço): horas × custo/hora + overhead + margem
  horas_por_funcao?: Record<FuncaoAlocacao, number>;
  horas_juridicas?: number; margem?: number;
  custo_direto_calc?: number; custo_total_calc?: number;
  // success_fee (condicional — não fecha)
  base_success?: BaseSuccessFee; percentual_success?: number;
  valor_base_estimado?: number; projecao_success?: number;
}

interface ServicoOrcamento {       // agrupa 1..N cobranças do MESMO tipo
  tipo: TipoExtraordinario;
  titulo?: string;                 // default = label do catálogo
  descricao: string; prazo: string; dependencias: string;  // textos-padrão, editáveis
  cobrancas: ItemOrcamento[];
}

interface DadosOrcamento {
  id?: string; id_estavel: string; criado_em: string; atualizado_em: string;
  status: 'rascunho' | 'enviado' | 'aceito' | 'recusado';
  nome_cliente: string; id_estavel_cliente?: string;
  servicos?: ServicoOrcamento[];   // fonte nova
  itens?: ItemOrcamento[];         // legado plano (retrocompat de leitura)
  valor_total: number;             // Σ fechado das cobranças
  validadeDias: number; observacoes?: string;
}
```

`FaixaExtraordinario` (em `parametros.extraordinario[tipo]`): faixas `faixa_min/max`,
`clausula_pct_min/max`, `clausula_minimo` + textos-padrão do serviço
`descricao_padrao?`/`prazo_padrao?`/`dependencias_padrao?` (nascem vazios, editados em
Configurações → Extraordinário).

---

## Estado / Roadmap — Precificação & Propostas

Estado da frente de Precificação/Propostas após o trabalho recente. NO AR =
concluído e deployado em produção; PENDENTE = backlog priorizado.

### No ar (recentemente concluído)

- **Aditivo de Escopo** — Forma 1 (delta com split sobre a base real):
  `calcularFee` extraído como função pura; `TIPO_CONFIG` por tipo de documento;
  baseline travado (read-only) com edição só nas Adições; conciliação automática
  (acompanha o movimento); selos "Novo"/"Inclui:" no documento.
- **PDF página-única via PDFShift** — Netlify Function `gerar-pdf` (formato
  `1152xauto`, `use_print:false`). Resolveu a saga de paginação A4/buracos
  brancos. Key em env var (`PDFSHIFT_API_KEY`); sandbox via `PDFSHIFT_SANDBOX`
  (default off = PDF real; setar `=true` para teste sem créditos).
- **Enriquecimentos de texto da proposta** — bloco "O Plano" dinâmico (derivado
  dos mesmos ticks dos pilares); campo `titularidades` livre; "Escopo do
  Contrato" genérico; "Limite de Volume" com tetos reais (só o principal —
  movimentações/mês); "Reajuste por Volume Excedente" com 3 parâmetros editáveis
  (`tolerancia_volume_pct`=20, `periodicidade_medicao_meses`=3,
  `valor_faixa_excedente`=500); cláusula de excedente unificada **1× só** nas
  Condições Gerais (saiu dos cards de escopo).
- **Orçador de Extraordinário** — sub-aba em Precificação. Persiste em
  `orcamentos/` espelhando `propostas/` (Princípio 1+3; docId = `id_estavel` UUID,
  idempotente). PDF reusa `gerar-pdf`. Aba **Configurações → Extraordinário** edita
  as faixas R$/% e os textos-padrão do serviço.
  - **3 naturezas de cobrança** (`ItemOrcamento.natureza`): **tabelado** (valor
    fixo, faixa editável), **calculado** (por esforço — horas por função [6 +
    jurídico] × custo/hora + overhead + margem por linha, via
    `precificacaoBase.precificarLinhaCalculada`, que REUSA as entranhas do
    `calcularFee` sem chamá-lo; NÃO toca o motor de custo/DRE), **success_fee**
    (base transação/mais-valia + % + projeção estimada — condicional, "devido no
    êxito", NÃO entra no total fechado).
  - **Camada de serviço** (`ServicoOrcamento`): agrupa 1..N cobranças do MESMO tipo
    sob um serviço com cabeçalho editável (título/descrição/prazo/dependências, dos
    textos-padrão do catálogo). M&A = composição de cobranças de naturezas mistas.
  - **Total heterogêneo:** bloco FECHADO (tabelado + calculado, em R$) separado do
    CONDICIONAL (success fees — regra + projeção). Tela e PDF coerentes por serviço.
  - Retrocompat: orçamentos salvos só com `itens[]` (pré-camada de serviço) abrem/
    renderizam como serviços de 1 cobrança.
- **Contabilidade opcional na proposta — VERSÃO EXIBIÇÃO** — campos
  `contabilidade_mensal`/`_ir`/`_fechamento`/`_tipo` (13º = mesmo valor do
  mensal). Aparece como item contratado no pilar Financeiro + cláusula nas
  Condições. Soma **só o MENSAL** no total exibido (13º/IR/fechamento são à
  parte, não-mensais, apenas mencionados). **NÃO toca `calcularFee`.** É
  paliativo — a versão integrada de verdade é da revisão de fundação (abaixo).

### Pendente (backlog/roadmap)

- **Seção de Extraordinário na proposta** (Lote B parte 2) — reusa o Orçador
  dentro do documento de proposta. Ainda não feita.
- **Observações de ajuste da proposta** — o CFO sinalizou vários pontos ao gerar
  uma proposta real; ainda não detalhados/triados.
- **REVISÃO DE FUNDAÇÃO** (frente conceitual grande — merece chat próprio):
  - **Catálogo × volume** — pacote como catálogo + fator derivado de volume (vs
    horas fixas). Explica "subatendidos" e o critério de "virar Full".
  - **Recalibração de coeficientes** — custo por movimento subavaliado; veículo
    alto; contas bancárias somam tempo e devem virar cadastro perene.
  - **Contabilidade INTEGRADA de verdade** — no catálogo/motor: PF/PJ muda as
    inclusões; mensal+13º+IR+fechamento modelados; soma ao fee REAL (não só
    exibição). Substitui o paliativo de exibição atual.
  - **Titularidades estruturadas** — capturar PF/PJ por grupo (hoje só há
    contagem em `grupos_financeiros`; o campo `titularidades` é texto livre).
  - **Métrica "recebíveis"** — hoje sem sentido claro; revisar.
- **"Virar Full" na evolução de tier** — depende do catálogo × volume.
- **Comentário stale no topo de `GeradorProposta.tsx`** — diz "EFÊMERO" mas o
  Gerador persiste (botão Salvar → `propostas/`). Corrigir quando tocar o
  arquivo.

---

## On the horizon

Itens decididos mas pendentes de implementação dependente. Não codar até as
dependências caírem — apenas reservar campos/estrutura mínima.

- **`fee_potencial` para clientes `fee_isento`**: comparar custo gerado pelo
  cliente vs fee que seria cobrado, para análise da rentabilidade do desconto
  concedido. Depende do **módulo de Propostas** para alimentação automática
  (cada proposta gera um fee de referência por pacote/perfil de cliente).
  Por ora, campo `ResultadoCliente.fee_potencial?: number` reservado e zerado
  no motor; UI ainda não consome.

- **Modelo de Perfil de Complexidade (próxima fase)**: hoje as horas de cada
  função são definidas exclusivamente pelo `pacote_servico`. O perfil de
  complexidade adiciona uma dimensão ortogonal ao pacote (ex: simples /
  padrão / complexo) que multiplica/ajusta as horas normativas para refletir
  diferenças reais entre clientes do mesmo pacote (volume de operações,
  número de empresas/contas, exposição offshore, etc.). Decisões pendentes:
  (a) onde guardar o multiplicador (campo no Cliente vs tabela separada),
  (b) granularidade (multiplicador único vs por função), (c) revisão (quem
  classifica e com que cadência). **Não codar até alinhamento formal.**
  Estrutura mínima a reservar quando começar: `cliente.perfil_complexidade?:
  'simples' | 'padrao' | 'complexo'` e `MULTIPLICADOR_COMPLEXIDADE` em
  `utils/constants.ts`.

---

## Idioma

Todo o texto da UI, variáveis, comentários e lógica de negócio em **português brasileiro**. Termos técnicos de programação permanecem em inglês quando são padrão da indústria (EBITDA, DRE, hook, commit, deploy, etc.).

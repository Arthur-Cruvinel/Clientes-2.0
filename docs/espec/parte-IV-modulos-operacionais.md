# Parte IV — Módulos Operacionais

> Um capítulo por módulo, no padrão **pergunta de negócio · conceitos · regras de
> comportamento · fluxos do usuário · validações e guardas · estados especiais ·
> exports**. Descreve regras e fluxos — não layout. O motor de cálculo está na
> Parte III; aqui está como cada tela o consome e o que o usuário faz.

**Estado do período (transversal).** Todo módulo respeita o estado do período: com
o período **aberto**, os dados vêm dos cadastros mestre e são editáveis; **fechado**,
vêm do snapshot e a edição é bloqueada (a folha é sempre recalculada na leitura).

---

## 1. Visão Geral

**Pergunta de negócio.** "Cada cliente dá lucro? Onde a casa ganha e onde perde no
período?"

**Conceitos da tela.** Tabela-DRE por cliente (uma linha por cliente) com totais no
rodapé; cards de KPI consolidados; modos de visão; visibilidade de colunas; e os
drill-downs dos três custos.

**Regras de comportamento.**
- **Modo de visão** (toggle EBITDA ↔ Margem de Contribuição). No modo EBITDA a
  coluna-resultado é o EBITDA e a coluna de indireto mostra valor; no modo Margem
  de Contribuição a coluna-resultado vira a MC e o indireto é suprimido (`—`).
- **Coluna "Mg. Contribuição"** (leitura): no modo EBITDA, exibe a contribuição
  antes do overhead rateado, após o Custo Indireto e antes de Imp. Fat. Participa do
  toggle de colunas, filtros, ordenação e do rodapé (Σ).
- **Colunas da DRE** na ordem de leitura: Cliente · Banker · Tipo · Entrada ·
  Pacote · Fee · Rebate · Custo Direto · Custo Dedicado · Custo Indireto · Mg.
  Contribuição · Imp. Fat. · EBITDA · Margem · IRPJ/CSLL · Lucro Líq. · Resultado.
- **Filtros e ordenação** por coluna; visibilidade de colunas (ocultar/mostrar);
  rodapé recalcula os totais dinamicamente sobre as linhas visíveis.

**Fluxos do usuário.**
1. **Drill-down de custo direto** — clique no valor de Custo Direto abre a
   decomposição de mão de obra (função · responsável · pct efetivo · horas · valor).
   `Σ valor das linhas ≡ custo_direto`.
2. **Drill-down de custo dedicado** — abre os componentes (contabilidade, pagamento,
   administrativo, viagem, rateio jurídico, rateio conciliação).
3. **Drill-down de custo indireto** — abre a composição do pool por categoria.
4. **Drill-down de impostos** — abre Imp. Fat. e IRPJ/CSLL.
5. **Ranking de empresários** — agrega o resultado por empresário/representante.
6. **Validar período** — abre o agente de validação (consistência dos invariantes).
7. **Fechar período / Reabrir** — congela o snapshot do período (cria
   `periodos_status`); reabrir devolve à edição.
8. **Copiar período** — replica a base de um período anterior para o corrente
   (clientes + vínculos) quando o período está vazio.

**Validações e guardas.** Fechar período exige confirmação. Copiar período é
oferecido automaticamente quando o período está vazio e o anterior tem dados.

**Estados especiais.** Período fechado → tabela em modo somente-leitura (borda
distinta). Período sem dados → aviso e oferta de cópia. Cliente sem PL → rebate 0.

**Exports.** Excel e PDF da DRE consolidada (todas as colunas incluindo Mg.
Contribuição, com totais; PDF em paisagem com cores condicionais por sinal).

---

## 2. Configurações

**Pergunta de negócio.** "Quais são os parâmetros e custos da casa, e como mantê-los
mês a mês?"

**Conceitos da tela.** Cinco seções — **Custos**, **Rebate**, **Pacotes de
Serviço**, **Colaboradores**, **Metodologia** — mais uma área de **Manutenção**
(administrador).

### 2.1 Custos por período

- **Semeadura** — um período sem as categorias canônicas pode semeá-las (as 7 de
  `CATEGORIAS_CUSTO_INDIRETO`) com valor 0; idempotente (nunca duplica).
- **Edição/upsert** — editar o valor de uma categoria existente; se a categoria
  nunca foi semeada no período, o save faz upsert no docId canônico (input aceito =
  input persistido).
- **Propagação origem→destino** — um passo de planejamento (read-only) detecta
  anomalias no destino (docs com identidade não-canônica) e as alinha **antes** de
  gravar; a execução grava as categorias canônicas casando por `id_estavel`.

**Guarda.** Reimportar a planilha do período sobrescreve estes valores (aviso
permanente). A propagação escreve sempre no período selecionado.

### 2.2 Rebate

Edita os parâmetros **globais** em `parametros/global`: taxas de rebate por perna,
alíquotas de retenção na origem por perna, `split_plataforma` e `margem_alvo`.
**Guarda:** confirmação obrigatória — as alíquotas afetam o rebate de **todos** os
clientes com PL.

### 2.3 Pacotes de Serviço

Edita a matriz `HORAS_PACOTE[pacote][função]` (full/advanced/light/future;
`asset_only` é imutável e sempre 0). Persiste em `parametros/global.horas_pacote`.

### 2.4 Colaboradores

Ciclo de vida completo:
- **Criar** — novo colaborador nasce ativo, com `id_estavel` gerado; grava no período
  ativo.
- **Editar folha** — escreve exclusivamente no período ativo; o motor recalcula a
  folha (custo total, custo/hora, encargos, PLR).
- **Propagar folha (individual)** — aplica teto/líquido **resolvidos por período**
  (respeitando o histórico de reajustes) a um conjunto de períodos (a partir de / até
  / intervalo / todos), com progresso por período.
- **Propagar folha em massa** — fixa o **snapshot** de teto/líquido do período base
  nos períodos-destino, **sem** tocar o histórico de reajustes; guarda "só para
  frente".
- **Renomear** — propaga o novo nome por `id_estavel`/nome para clientes (base e
  snapshot) e para os documentos do colaborador em todos os períodos.
- **Demissão** — `ativo:false` + `data_demissao`; o colaborador permanece no mês da
  saída e é omitido dos meses posteriores na propagação para frente.
- **Benefícios em lote** — aplica subcampos de benefícios a vários colaboradores no
  período ativo; recalcula `beneficios_fixos` (= soma) e a folha.

### 2.5 Metodologia

Cinco cartões de auditoria (somente leitura): horas produtivas por localidade;
custo/hora (base anual); regra de rateio dos três pools; custo institucional e a
composição do pool geral; perfis de cliente. Os valores derivam das constantes.

### 2.6 Manutenção (administrador)

Ferramentas pontuais: **replicar alocação** entre períodos (aditivo — não sobrescreve
`pct=0`); **corrigir nomes em poupança**; **cadastrar sigla nova** (vincula sigla a
cliente, oficializa nome canônico e tira registros da quarentena, num ato);
**corrigir entrada de sigla**; **zerar tombamento espúrio** (read-then-write em um
documento); **corrigir registros de entrada offshore**; e migrações one-shot
(clientes_base, mapeamento de siglas).

**Exports.** Não aplicável (tela de configuração).

---

## 3. Ficha do cliente (Perfil)

**Pergunta de negócio.** "Quem é o cliente, o que contrata, quem o atende e quanto
ele extrapola o pacote?"

**Conceitos da tela.** Três visões: **individual** (lista + detalhe com abas),
**atribuição em lote** (banker/empresário em massa) e **alocação em lote**
(capítulo 4). O detalhe individual tem abas: Resumo/Alocação, Configuração,
Complexidade, Cadastral e Histórico.

**Regras de comportamento.**
- **Novo Cliente** — obrigatórios: nome (uniqueness por slug), pacote, data de
  entrada (default = período corrente). Opcionais zerados: fee, taxas de rebate,
  flags jurídico/conciliação. Os `pct_*` nascem 0 (alocação posterior). Persiste em
  `clientes_base/{slug}` (com `id_estavel`) + snapshot do período.
- **Editar** — Configuração (peso jurídico, volume, taxas, flags), Cadastral
  (empresário, banker, data de entrada, fee com moeda, custos dedicados; AUM em
  somente-leitura), Histórico (auditoria de alterações).
- **Tabela de escopo** (Resumo/Alocação) — por função: **H. Pacote** (horas
  normativas do pacote), **Escopo** (`pct_real / pct_normativo`, com
  `pct_normativo = H.Pacote ÷ HORAS_CLT_MES`, `HORAS_CLT_MES = 168`) e **H. Efet.**
  (`H. Pacote × Escopo`). O `pct_real` é resolvido vínculo-first.
- **Perfil de Complexidade** — drivers perenes (grupos financeiros, veículos,
  imóveis, funcionários domésticos, planejamento tributário, revisão de contratos,
  gestão de obra) + volumetria mensal (movimentos, recebíveis, contratações). A
  tabela mostra **H. reais** (`calcularHorasReais`), **H. pacote** e **Fator de
  demanda** (`H. reais ÷ H. pacote`). Salvar dispara o motor.

**Fluxos do usuário.** Selecionar cliente → editar aba → salvar (recarrega o motor).
Cadastrar novo cliente pelo modal. Editar complexidade alimenta a estimativa de
horas reais.

**Validações e guardas.** Uniqueness de slug na criação. Revisão de contratos ativa
sem pacote jurídico e gestão de obra ativa sem fee disparam alertas.

**Estados especiais — exclusão de cliente (dois níveis, máquina de estado):**
1. **Excluir do período** — remove só o documento do período; histórico e cadastro
   mestre preservados. Se o cliente é fallback do cadastro (sem doc próprio no
   período), a operação sinaliza e redireciona para a exclusão permanente.
2. **Excluir permanentemente** — remove de **todos** os períodos + cadastro mestre;
   **irreversível**, com aviso destacado e barra de progresso por período.
A janela é bloqueada durante a execução.

**Exports.** Não aplicável.

---

## 4. Alocação em Lote

**Pergunta de negócio.** "Como distribuir o tempo de um colaborador entre seus
clientes numa função, e ele cabe na capacidade?"

**Conceitos da tela.** Por colaborador e função: lista de clientes com o `pct`
sugerido por demanda, edição com trava/redistribuição, e o painel de capacidade
(horas efetivas, sobrecarga).

**Regras de comportamento.**
- **Sugestão automática** — `pct` proporcional às horas-base dos clientes
  (`calcularPctDistribuido`), somando o `percentual_alocavel` do colaborador.
  Clientes com `pct` já existente nascem **travados** (manual); os demais recebem a
  sugestão.
- **Editar** — alterar o `pct` de um cliente trava-o e **redistribui** o restante
  entre os não-travados, preservando o total alocável.
- **Recalcular tudo** — destrava todos e reaplica a sugestão.

**Fluxos do usuário.**
1. Selecionar colaborador (e função, se houver mais de uma) — deep-link do módulo
   Capacidade pré-seleciona colaborador+função.
2. Ajustar os `pct` (trava + redistribui) ou recalcular.
3. **Salvar Alocação** — grava em `fechamentos/{periodo}/vinculos/` (fonte única),
   apenas para clientes com `id_estavel` e `pct` alterado; recarrega o motor.

**Validações e guardas.**
- **Sobrecarga** — ocupação consolidada > `percentual_alocavel` exibe aviso; **não
  bloqueia** o save.
- **Institucional com vínculo** — colaborador ~100% institucional com alocação
  dispara aviso de dupla contagem.
- **Horas efetivas / capacidade livre** — `Σ horas normativas` dos clientes vs horas
  produtivas disponíveis; `fator de sobrecarga` e flag de sobrecarga.

**Estados especiais.** Remover um cliente zera o vínculo (e o campo legado) — evita
`pct` órfão. Período fechado bloqueia a operação.

**Exports.** Não aplicável.

---

## 5. Capacidade

**Pergunta de negócio.** "A equipe dá conta da carteira? Onde está o gargalo e
quantos clientes novos cabem?"

**Conceitos da tela.** Ocupação por colaborador/função, capacidade livre,
sobrecarga, e absorção de novos clientes por pacote.

**Regras de comportamento.**
- **Ocupação** — `horas usadas ÷ horas disponíveis`, com
  `horas disponíveis = horas produtivas do mês × percentual_alocavel` e horas usadas
  por cliente/função via `pct` efetivo (vínculo-first). Faixas: ≤80% folga, 80–100%
  apertado, >100% sobrecarga.
- **Demanda** — usa `HORAS_PACOTE` por pacote/função para medir o quanto a carteira
  exige; o **fator de escopo** (`pct_real / pct_normativo`) sinaliza extrapolação.
- **Absorção** — quantos pacotes novos cabem na capacidade livre por função (gargalo
  = função mais restritiva).

**Fluxos do usuário.** Inspecionar ocupação por função; abrir **drill-down** (barra
de ocupação total + tabela por cliente: pacote, % dedicação, horas, escopo). Há um
**simulador de contratação** embutido: informar novas contratações por função →
recalcula a capacidade e o custo estimado.

**Estados especiais.** Período fechado → leitura do snapshot.

**Exports.** Não aplicável.

---

## 6. Gestores

**Pergunta de negócio.** "Cada gestor se paga? A margem da carteira cobre o custo
cheio do gestor?"

**Conceitos da tela.** Um por gestor (colaborador com vínculo de gestão e `pct>0`):
carteira, receita e EBITDA da carteira, custo alocado, fatia devolvida, margem antes
do gestor, cobertura e ocupação.

**Regras de comportamento.** A métrica de **cobertura** segue a fórmula da Parte III
(§10): `margem_antes = EBITDA_carteira + custo_alocado + fatia_devolvida`, com
devolução de 1ª ordem (custo direto do gestor já no EBITDA) e 2ª ordem
(auto-ociosidade do gestor rateada de volta à própria carteira); `cobertura =
margem_antes ÷ custo_total_mensal cheio`; **se paga** quando ≥ 100%. A aba é
**exposição** — nunca recalcula o motor.

**Fluxos do usuário.** Inspecionar a lista de gestores ordenada por cobertura; abrir
a carteira de cada gestor (clientes, EBITDA, custo alocado).

**Estados especiais.** Cliente sem gestor entra na contagem "sem gestor". Multi-gestor
é tratado como caso futuro (rateio do EBITDA por `pct`).

**Exports.** Não aplicável.

---

## 7. Precificação (rota "Simulador")

**Pergunta de negócio.** "Que fee deveria cobrar — de um cliente atual (reajuste) ou
de um prospect — para atingir a margem alvo, considerando o rebate?"

**Conceitos da tela.** Duas abas — **Reajustes** e **Gerador de Propostas** — sob
uma barra de **razão de overhead de referência** (capítulo da Parte III §9.2).

### 7.1 Reajustes (clientes existentes)

- **Dois eixos** independentes: **preço** (fee sugerido vs fee atual → sub/sobre-
  precificado) e **atendimento/staffing** (horas demanda vs horas alocadas →
  sub/sobre-atendido).
- **Fee sugerido** = `custo_total / (1 − imp.fat − margem_alvo) − rebate`. Badge por
  faixa de gap relativo à **materialidade** (editável, ex. 10%): subprecificado,
  ok, sobreprecificado, rebate cobre.
- **Filtros** combináveis (preço, staffing, pacote, status de perfil) e ordenação.
  "Dinheiro na mesa" = Σ dos gaps positivos dos subprecificados.
- **Gerar proposta (upsell)** — leva a volumetria/cadastro real do cliente para o
  Gerador (modo aditivo).

### 7.2 Gerador de Propostas

- **Prospect** (sem alocação): custo direto = `Σ horas reais × custo/hora médio`;
  overhead = `custo direto × razão de referência`; fee sugerido com a mesma fórmula.
- Campos do formulário: pacote, regime, volumetria, perfil, taxas, dedicados, nº de
  contas, validade, dia de vencimento, e os campos do template (intro, imagem,
  escopo livre).
- **Propostas persistidas** — salvar grava um **snapshot imutável** (inputs +
  outputs da época) em `propostas/`; reabrir/duplicar/mudar status/excluir.

### 7.3 Template institucional (proposta gerada)

- **Pilares e escopo derivam do mesmo dado** (fonte única de ticks): item contratado
  aparece com ✓, não contratado com `+` (vitrine); pilar com ≥1 ✓ = contratado.
  - Pilar Administrativo: contratação de serviços e viagens sempre incluídas;
    imóveis/veículos/funcionários por contagem; eventos como extra.
  - Pilar Financeiro: planejamento sempre incluído; pagamento/conciliação/fluxo por
    volume de movimentos.
  - Pilar Jurídico: por flags.
  - Pilar Investimentos: gestão, consolidação multi-custódia e relatórios sempre;
    estrutura offshore por PL offshore; M&A/viabilidade só em "Soluções Sob Demanda".
- **Escopo escrito = volumetria precificada** — cada ✓ tem um item no escrito, com os
  limites quantitativos, + cláusula de excedente.
- **Condições gerais** — validade (default 15 dias), rescisão (aviso de 30 dias;
  experiência de 3 meses), pagamento (boleto com dia de vencimento escolhido),
  excedentes.
- **Modos** — **prospect** (plano único) e **aditivo** (escopo atual + novo escopo);
  capa com imagem (alta resolução) ou capa-padrão escura com a logo central.
- **Saída** — HTML autossuficiente, impresso em PDF pelo navegador (sem rasterização
  da capa).

**Validações e guardas.** `denom ≤ 0` (margem + imposto ≥ 100%) invalida o cenário.
Recalcular a razão de referência exige confirmação e alerta divergência > 20%.
Custo de cliente existente jamais usa o modelo de demanda.

**Exports.** A proposta é o próprio artefato (HTML → PDF).

---

## 8. AUM & Performance (Poupança)

**Pergunta de negócio.** "Quanto cada cliente tem sob gestão, quanto poupou de fato,
como rende, e quem está queimando patrimônio?"

**Conceitos da tela.** Tabela por cliente (PL, NNM, rentabilidade, meta), KPIs
consolidados, sub-módulo Banker, e a importação de lâminas.

**Regras de comportamento.**
- **NNM real** — desconta a **transferência interna** (movimento entre contas
  próprias) do aporte bruto; movimentos entre contas próprias não são poupança.
- **Rent.% por TWR** — rentabilidade composta mês a mês (`Π(1 + rₜ) − 1`), por
  dimensão (onshore/offshore/consolidado).
- **Janela MM6** — médias dos últimos 6 meses do histórico completo do cliente; base
  do burn rate (variação MM6 < 0), da projeção mês a mês até o fim do ano e do
  **rebate em risco** (apenas clientes em burn com cadastro completo). As fórmulas
  detalhadas vivem na documentação do módulo (capítulo do AUM); a Parte III cobre o
  rebate.

**Fluxos do usuário — importação de lâminas.**
1. Escolher tipo (offshore/onshore) e período (offshore: mês/ano + PTAX; onshore:
   período detectado do cabeçalho).
2. Subir o(s) PDF(s); o sistema extrai os dados (parser assistido) e monta um
   **preview** com totais e badges (agregado de N contas, tombamento suspeito).
3. **Agregação multi-conta** — contas distintas que mapeiam ao mesmo cliente são
   combinadas antes de gravar: somam-se saldos/aportes/rentabilidade BRL; a
   rentabilidade % é média ponderada pelo PL inicial. Evita sobrescrita silenciosa
   (o docId é por cliente/mês).
4. **Salvar** — grava com merge por dimensão (onshore grava só campos onshore;
   offshore só offshore), preservando o que a outra perna já tinha.

**Resolução de siglas.**
- **Offshore** — sigla não resolvida **pausa** o upload num modal; o usuário informa
  cliente + sigla, salva no mapeamento e o parse re-roda.
- **Onshore** — sigla não resolvida vai para **quarentena**
  (`status='pendente_normalizacao'`, `nome_cliente` vazio); o registro é importado
  mas **não** alimenta nenhum agregado; um banner lista as pendências, normalizadas
  depois em Manutenção.

**Edição mensal manual.** Por cliente/mês: PL e aportes por dimensão, tombamento,
transferência interna, rentabilidade, metas (`meta_poupanca_mensal`,
`capacidade_poupanca_mensal`), com validações (PL ≥ 0, PTAX em faixa).

**Sub-módulo Banker.** Agrega por banker: AUM, NNM, meta, progresso, rentabilidade
ponderada e contagens; ranking por AUM/NNM/rentabilidade com drill-down.

**Harness de reconciliação (ferramenta de auditoria).** Um placar **read-only** (CLI)
que replica exatamente o cálculo da tela e fecha a **identidade do AUM** por
dimensão:
```
onshore     : pl_fim − pl_ini − NNM_real − Rent + Imp
offshore    : pl_fim − pl_ini − NNM_real − Rent − GanhoCambial
consolidado : onshore + offshore
```
O resíduo só é pendência se exceder **R$ 1.000 absoluto E 0,05% do PL** do cliente
(materialidade dupla — evita falso-positivo em clientes grandes). É o placar único da
frente de reconciliação: toda onda de correção termina re-rodando o harness e
reportando o delta.

**Estados especiais.** Registro em quarentena fora dos agregados. Mês de entrada de
carteira recebe tratamento de tombamento. Mês parcial usa `dia_inicio`/`dia_corte`
para comparação justa com benchmark.

**Exports.** Excel e PDF da tabela de AUM; exporters dedicados dos modais de Burn
Rate e Projeção.

---

## 9. Simulador what-if

A rota **/simulador** é a tela de **Precificação** (capítulo 7) — não há um
simulador what-if separado. A capacidade de simular contratações existe **embutida**
no módulo Capacidade (capítulo 5): informar novas contratações por função e ver o
efeito na capacidade e no custo estimado. O what-if de preço vive na Precificação
(Gerador e cenário de Reajustes).

---

## 10. Módulos reservados

Telas presentes na navegação, ainda como reserva (sem comportamento de negócio
implementado): **Projeção, Cenários, Pipeline, Matriz, Risco, Evolução,
Patrimonial, Patrimônio**. Cada uma terá seu capítulo quando a implementação
começar; a estrutura de dados correspondente está reservada (Parte II §13).

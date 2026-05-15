# Fase 2.5 — Vínculos como Entidade Própria

> **Status:** planejada, não iniciada
> **Posição:** entre a Fase 2 (identidade de colaboradores — concluída) e a validação mês-a-mês de 2026
> **Pré-requisito de:** validação completa de Janeiro/26
> **Documento gerado em:** sessão de design (Claude.ai, arquiteto/planejador)

---

## 1. Por que esta fase existe

A Fase 2 deixou os **colaboradores** em estado canônico (`colaboradores_base/`, `docId=slug`, `id_estavel`, `tipo_vinculo` correto). Mas a **alocação** — a informação de "qual colaborador atende qual cliente, em qual função, com qual percentual" — continua morando dentro do documento do cliente, nos 6 campos de função (`consultoria_gestao`, `consultoria_planejamento`, `consultoria_financeira`, `operacional_financeiro`, `serv_adm`, `serv_aux_adm`) e nos campos `fator_*` / `pct_*`.

Esse desenho atual tem dois problemas conhecidos, ambos diagnosticados:

1. **Referência por nome.** Os 6 campos guardam o **nome** do colaborador (string), não um identificador estável. Diagnóstico `diagnostico-nomes-quebrados-2026-05-14T18-21-21.md` encontrou 5 nomes quebrados afetando 19 de 84 clientes (22,6%): truncamentos (`Flavia Santos`, `Cintia Alves`, `Luiz Nerone`), um erro de digitação (`Lucas Silva`) e um ex-funcionário (`Vinicius Rodrigues`).

2. **Alocação acoplada ao cliente.** Como a alocação vive espalhada nos documentos de cliente, qualquer mudança de equipe (uma demissão, uma contratação) exige varrer e editar N documentos de cliente, em todos os períodos afetados.

A decisão do CFO é **validar Janeiro/26 por completo** — incluindo o custo direto de colaborador por cliente — antes de propagar para os demais meses. O custo direto depende das alocações estarem corretas e estáveis. Logo, **reorganizar a alocação é pré-requisito da validação de Janeiro**, não um refinamento posterior.

---

## 2. O que esta fase NÃO é

Esta fase foi originalmente desenhada como "Modelo de Eventos de Equipe" — um sistema completo de eventos datados (Desligamento, Contratação, Mudança de função) com redistribuição automática de carteira e verificador de consistência.

Durante o design, o CFO identificou que isso era **complexidade prematura**: desenhar a estrutura definitiva para casos (redistribuição fracionada, sucessão temporária) que ainda não foram vividos uma única vez na plataforma, antes mesmo de os dados de Janeiro estarem cadastrados.

**Decisão tomada:** reduzir o escopo. Construir apenas a fundação (vínculos como entidade própria), operar, e desenhar o modelo de eventos **depois — informado por uso real**, quando houver dor concreta para guiar o desenho.

O modelo de eventos completo vira **fase futura**. As decisões de design 5–7 esboçadas naquela conversa (ver Seção 6) ficam registradas como **ponto de partida** para esse dia futuro — não como compromisso.

---

## 3. Decisões de design fechadas

Estas quatro decisões foram fechadas na sessão de design e são a fundação da fase. São consideradas estáveis.

### Decisão 1 — Snapshot declarado

Cada mês continua sendo um **estado concreto e validável**, exatamente como a Fase 2 estabeleceu para `fechamentos/{periodo}/`. A reorganização da alocação **não** introduz "estado derivado/calculado". Quando houver mudança de equipe, o sistema ajuda a recalcular o estado daquele mês, mas o resultado é sempre um snapshot concreto que o CFO abre, inspeciona e valida.

Justificativa: o fluxo de trabalho do CFO é "abrir mês, validar, replicar para o próximo". Validação pressupõe um estado inspecionável. Estado derivado enfraqueceria o instrumento de garantia de qualidade.

### Decisão 2 — Vínculo é entidade própria

A alocação cliente↔colaborador deixa de ser atributo do documento de cliente e passa a ser uma **entidade própria** — uma estrutura separada, distinta tanto do cliente quanto do colaborador.

Um **vínculo** liga: colaborador ↔ cliente ↔ função ↔ período ↔ percentual.

Justificativa: o CFO enxerga a alocação como "uma relação que existe entre os dois", não como "um dado guardado na ficha do cliente". E desacoplar a alocação concentra as mudanças de equipe num único lugar, em vez de espalhá-las por N clientes.

### Decisão 3 — Vínculo referencia colaborador por `id_estavel`

O vínculo aponta para o colaborador pelo `id_estavel` (UUID estável, criado na Fase 3), **nunca pelo nome**.

Justificativa: rastrear pessoas por nome é o que gerou os 5 nomes quebrados. Esta decisão é, na prática, a antecipação do **Princípio 7** da identidade unificada ("cliente refere colaborador por id"). O modelo de vínculos apenas torna essa necessidade imediata.

### Decisão 4 — Um conjunto de vínculos por período

Cada período tem o seu próprio conjunto de vínculos. O vínculo "Colaborador X ↔ Cliente Y" em Janeiro/26 é um registro; o mesmo vínculo em Fevereiro/26 é **outro registro**. Se nada muda de um mês para o outro, a replicação copia os vínculos — exatamente como a Fase 2 replica colaboradores.

Justificativa: espelha o modelo de snapshot da Fase 2 (`fechamentos/{periodo}/` auto-contido). Mantém cada período inspecionável sem filtragem por vigência. Registros são baratos no Firestore; a inspecionabilidade vale o custo de espaço.

---

## 4. Escopo da fase — 7 peças, em ordem de execução

> Cada peça deve seguir o padrão de trabalho já consolidado: diagnóstico/dry-run antes de apply, snapshot prévio em `backups/firestore/` antes de qualquer write destrutivo, validação pós-write, commit de checkpoint com escopo cirúrgico. Sub-etapas sequenciais com checkpoint humano.

### Peça 1 — Estrutura de vínculos

Definir e criar a estrutura da nova entidade. Decisões a fechar no início da execução (não nesta sessão de design):

- **Forma de armazenamento:** coleção sob `fechamentos/{periodo}/vinculos/` (espelhando `colaboradores/` e `clientes/`), ou coleção top-level com campo de período. A primeira opção é mais coerente com a Decisão 4 e com a arquitetura atual.
- **Campos do vínculo (mínimo):**
  - `id_estavel_colaborador` — referência ao colaborador (Decisão 3)
  - `slug_cliente` ou identificador equivalente do cliente — alinhar com a chave canônica de cliente vigente
  - `funcao` — uma das 6 de `FuncaoAlocacao`
  - `periodo` — `YYYY-MM`
  - `percentual` ou `fator` — a intensidade da alocação (ver Peça 5 sobre como o pipeline consome isto)
  - metadados de rastreabilidade (`origem`, `data_criacao`)
- **Granularidade:** um vínculo por combinação colaborador×cliente×função×período. Um cliente com 6 funções preenchidas e atendido integralmente tem até 6 vínculos no período.

### Peça 2 — Migração dos dados atuais

Mover a alocação que hoje vive nos documentos de cliente para a estrutura de vínculos.

- **Fonte:** os 6 campos de função + `fator_*` de cada documento de cliente, em `clientes_base/` e em `fechamentos/{periodo}/clientes/`.
- **Volume conhecido (diagnóstico):** ~177 referências populadas em `clientes_base/`, ~870 em `fechamentos` (5 períodos). `pct_*` está quase vazio em produção (28 de 2.628 potenciais) — a migração de percentuais é pequena; a de nomes é a parte substancial.
- **Regra:** a migração resolve o nome para `id_estavel` no momento de criar o vínculo (ver Peça 3). Vínculo nunca é criado apontando para nome.
- **Comportamento por período:** wipe-and-replace por período (padrão já estabelecido na Fase 2), nunca da coleção inteira.

### Peça 3 — Saneamento dos 5 nomes

Acontece **junto com a Peça 2** — não faz sentido migrar um nome quebrado. Durante a migração, cada nome é resolvido para o colaborador canônico correto antes de virar `id_estavel` no vínculo.

Mapa de saneamento (fechado com o CFO na sessão de design):

| Nome atual (no cliente) | Colaborador canônico | Natureza | Refs aprox. |
|---|---|---|---|
| Flavia Santos | Flávia Santos Romeu | truncamento | ~53 |
| Cintia Alves | Cintia De Jesus Alves | truncamento | ~30 |
| Luiz Nerone | Luis Eduardo Nerone | truncamento | ~50 |
| Lucas Silva | Lucas Henrique | erro de digitação | — |
| Vinicius Rodrigues | Jeter Moraes | ex-funcionário → sucessor | 14 (7 na base) |

Observações:

- **Vinicius Rodrigues → Jeter Moraes:** Vinicius saiu em Fevereiro/26; Jeter entrou em Abril/26 como sucessor definitivo (Lucas Henrique cobriu interinamente Fev–Mar). A decisão do CFO foi que as referências de cliente devem apontar para o sucessor **definitivo** (Jeter), pois o estado canônico que segue adiante deve refletir o responsável definitivo, não o interino. O detalhe temporal (interino vs definitivo) **não** é modelado nesta fase — fica para o modelo de eventos futuro.
- O saneamento depende da **Peça 4** estar concluída: o vínculo `→ Jeter Moraes` só pode ser criado se Jeter já existir como colaborador canônico.

### Peça 4 — Cadastro do Jeter Moraes

Jeter Moraes precisa existir como colaborador canônico para ser alvo de vínculo.

- **Dados:** nome `Jeter Moraes`, cargo `Analista Financeiro`, `funcao_principal = operacional_financeiro` (cargo "Operador" no `MAPA_FUNCOES`), `tipo_vinculo = clt`.
- **Como cadastrar:** via script, no padrão da Fase 2 (não pela UI atual — o diagnóstico de fluxo operacional mostrou que a UI grava só no snapshot do período, não em `colaboradores_base/`, e `funcao_principal` é texto livre). O cadastro deve criar Jeter em `colaboradores_base/` com `docId=slug` (`jeter_moraes`), `id_estavel` novo (UUID v4), Categoria B calculada pela função canônica.
- **Quando / em quais períodos:** **decisão deliberadamente adiada.** O CFO opera mês-a-mês (valida Janeiro, replica para Fevereiro, etc.) e cadastra cada colaborador no mês real do evento. Jeter entra em Abril/26 na realidade. Se ele deve existir em `colaboradores_base/` desde já mas só aparecer nos snapshots a partir de Abril, ou aparecer em todos com um campo `ativo`/`data_admissao`, é uma decisão a tomar **no início da execução**, não nesta sessão de design. O ponto a respeitar: não replicar Jeter para períodos cegamente — alinhar com o fluxo mês-a-mês do CFO.

### Peça 5 — Pipeline financeiro passa a ler vínculos

O cálculo de custo direto por cliente (`utils/financials.ts`, seção "Pipeline de Processamento — Custo Direto" do CLAUDE.md) hoje lê os 6 campos de função do documento de cliente. Precisa passar a ler a estrutura de vínculos.

- A fórmula em si **não muda** conceitualmente: `horasDireito × fator × custo_hora` por função, mais horas reativas no gestor. O que muda é **de onde vem** a informação "qual colaborador, qual fator".
- Atenção ao casamento: hoje o pipeline casa cliente↔colaborador por nome (com fallback normalizado) — é o que gera os logs `[CustoDireto] Colaborador não encontrado`. Após esta peça, o casamento é por `id_estavel`, e esses logs devem desaparecer.
- A relação entre `fator_*` (que hoje vive no cliente) e o `percentual`/`fator` do vínculo precisa ser decidida no início da execução: o fator migra para dentro do vínculo, ou permanece no cliente e o vínculo carrega só a referência de pessoa? Recomendação preliminar: o fator é uma propriedade da **relação** cliente×função, então é candidato natural a viver no vínculo — mas confirmar contra o uso real do campo na UI antes de mover.

### Peça 6 — UI de alocação escreve na estrutura nova

As telas que hoje editam alocação — Perfil (`features/perfil/`) e Alocação em Lote — precisam passar a escrever na estrutura de vínculos em vez dos campos do cliente.

- Inclui corrigir, no caminho, o **Bug Arquitetural #1** (docs-fantasma por `setDoc merge` em `useColaboradores.salvarPct` e `useAlocacaoEmLote.salvarTodos`), já que essas funções serão reescritas de qualquer forma.
- Escopo de UI deve ser mínimo: fazer a escrita funcionar na estrutura nova. Refinamento de UX fica para depois.

### Peça 7 — Mudança de equipe: edição manual (sem automação)

Por enquanto, **sem modelo de eventos, sem automação**. Quando o CFO chegar, na validação mês-a-mês, num mês com mudança de equipe, ele edita os vínculos daquele mês **na mão**.

Isto é deliberado e "bobo de propósito": é o que permite o CFO operar já e **descobrir a dor real** da edição manual — qual é tediosa, qual é arriscada, o que ele gostaria que fosse automático. Essa dor real é o que vai informar o desenho do modelo de eventos na fase futura, em vez de projetá-lo em abstrato.

---

## 5. Sequenciamento

```
Fase 2 (concluída)
   │
   ▼
Fase 2.5 — Vínculos como entidade própria   ◄── pré-requisito da validação de Janeiro
   │   Peça 4 (cadastrar Jeter) ─┐
   │   Peça 1 (estrutura) ───────┤
   │   Peça 2 + 3 (migração + saneamento, juntas) ◄── dependem da Peça 4
   │   Peça 5 (pipeline lê vínculos)
   │   Peça 6 (UI escreve vínculos)
   │   Peça 7 (edição manual de mudança de equipe — sem build, é modo de operação)
   │
   ▼
Validação completa de Janeiro/26  (inclui custo direto por colaborador)
   │
   ▼
Replicação e validação mês-a-mês: Fev/26 → ... → 2026 completo → 2025
   │
   ▼
[Fase futura] Modelo de Eventos de Equipe — desenhado informado por uso real
```

Ordem de dependência interna a confirmar no início da execução, mas a regra firme: **Peça 4 antes de Peça 3** (Jeter precisa existir antes de ser alvo de vínculo).

---

## 6. Anotação de partida para a fase futura (NÃO é compromisso)

Estas decisões foram esboçadas na sessão de design antes de o escopo ser reduzido. Ficam registradas **apenas como ponto de partida** para o dia em que o modelo de eventos for desenhado — informado por uso real. Não devem ser tratadas como decididas.

- **Esboço 5 — Três tipos de evento:** Desligamento, Contratação, Mudança de função. As 5 transições de equipe que o CFO confirmou existirem no Galácticos colapsariam nesses 3 tipos (Desligamento cobriria sucessão simples, temporária e redistribuição fracionada; Contratação cobriria entrada sem predecessor; Mudança de função cobriria troca de `funcao_principal` sem desligamento).
- **Esboço 6 — Desligamento como acontecimento único:** o CFO indicou enxergar a sucessão temporária (Vinicius→Lucas→Jeter) como **um** acontecimento com redistribuição em etapas, não como dois acontecimentos independentes.
- **Esboço 7 — Unidade da redistribuição:** ficou em aberto se a redistribuição de carteira seria modelada "em bloco" (a carteira como um todo) ou "vínculo a vínculo" (cada vínculo do desligado com destino próprio). A Decisão 4 (vínculo como entidade) torna "vínculo a vínculo" o caminho natural, mas isto **não foi fechado** e deve ser revisitado com casos reais na mão.
- **Esboço — evento como fato declarado:** o CFO indicou preferir que um evento seja "uma verdade permanente que o sistema sempre respeita" (em vez de uma instrução executada uma única vez), o que implicaria um **verificador de consistência** — componente que valida o estado de cada mês contra os eventos declarados. Esta é a parte mais ambiciosa do modelo futuro e a que mais deve ser pesada contra esforço real quando chegar a hora.

**Princípio que guiou a redução de escopo, a manter na fase futura:** "automação máxima, mas qualidade do resultado em primeiro lugar" — e não desenhar para casos que ainda não foram vividos.

---

## 7. Riscos e pontos de atenção

- **Migração toca dados de cliente.** Peça 2 reescreve a origem da alocação. Snapshot prévio obrigatório de `clientes_base/` e de `fechamentos/{periodo}/clientes/` antes de qualquer write. A migração deve ser reversível.
- **`pct_*` quase vazio hoje.** A distorção financeira atual do custo direto é ~zero (com `pct=0`, o motor pula a função antes do match). A consequência: a migração é menos arriscada do que parece, mas também significa que o trabalho real de **popular** as alocações de Janeiro ainda está por vir — é parte da validação de Janeiro, não desta fase.
- **Upload Excel ainda usa `crypto.randomUUID()`.** Fora do escopo desta fase, mas registrado: enquanto o Upload Excel não usar `slug`, qualquer reimport regride o schema de colaboradores. Se houver reimport antes da correção, a Fase 2.5 pode ser parcialmente desfeita.
- **Chave canônica de cliente.** A Fase 1 e a Fase 3 estabeleceram `slug` e `id_estavel` para colaboradores. Confirmar, no início da execução, qual é a chave canônica de **cliente** vigente, para o vínculo referenciar o cliente de forma estável também — não repetir, do lado do cliente, o erro de referência por nome.
- **Duplicação de lógica de folha em scripts `.mjs`.** Pendência herdada da Fase 2 (cópia inline de `calcularFolhaColaborador`). O cadastro do Jeter (Peça 4) usará essa cópia inline — manter sincronizada.

---

## 8. Definição de pronto

A Fase 2.5 está concluída quando:

1. Existe a estrutura de vínculos, com um conjunto por período, referenciando colaborador por `id_estavel`.
2. Todas as alocações dos períodos existentes foram migradas dos campos de cliente para a estrutura de vínculos, com os 5 nomes saneados no processo.
3. Jeter Moraes existe como colaborador canônico.
4. O pipeline de custo direto lê vínculos — e os logs `[CustoDireto] Colaborador não encontrado` por nome quebrado desapareceram.
5. A UI de alocação (Perfil / Alocação em Lote) escreve na estrutura de vínculos, sem `setDoc merge` gerador de docs-fantasma.
6. O CFO consegue abrir Janeiro/26 e validar o custo direto de colaborador por cliente sobre dados confiáveis.

A partir daí: validação completa de Janeiro/26, e o fluxo mês-a-mês começa.

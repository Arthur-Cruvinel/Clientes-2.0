// --- Módulos da Vitrine 360 (placeholders com frase de visão) ---
// Cada módulo é uma casca de vitrine: a PERGUNTA em destaque + origem. Sem dados,
// sem lógica. As frases são VERBATIM do documento de especificação.

import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';
import {
  MockupSaude, MockupCarteira, MockupPlanejamento, MockupJuridico, MockupContratoVivo, MockupAgente,
  MockupResultados, MockupAutomacao, MockupServicosDemanda, MockupApontamento, MockupTarefas, MockupDossie, MockupFluxoCaixa,
  MockupGestaoObra, MockupDocumentos, MockupFluxoCaixaEmpresa, MockupProcessos,
} from './mockups';

// ── EMPRESA ────────────────────────────────────────────────────────────────
export const Resultados = () => (
  <PlaceholderModulo nome="Resultados" origem={{ tipo: 'novo' }}
    pergunta="A DRE consolidada da casa — a Galácticos como negócio, mês a mês."
    mockup={<MockupResultados />} />
);

export const Carteira = () => (
  <PlaceholderModulo nome="Carteira" origem={{ tipo: 'especificado', parte: 'V.3' }}
    pergunta="De quem a casa depende — e quanto? Curva ABC, matriz BCG, concentração e o pipeline comercial."
    mockup={<MockupCarteira />} />
);

export const Juridico = () => (
  <PlaceholderModulo nome="Jurídico" origem={{ tipo: 'especificado', parte: 'V.2' }}
    pergunta="Capacidade fixa com demanda sem preço marginal gera fila, sempre. Demandas medidas, franquias por tier, consumo visível — o jurídico que limita e cobra sem virar gargalo."
    mockup={<MockupJuridico />} />
);

export const ServicosDemanda = () => (
  <PlaceholderModulo nome="Serviços sob Demanda" origem={{ tipo: 'especificado', parte: 'V.10' }}
    pergunta="Os projetos especiais — M&A, valuation, viabilidade, obras — dão lucro, projeto a projeto? Receita e custo pontuais, margem por evento."
    mockup={<MockupServicosDemanda />} />
);

export const ApontamentoHoras = () => (
  <PlaceholderModulo nome="Apontamento de Horas" origem={{ tipo: 'especificado', parte: 'V.12' }}
    pergunta="As horas alocadas correspondem ao tempo efetivamente gasto — ou estamos precificando sobre estimativa quando poderíamos medir?"
    mockup={<MockupApontamento />} />
);

export const AutomacaoBancaria = () => (
  <PlaceholderModulo nome="Automação Bancária" origem={{ tipo: 'especificado', parte: 'V.14' }}
    pergunta="Extratos recebidos e movimentos classificados automaticamente via Open Finance — e, em fase própria, a iniciação de pagamentos."
    mockup={<MockupAutomacao />} />
);

export const AgenteWhatsapp = () => (
  <PlaceholderModulo nome="Agente WhatsApp" origem={{ tipo: 'novo' }}
    pergunta="As demandas do cliente chegam pelo WhatsApp — o agente filtra, classifica e abre a tarefa certa no módulo certo; e os relatórios do mês voltam pelo mesmo canal, direto para a família."
    mockup={<MockupAgente />} />
);

export const FluxoCaixaEmpresa = () => (
  <PlaceholderModulo nome="Fluxo de Caixa" origem={{ tipo: 'novo' }}
    pergunta="O caixa da casa, lançado e projetado: movimentos da conciliação, aprovisionamentos e orçamento num workspace só — com o caixa futuro avisando antes de faltar."
    mockup={<MockupFluxoCaixaEmpresa />} />
);

export const Processos = () => (
  <PlaceholderModulo nome="Processos" origem={{ tipo: 'novo' }}
    pergunta="Os processos da casa, vivos: cada departamento documentado, um campo que responde pelo que o processo diz — e o treino de LGPD e compliance que prepara o time para a automação bancária."
    mockup={<MockupProcessos />} />
);

export const Tarefas = () => (
  <PlaceholderModulo nome="Tarefas" origem={{ tipo: 'novo' }}
    pergunta="O trabalho da casa organizado — tarefas por cliente, responsável e prazo, nascendo dos módulos que as geram e do agente que as recebe."
    mockup={<MockupTarefas />} />
);

// ── CLIENTE 360 ──────────────────────────────────────────────────────────────
export const PlanejamentoFinanceiro = () => (
  <PlaceholderModulo nome="Planejamento Financeiro" origem={{ tipo: 'especificado', parte: 'V.1' }}
    pergunta="A carreira do atleta inverte a curva de renda: o pico aos 20 e poucos, a renda podendo cessar antes dos 40 — com meio século de vida pela frente. O plano de independência, projetado ano a ano e acompanhado plano vs. realizado, mês a mês."
    mockup={<MockupPlanejamento />} />
);

export const SaudeCliente = () => (
  <PlaceholderModulo nome="Saúde do Cliente" origem={{ tipo: 'especificado', parte: 'V.7' }}
    pergunta="Quem precisa de atenção esta semana — sem abrir oito telas?"
    mockup={<MockupSaude />} />
);

export const DossieCliente = () => (
  <PlaceholderModulo nome="Dossiê do Cliente" origem={{ tipo: 'especificado', parte: 'V.8' }}
    pergunta="O que o gestor leva para a reunião — em uma página, sempre atual."
    mockup={<MockupDossie />} />
);

export const ContratoVivo = () => (
  <PlaceholderModulo nome="Contrato Vivo" origem={{ tipo: 'especificado', parte: 'V.6' }}
    pergunta="O que foi vendido continua sendo o que é entregue — e quem deveria saber quando deixa de ser?"
    mockup={<MockupContratoVivo />} />
);

export const FluxoCaixa = () => (
  <PlaceholderModulo nome="Fluxo de Caixa" origem={{ tipo: 'novo' }}
    pergunta="O caixa do cliente, mês a mês — entradas, saídas e a classificação que alimenta o plano financeiro."
    mockup={<MockupFluxoCaixa />} />
);

export const GestaoObra = () => (
  <PlaceholderModulo nome="Gestão de Obra" origem={{ tipo: 'novo', nota: 'serviço já no catálogo do Orçador' }}
    pergunta="A obra do cliente sob controle: orçado versus realizado por etapa, medições contra pagamentos, estoque de materiais — a ferramenta que executa o serviço que a casa vende."
    mockup={<MockupGestaoObra />} />
);

export const Documentos = () => (
  <PlaceholderModulo nome="Documentos" origem={{ tipo: 'novo' }}
    pergunta="Os documentos do cliente guardados e vigiados — pessoais, societários e fiscais, com validade monitorada: o vencimento vira tarefa antes de virar problema, e o agente cobra a renovação direto no WhatsApp da família."
    mockup={<MockupDocumentos />} />
);

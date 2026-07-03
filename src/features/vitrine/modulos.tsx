// --- Módulos da Vitrine 360 (placeholders com frase de visão) ---
// Cada módulo é uma casca de vitrine: a PERGUNTA em destaque + origem. Sem dados,
// sem lógica. As frases são VERBATIM do documento de especificação.

import { PlaceholderModulo } from '../../components/ui/PlaceholderModulo';

// ── EMPRESA ────────────────────────────────────────────────────────────────
export const Resultados = () => (
  <PlaceholderModulo nome="Resultados" origem={{ tipo: 'novo' }}
    pergunta="A DRE consolidada da casa — a Galácticos como negócio, mês a mês." />
);

export const Carteira = () => (
  <PlaceholderModulo nome="Carteira" origem={{ tipo: 'especificado', parte: 'V.3' }}
    pergunta="De quem a casa depende — e quanto? Curva ABC, matriz BCG, concentração e o pipeline comercial." />
);

export const Juridico = () => (
  <PlaceholderModulo nome="Jurídico" origem={{ tipo: 'especificado', parte: 'V.2' }}
    pergunta="Capacidade fixa com demanda sem preço marginal gera fila, sempre. Demandas medidas, franquias por tier, consumo visível — o jurídico que limita e cobra sem virar gargalo." />
);

export const ServicosDemanda = () => (
  <PlaceholderModulo nome="Serviços sob Demanda" origem={{ tipo: 'especificado', parte: 'V.10' }}
    pergunta="Os projetos especiais — M&A, valuation, viabilidade, obras — dão lucro, projeto a projeto? Receita e custo pontuais, margem por evento." />
);

export const ApontamentoHoras = () => (
  <PlaceholderModulo nome="Apontamento de Horas" origem={{ tipo: 'especificado', parte: 'V.12' }}
    pergunta="As horas alocadas correspondem ao tempo efetivamente gasto — ou estamos precificando sobre estimativa quando poderíamos medir?" />
);

export const AutomacaoBancaria = () => (
  <PlaceholderModulo nome="Automação Bancária" origem={{ tipo: 'especificado', parte: 'V.14' }}
    pergunta="Extratos recebidos e movimentos classificados automaticamente via Open Finance — e, em fase própria, a iniciação de pagamentos." />
);

export const AgenteWhatsapp = () => (
  <PlaceholderModulo nome="Agente WhatsApp" origem={{ tipo: 'novo' }}
    pergunta="As demandas do cliente chegam pelo WhatsApp — o agente filtra, classifica e abre a tarefa certa no módulo certo; e os relatórios do mês voltam pelo mesmo canal, direto para a família." />
);

export const Tarefas = () => (
  <PlaceholderModulo nome="Tarefas" origem={{ tipo: 'novo' }}
    pergunta="O trabalho da casa organizado — tarefas por cliente, responsável e prazo, nascendo dos módulos que as geram e do agente que as recebe." />
);

// ── CLIENTE 360 ──────────────────────────────────────────────────────────────
export const PlanejamentoFinanceiro = () => (
  <PlaceholderModulo nome="Planejamento Financeiro" origem={{ tipo: 'especificado', parte: 'V.1' }}
    pergunta="A carreira do atleta inverte a curva de renda: o pico aos 20 e poucos, a renda podendo cessar antes dos 40 — com meio século de vida pela frente. O plano de independência, projetado ano a ano e acompanhado plano vs. realizado, mês a mês." />
);

export const SaudeCliente = () => (
  <PlaceholderModulo nome="Saúde do Cliente" origem={{ tipo: 'especificado', parte: 'V.7' }}
    pergunta="Quem precisa de atenção esta semana — sem abrir oito telas?" />
);

export const DossieCliente = () => (
  <PlaceholderModulo nome="Dossiê do Cliente" origem={{ tipo: 'especificado', parte: 'V.8' }}
    pergunta="O que o gestor leva para a reunião — em uma página, sempre atual." />
);

export const ContratoVivo = () => (
  <PlaceholderModulo nome="Contrato Vivo" origem={{ tipo: 'especificado', parte: 'V.6' }}
    pergunta="O que foi vendido continua sendo o que é entregue — e quem deveria saber quando deixa de ser?" />
);

export const FluxoCaixa = () => (
  <PlaceholderModulo nome="Fluxo de Caixa" origem={{ tipo: 'novo' }}
    pergunta="O caixa do cliente, mês a mês — entradas, saídas e a classificação que alimenta o plano financeiro." />
);

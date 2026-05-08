// --- Card de decisão metodológica (auditável, somente leitura) ---
// Conteúdo estático passado por props. Borda esquerda na cor da marca.

interface Props {
  titulo: string;
  decisao: string;
  fundamentacao: string;
  formula?: string;     // bloco mono opcional
  vigencia: string;
  impacto?: string;
}

function Secao({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
        {label}
      </p>
      <p className="text-sm whitespace-pre-line" style={{ color: '#160F41' }}>{content}</p>
    </div>
  );
}

export function MetodologiaCard({
  titulo, decisao, fundamentacao, formula, vigencia, impacto,
}: Props) {
  return (
    <article
      className="bg-white rounded-r-lg p-5 space-y-3"
      style={{
        borderLeft: '4px solid #732AD8',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
      <h3 className="text-lg font-bold" style={{ color: '#160F41' }}>{titulo}</h3>

      <Secao label="Decisão" content={decisao} />
      <Secao label="Fundamentação" content={fundamentacao} />

      {formula && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6b8a' }}>
            Fórmula
          </p>
          <pre
            className="font-mono text-xs p-3 rounded whitespace-pre-wrap overflow-x-auto"
            style={{ backgroundColor: '#160F41', color: '#dbeafe' }}>
            {formula}
          </pre>
        </div>
      )}

      <Secao label="Vigência" content={vigencia} />
      {impacto && <Secao label="Impacto" content={impacto} />}
    </article>
  );
}

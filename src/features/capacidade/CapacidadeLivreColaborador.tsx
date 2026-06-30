// --- VISTA PROVISÓRIA — capacidade livre por colaborador (Frente 3) ---
// Realojada da Alocação em Lote (onde era métrica de nível errado numa tela
// individual). Forma MÍNIMA e funcional, SEM acabamento — a ser redesenhada na
// futura reforma do módulo Capacidade. Não investir polimento aqui.
import type { CapacidadeLivreColaborador as Dado } from './useCapacidade';

const TH = 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-right';
const TD = 'px-3 py-2 text-xs text-right';

export function CapacidadeLivreColaborador({ dados }: { dados: Dado[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold" style={{ color: '#160F41' }}>
        Capacidade livre por colaborador <span className="text-[10px] font-normal" style={{ color: '#9ca3af' }}>(vista provisória)</span>
      </h3>
      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: '#e2e2e8' }}>
        <table className="min-w-full">
          <thead style={{ backgroundColor: '#f9f9fb', color: '#6b6b8a' }}>
            <tr>
              <th className={`${TH} text-left`}>Colaborador</th>
              <th className={`${TH} text-left`}>Função</th>
              <th className={TH} title="Demanda de volume dos clientes da carteira na função">Demanda</th>
              <th className={TH} title="Horas produtivas × percentual_alocavel">Disponível</th>
              <th className={TH}>Livre</th>
              <th className={TH} title="~ quantos clientes full cabem na folga">~ Full</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#e2e2e8' }}>
            {dados.map(d => (
              <tr key={`${d.colaborador.nome_colaborador}|${d.funcao}`}>
                <td className={`${TD} text-left`} style={{ color: '#160F41' }}>{d.colaborador.nome_colaborador}</td>
                <td className={`${TD} text-left`} style={{ color: '#6b6b8a' }}>{d.label}</td>
                <td className={TD} style={{ color: '#6b6b8a' }}>{d.horasDemanda.toFixed(0)}h</td>
                <td className={TD} style={{ color: '#6b6b8a' }}>{d.horasProdutivas.toFixed(0)}h</td>
                <td className={`${TD} font-medium`} style={{ color: d.emSobrecarga ? '#dc2626' : '#166534' }}>
                  {d.emSobrecarga ? `−${Math.abs(d.capacidadeLivre).toFixed(0)}h` : `${d.capacidadeLivre.toFixed(0)}h`}
                </td>
                <td className={TD} style={{ color: '#6b6b8a' }}>{d.emSobrecarga ? '—' : d.clientesFullLivre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

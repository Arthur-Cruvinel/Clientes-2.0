// --- Banner persistente de siglas em quarentena (Frente 3) ---
// Exibido na tela de upload onshore (ImportPoupanca.tsx) sempre que o último
// upload tenha gerado registros com status='pendente_normalizacao'.
//
// Comportamento:
//   - siglas vazio → retorna null (sem render)
//   - siglas não-vazio → banner amarelo suave persistente
//   - Sem dismiss manual. Banner some quando o array esvazia (após
//     normalização real via Configurações → Manutenção). Dismiss manual
//     daria falsa sensação de problema resolvido.
//
// Conteúdo intencionalmente minimalista: o tipo siglasQuarentenaOnshore
// (Set<string>) só carrega a sigla bruta. Contagem de registros e períodos
// afetados não estão no array — exibi-los exigiria query secundária ao
// Firestore, fora do escopo desta frente. Se virar necessidade real
// (volume alto), enriquecer no hook e expandir o componente.

import { AlertTriangle } from 'lucide-react';

interface Props {
  siglas: string[];
}

export function BannerQuarentena({ siglas }: Props) {
  if (siglas.length === 0) return null;

  return (
    <div
      className="flex items-start gap-2 p-3 rounded-lg"
      style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
    >
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <p className="text-xs font-medium">
          Siglas em quarentena — pendente normalização
          <span className="ml-1.5 font-normal">
            ({siglas.length} sigla{siglas.length === 1 ? '' : 's'} no último upload)
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {siglas.map(s => (
            <span
              key={s}
              className="px-2 py-0.5 rounded text-[11px] font-mono"
              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="text-[11px]">
          Os registros foram gravados mas estão em <strong>limbo</strong> — não entram
          em AUM, NNM, rentabilidade ou rebate até serem normalizados. Normalize cada
          sigla em <strong>Configurações → Manutenção → "Corrigir Nomes em Poupança"</strong>,
          passando a sigla bruta como nome antigo e o nome canônico do cliente como
          nome novo.
        </p>
      </div>
    </div>
  );
}

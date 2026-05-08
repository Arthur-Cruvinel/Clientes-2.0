// --- Modal "Novo Cliente" ---
// Cadastra cliente em clientes_base/ + fechamentos/{periodo}/clientes/.
// Validação de uniqueness: verifica via doc(clientes_base/{slug}) antes de
// criar — bloqueia se já existir.

import { useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { db, salvarClienteBase } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Cliente, PacoteServico } from '../../types';

interface Props {
  periodo: string;
  onFechar: () => void;
  onCriado: (nomeCliente: string) => void;
}

const PACOTES: PacoteServico[] = ['full', 'advanced', 'light', 'future', 'asset_only'];

const INP = 'rounded px-2 py-1.5 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' } as const;

/** Mesmo slug usado em salvarClienteBase — replicado p/ pré-checagem antes
 *  do save, evita gravar e depois descobrir duplicata. */
function clienteSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function NovoClienteModal({ periodo, onFechar, onCriado }: Props) {
  const [nome, setNome] = useState('');
  const [pacote, setPacote] = useState<PacoteServico>('light');
  const [receitaFee, setReceitaFee] = useState(0);
  const [rebateOn, setRebateOn] = useState(0.6);
  const [rebateOff, setRebateOff] = useState(0.6);
  const [aliqRebate, setAliqRebate] = useState(0);
  const [usaJuridico, setUsaJuridico] = useState(false);
  const [usaConciliacao, setUsaConciliacao] = useState(false);
  // data_entrada: input month YYYY-MM. Default = período atual selecionado.
  // Required: cliente sem data_entrada apareceria em períodos anteriores
  // à sua entrada, distorcendo histórico.
  const [dataEntrada, setDataEntrada] = useState(periodo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const trimmed = nome.trim();
    if (!trimmed) return setErro('Nome é obrigatório.');
    if (!periodo) return setErro('Período não definido.');
    if (!/^\d{4}-\d{2}$/.test(dataEntrada)) return setErro('Data de entrada inválida.');
    const slug = clienteSlug(trimmed);
    if (!slug) return setErro('Nome inválido (sem caracteres alfanuméricos).');

    setSalvando(true);
    try {
      // Uniqueness check em clientes_base/.
      const ref = doc(db, 'clientes_base', slug);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existente = snap.data() as Cliente;
        setErro(`Já existe cliente com este nome: "${existente.nome_cliente}". Use um nome diferente ou edite o existente.`);
        return;
      }

      const novo: Cliente = {
        nome_cliente: trimmed,
        receita_fee: receitaFee,
        percentual_rebate_anual_onshore: rebateOn / 100,
        percentual_rebate_anual_offshore: rebateOff / 100,
        aliquota_impostos_rebate: aliqRebate / 100,
        utiliza_servico_juridico: usaJuridico,
        utiliza_conciliacao: usaConciliacao,
        pacote_servico: pacote,
        // pct_* zerados — definidos depois via Alocação em Lote.
        pct_consultoria_gestao: 0,
        pct_consultoria_planejamento: 0,
        pct_consultoria_financeira: 0,
        pct_operacional_financeiro: 0,
        pct_serv_adm: 0,
        pct_serv_aux_adm: 0,
        data_entrada: dataEntrada,
      };

      // 1) Cadastro mestre. 2) Doc do período (snapshot inicial).
      await salvarClienteBase(novo);
      await setDoc(doc(db, 'fechamentos', periodo, 'clientes', slug), novo);

      onCriado(trimmed);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar cliente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto onFechar={salvando ? () => {} : onFechar} titulo="Novo cliente">
      <div className="space-y-3">
        <Field label="Nome do cliente *">
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Nome completo" className={INP} style={BRD} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pacote de serviço *">
            <select value={pacote} onChange={e => setPacote(e.target.value as PacoteServico)}
              className={INP} style={BRD}>
              {PACOTES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Data de entrada *">
            <input type="month" value={dataEntrada}
              onChange={e => setDataEntrada(e.target.value)}
              className={INP} style={BRD} />
          </Field>
        </div>
        <div>
          <Field label="Receita fee (R$ / mês)">
            <input type="number" step="0.01" value={receitaFee}
              onChange={e => setReceitaFee(Number(e.target.value))}
              className={INP} style={BRD} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rebate onshore (% a.a.)">
            <input type="number" step="0.01" value={rebateOn}
              onChange={e => setRebateOn(Number(e.target.value))} className={INP} style={BRD} />
          </Field>
          <Field label="Rebate offshore (% a.a.)">
            <input type="number" step="0.01" value={rebateOff}
              onChange={e => setRebateOff(Number(e.target.value))} className={INP} style={BRD} />
          </Field>
          <Field label="Alíq. imp. rebate (%)">
            <input type="number" step="0.01" value={aliqRebate}
              onChange={e => setAliqRebate(Number(e.target.value))} className={INP} style={BRD} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
            <input type="checkbox" checked={usaJuridico} onChange={e => setUsaJuridico(e.target.checked)} className="rounded" />
            Utiliza serviço jurídico
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#160F41' }}>
            <input type="checkbox" checked={usaConciliacao} onChange={e => setUsaConciliacao(e.target.checked)} className="rounded" />
            Utiliza conciliação
          </label>
        </div>
        <p className="text-[11px] italic" style={{ color: '#6b6b8a' }}>
          Cliente entra com pct_* = 0 em todas as funções. Atribua responsáveis e dedicações depois via Alocação em Lote / Atribuição em Lote.
        </p>
        {erro && <p className="text-xs px-3 py-2 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{erro}</p>}
        <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#e2e2e8' }}>
          <button onClick={onFechar} disabled={salvando}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>
            <X size={14} /> Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Criar cliente
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: '#6b6b8a' }}>{label}</label>
      {children}
    </div>
  );
}

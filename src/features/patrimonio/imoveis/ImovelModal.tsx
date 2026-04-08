// --- Modal de formulário de imóvel com seções, ViaCEP e estimativa Claude AI ---

import { useState, useRef } from 'react';
import { MapPin, Sparkles, Loader2, ChevronDown, ChevronRight, Check, FileUp } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import { chamarClaude } from '../../poupanca/import/parsers/parseComClaude';
import { useDocumentParser } from '../parsers/useDocumentParser';
import { PROMPTS_IMOVEL } from '../parsers/parseImovelDoc';
import type { ImovelExtraido } from '../parsers/parseImovelDoc';
import { DocumentParserPreview } from '../parsers/DocumentParserPreview';
import type { CampoExtraido } from '../parsers/useDocumentParser';
import type { Imovel, TipoImovel } from '../../../types';

interface Props { imovel: Imovel; onSalvar: (i: Imovel) => Promise<void>; onFechar: () => void }

const TIPOS: TipoImovel[] = ['residencial', 'comercial', 'rural', 'terreno'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const INP = 'rounded-lg px-3 py-2 text-sm w-full';
const BRD = { border: '1px solid #e2e2e8', color: '#160F41' };
const LBL = 'text-xs font-medium mb-1';

interface EstimativaIA { valor: number; faixa_min: number; faixa_max: number; valor_m2: number; justificativa: string; fontes: string }

function Secao({ titulo, aberto, toggle, children }: { titulo: string; aberto: boolean; toggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg" style={{ borderColor: '#e2e2e8' }}>
      <button onClick={toggle} className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-left" style={{ color: '#160F41' }}>
        {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {titulo}
      </button>
      {aberto && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

export function ImovelModal({ imovel, onSalvar, onFechar }: Props) {
  const [f, setF] = useState<Imovel>({ ...imovel });
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [estimando, setEstimando] = useState(false);
  const [estimativa, setEstimativa] = useState<EstimativaIA | null>(null);
  const [secOutros, setSecOutros] = useState(false);
  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

  // Parser de documento
  const { parsearDocumento, parseando } = useDocumentParser();
  const [docResult, setDocResult] = useState<{ campos: ImovelExtraido; documento_tipo: string; avisos: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = async (file: File) => {
    const res = await parsearDocumento<ImovelExtraido>(file, PROMPTS_IMOVEL.system, PROMPTS_IMOVEL.user);
    if (res) setDocResult({ campos: res.campos, documento_tipo: res.documento_tipo, avisos: res.avisos });
  };

  const aplicarDoc = () => {
    if (!docResult) return;
    const c = docResult.campos;
    const v = (campo: CampoExtraido<unknown>) => campo.valor;
    setF(p => ({
      ...p,
      ...(v(c.descricao) != null ? { descricao: v(c.descricao) as string } : {}),
      ...(v(c.tipo) != null ? { tipo: v(c.tipo) as TipoImovel } : {}),
      ...(v(c.endereco) != null ? { endereco: v(c.endereco) as string } : {}),
      ...(v(c.bairro) != null ? { bairro: v(c.bairro) as string } : {}),
      ...(v(c.cidade) != null ? { cidade: v(c.cidade) as string } : {}),
      ...(v(c.uf) != null ? { uf: v(c.uf) as string } : {}),
      ...(v(c.cep) != null ? { cep: v(c.cep) as string } : {}),
      ...(v(c.area_total_m2) != null ? { area_total_m2: v(c.area_total_m2) as number } : {}),
      ...(v(c.area_privativa_m2) != null ? { area_privativa_m2: v(c.area_privativa_m2) as number } : {}),
      ...(v(c.quartos) != null ? { quartos: v(c.quartos) as number } : {}),
      ...(v(c.banheiros) != null ? { banheiros: v(c.banheiros) as number } : {}),
      ...(v(c.vagas_garagem) != null ? { vagas_garagem: v(c.vagas_garagem) as number } : {}),
      ...(v(c.andar) != null ? { andar: v(c.andar) as number } : {}),
      ...(v(c.ano_construcao) != null ? { ano_construcao: v(c.ano_construcao) as number } : {}),
      ...(v(c.valor_compra) != null ? { valor_compra: v(c.valor_compra) as number } : {}),
      ...(v(c.data_compra) != null ? { data_compra: v(c.data_compra) as string } : {}),
      ...(v(c.valor_aluguel) != null ? { valor_aluguel: v(c.valor_aluguel) as number } : {}),
    }));
    setDocResult(null);
  };

  const salvar = async () => { setSalvando(true); await onSalvar(f); setSalvando(false); onFechar(); };

  const buscarCep = async () => {
    const cep = (f.cep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) { alert('CEP inválido'); return; }
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await res.json();
      if (d.erro) { alert('CEP não encontrado'); return; }
      setF(p => ({ ...p, endereco: d.logradouro || p.endereco, bairro: d.bairro || p.bairro, cidade: d.localidade || p.cidade, uf: d.uf || p.uf }));
    } catch { alert('Erro ao buscar CEP'); }
    finally { setBuscandoCep(false); }
  };

  const estimarIA = async () => {
    if (!f.area_total_m2 || !f.cidade) { alert('Preencha ao menos área total e cidade para estimar'); return; }
    setEstimando(true); setEstimativa(null);
    try {
      const prompt = `Você é um especialista em avaliação imobiliária no Brasil.
Estime o valor de mercado do seguinte imóvel com base nas características fornecidas. Retorne APENAS um JSON:
{"valor_estimado":number,"valor_m2":number,"faixa_minima":number,"faixa_maxima":number,"justificativa":"string curta (2-3 linhas)","fontes_referencia":"string"}

Imóvel:
Tipo: ${f.tipo}
Localização: ${f.bairro ?? ''}, ${f.cidade} - ${f.uf}
Endereço: ${f.endereco ?? ''}
Área total: ${f.area_total_m2} m²
${f.area_privativa_m2 ? `Área privativa: ${f.area_privativa_m2} m²` : ''}
Quartos: ${f.quartos ?? '?'} | Banheiros: ${f.banheiros ?? '?'} | Vagas: ${f.vagas_garagem ?? '?'}
Padrão: ${f.padrao_acabamento ?? '?'}
Conservação: ${f.estado_conservacao ?? '?'}
Ano construção: ${f.ano_construcao ?? '?'}
Uso atual: ${f.uso_atual ?? '?'}`;
      const raw = await chamarClaude(prompt);
      const j = JSON.parse(raw);
      setEstimativa({ valor: j.valor_estimado, faixa_min: j.faixa_minima, faixa_max: j.faixa_maxima, valor_m2: j.valor_m2, justificativa: j.justificativa, fontes: j.fontes_referencia });
    } catch (e) { alert(e instanceof Error ? e.message : 'Erro na estimativa'); }
    finally { setEstimando(false); }
  };

  const usarEstimativa = () => {
    if (!estimativa) return;
    setF(p => ({ ...p, valor_mercado: estimativa.valor, metodo_estimativa_imovel: 'claude_ai' as const,
      estimativa_claude: { valor: estimativa.valor, faixa_min: estimativa.faixa_min, faixa_max: estimativa.faixa_max, justificativa: estimativa.justificativa, data: new Date().toISOString().slice(0, 10) } }));
    setEstimativa(null);
  };

  const G2 = 'grid grid-cols-2 gap-2';
  const G3 = 'grid grid-cols-3 gap-2';
  const campo = (k: string, label: string, type = 'text', extra?: Record<string, unknown>) => (
    <div><p className={LBL} style={{ color: '#6b6b8a' }}>{label}</p><input type={type} value={(f as unknown as Record<string, unknown>)[k] as string ?? ''} onChange={e => set(k, type === 'number' ? Number(e.target.value) : e.target.value)} className={INP} style={BRD} {...extra} /></div>
  );

  return (
    <Modal aberto onFechar={onFechar} titulo={f.id ? 'Editar Imóvel' : 'Adicionar Imóvel'}>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Upload de documento */}
        {!docResult && !parseando && (
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); const f2 = e.dataTransfer.files[0]; if (f2) handleDocUpload(f2); }}
            className="border border-dashed rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors" style={{ borderColor: '#e2e2e8' }}>
            <FileUp size={16} style={{ color: '#0065FF' }} />
            <div><p className="text-xs font-medium" style={{ color: '#160F41' }}>Preencher com documento</p><p className="text-[10px]" style={{ color: '#94a3b8' }}>Contrato, escritura, matrícula, IPTU — arraste o PDF</p></div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f2 = e.target.files?.[0]; if (f2) handleDocUpload(f2); }} />
          </div>
        )}
        {parseando && (
          <div className="rounded-lg p-4 text-center" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: '#0065FF' }} />
            <p className="text-xs" style={{ color: '#6b6b8a' }}>Analisando documento com IA...</p>
          </div>
        )}
        {docResult && (
          <DocumentParserPreview campos={docResult.campos as unknown as Record<string, CampoExtraido<unknown>>}
            documento_tipo={docResult.documento_tipo} avisos={docResult.avisos}
            onAplicar={aplicarDoc} onDescartar={() => setDocResult(null)} />
        )}
        {!parseando && !docResult && <div className="flex items-center gap-2"><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /><span className="text-[10px]" style={{ color: '#94a3b8' }}>ou preencha manualmente</span><div className="flex-1 border-t" style={{ borderColor: '#e2e2e8' }} /></div>}

        {/* Identificação */}
        <Secao titulo="Identificação" aberto toggle={() => {}}>
          {campo('descricao', 'Descrição*')}
          <div className={G2}>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Tipo*</p><select value={f.tipo} onChange={e => set('tipo', e.target.value)} className={INP} style={BRD}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>UF*</p><select value={f.uf} onChange={e => set('uf', e.target.value)} className={INP} style={BRD}>{UFS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
        </Secao>

        {/* Localização */}
        <Secao titulo="Localização" aberto toggle={() => {}}>
          <div className="flex gap-2 items-end">
            {campo('cep', 'CEP')}
            <button onClick={buscarCep} disabled={buscandoCep} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium shrink-0" style={{ border: '1px solid #e2e2e8', color: '#0065FF' }}>
              {buscandoCep ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />} Buscar CEP
            </button>
          </div>
          {campo('endereco', 'Endereço')}
          <div className={G2}>{campo('bairro', 'Bairro')}{campo('cidade', 'Cidade')}</div>
        </Secao>

        {/* Características */}
        <Secao titulo="Características" aberto toggle={() => {}}>
          <div className={G2}>{campo('area_total_m2', 'Área Total (m²)', 'number')}{campo('area_privativa_m2', 'Área Privativa (m²)', 'number')}</div>
          <div className={G3}>{campo('quartos', 'Quartos', 'number')}{campo('banheiros', 'Banheiros', 'number')}{campo('vagas_garagem', 'Vagas', 'number')}</div>
          <div className={G3}>
            {campo('andar', 'Andar', 'number')}{campo('ano_construcao', 'Ano construção', 'number')}
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Uso atual</p><select value={f.uso_atual ?? ''} onChange={e => set('uso_atual', e.target.value || undefined)} className={INP} style={BRD}><option value="">—</option>{['proprio','alugado','vazio','temporada'].map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <div className={G2}>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Padrão acabamento</p><select value={f.padrao_acabamento ?? ''} onChange={e => set('padrao_acabamento', e.target.value || undefined)} className={INP} style={BRD}><option value="">—</option>{['simples','medio','alto','luxo'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><p className={LBL} style={{ color: '#6b6b8a' }}>Conservação</p><select value={f.estado_conservacao ?? ''} onChange={e => set('estado_conservacao', e.target.value || undefined)} className={INP} style={BRD}><option value="">—</option>{['otimo','bom','regular','ruim'].map(e2 => <option key={e2} value={e2}>{e2}</option>)}</select></div>
          </div>
        </Secao>

        {/* Valores */}
        <Secao titulo="Valores" aberto toggle={() => {}}>
          {campo('valor_mercado', 'Valor de mercado*', 'number')}
          <div className={G2}>{campo('valor_compra', 'Valor de compra', 'number')}{campo('data_compra', 'Data de compra', 'date')}</div>
          <div className={G2}>{campo('valor_aluguel', 'Aluguel mensal', 'number')}{campo('valor_contabil', 'Valor contábil', 'number')}</div>
          <button onClick={estimarIA} disabled={estimando} className="flex items-center gap-1 text-xs font-medium mt-1" style={{ color: '#7c3aed' }}>
            {estimando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {estimando ? 'Estimando...' : 'Estimar com IA'}
          </button>
          {estimativa && (
            <div className="rounded-lg p-4 mt-2" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <span className="text-[10px] px-2 py-0.5 rounded font-medium text-white" style={{ backgroundColor: '#7c3aed' }}>Estimativa Claude AI</span>
              <p className="text-lg font-bold mt-2" style={{ color: '#16a34a' }}>{formatCurrency(estimativa.valor)}</p>
              <p className="text-xs" style={{ color: '#6b6b8a' }}>Faixa: {formatCurrency(estimativa.faixa_min)} — {formatCurrency(estimativa.faixa_max)}</p>
              <p className="text-xs" style={{ color: '#6b6b8a' }}>R$/m²: {formatCurrency(estimativa.valor_m2)}</p>
              <p className="text-xs italic mt-1" style={{ color: '#160F41' }}>{estimativa.justificativa}</p>
              <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>Fontes: {estimativa.fontes}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={usarEstimativa} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-white bg-green-600"><Check size={11} /> Usar este valor</button>
                <button onClick={() => setEstimativa(null)} className="px-3 py-1 rounded-lg text-xs" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Ignorar</button>
              </div>
            </div>
          )}
        </Secao>

        {/* Outros */}
        <Secao titulo="Outros" aberto={secOutros} toggle={() => setSecOutros(v => !v)}>
          <div><p className={LBL} style={{ color: '#6b6b8a' }}>Planejamento sucessório</p><textarea value={f.planejamento_sucessorio ?? ''} onChange={e => set('planejamento_sucessorio', e.target.value)} className={INP} style={BRD} rows={2} /></div>
          <div><p className={LBL} style={{ color: '#6b6b8a' }}>Notas</p><textarea value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} className={INP} style={BRD} rows={2} /></div>
        </Secao>
      </div>

      <div className="flex gap-3 justify-end mt-4 pt-4 border-t" style={{ borderColor: '#e2e2e8' }}>
        <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid #e2e2e8', color: '#6b6b8a' }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-brand disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

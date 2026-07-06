// GOLDEN TEST — parser de contagens jurídicas contra a transcrição validada Jan–Jun 2026.
// O projeto não tem runner (vitest/jest); o golden é este script versionado (família dos
// harness). Roda: npx tsx scripts/juridico-golden.ts — exit 0 = passou, exit 1 = divergiu.
// Se o parser mudar e quebrar a lista fixada, ESTE TESTE ACUSA (P4). O PDF em test-fixtures/
// é referência HUMANA (o que o operador olha ao colar), não input de máquina.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseContagens } from '../src/features/juridico/import/parseContagens';

// Contagens ESPERADAS (fixadas). Alterar só com nova validação do CFO.
const ESPERADO: Record<string, number> = {
  'Rede Ronaldo': 130, 'Lorena Improta': 71, 'Paulinho': 51, 'Richarlison': 42, 'Ronaldo': 22,
  'Galáticos': 16, 'Ronald': 15, 'Gabriel Girotto': 12, 'Luiz Henrique': 11, 'Arthur Cabral': 11,
  'Hariel Ribeiro': 8, 'Gabriel Jesus': 8, 'Cássio': 8, 'Celina Locks': 7, 'Djamila': 7,
  'Alan Kardec': 6, 'Thiago Mendes': 6, 'Matheus Bahia': 6, 'Leo Santana': 4, 'Samir': 4,
  'Lucas Silva': 4, 'Gregore': 3, 'Jean Paulo': 3, 'Leo Jardim': 3, 'Interno': 3,
  'João Schmidt': 2, 'Artur Guimarães': 2, 'Vanderlan': 2, 'Roger Guedes': 2, 'Emiliano': 2,
  'Diego Rosa': 1, 'Erik Ramirez': 1, 'João Victor': 1, 'Lucas Veríssimo': 1, 'Matheus Jussa': 1,
  'Nikão': 1, 'Ricardo Goulart': 1, 'Junior Cigano': 1, 'Kevin': 1, 'Allan Andrade': 1,
  'Hernane': 1, 'Malcom Filipe': 1,
};
const TOTAL_ESPERADO = 483;    // Σ todas (incl. CASA 19) — não-CASA = 464
const N_ESPERADO = 42;

const texto = readFileSync(join(process.cwd(), 'test-fixtures', 'consumo-juridico-jan-jun-2026.txt'), 'utf8');
const r = parseContagens(texto);

const falhas: string[] = [];
if (r.erros.length) falhas.push(`erros de parse: ${r.erros.map(e => `L${e.linha}(${e.motivo})`).join(', ')}`);
if (r.entradas.length !== N_ESPERADO) falhas.push(`nº entradas: ${r.entradas.length} ≠ ${N_ESPERADO}`);
if (r.total !== TOTAL_ESPERADO) falhas.push(`total: ${r.total} ≠ ${TOTAL_ESPERADO}`);
const obtido = new Map(r.entradas.map(e => [e.nome, e.contagem]));
for (const [nome, c] of Object.entries(ESPERADO)) {
  if (!obtido.has(nome)) falhas.push(`faltou "${nome}"`);
  else if (obtido.get(nome) !== c) falhas.push(`"${nome}": ${obtido.get(nome)} ≠ ${c}`);
}
for (const [nome] of obtido) if (!(nome in ESPERADO)) falhas.push(`extra "${nome}"`);

if (falhas.length) {
  console.error('✗ GOLDEN FALHOU:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log(`✓ GOLDEN OK — ${r.entradas.length} clientes, total ${r.total} (não-CASA 464), 0 erros de parse.`);
process.exit(0);

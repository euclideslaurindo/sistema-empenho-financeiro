// Resposta de GET /api/analises no formato da B2 (os mesmos números do teste
// de integração da B2: ano civil de 2026, até 27/10). Usada nos testes da tela.
import type { RespostaAnalises } from '@/components/analises/tela/tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'];
const LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro'];

const zeroMes = (i: number) => ({
  mes: `2026-${String(i + 1).padStart(2, '0')}`, rotulo: MESES[i], longo: LONGOS[i],
  empenhado: 0, pago: 0, ops: 0, irrf: 0, iss: 0, inss: 0, sest: 0, patronal: 0,
});

export function respostaExemplo(): RespostaAnalises {
  const meses = MESES.map((_, i) => zeroMes(i));
  Object.assign(meses[1], { empenhado: 1500, pago: 1000.1, ops: 2, irrf: 10, iss: 20, inss: 110, sest: 2.5, patronal: 200 });
  Object.assign(meses[2], { empenhado: 300 });
  Object.assign(meses[3], { pago: 306181.03, ops: 9 });
  Object.assign(meses[4], { empenhado: 0.2, pago: 0.2, ops: 1, irrf: 0.1 });
  Object.assign(meses[8], { empenhado: 200 });
  return {
    periodo: {
      tipo: 'ano', ano: 2026, inicio: '2026-01-01', fim: '2026-12-31', fimEfetivo: '2026-10-27', parcial: true, futuro: false,
      meses: meses.map((m) => m.mes), anterior: { inicio: '2025-01-01', fim: '2025-10-27' },
      rotulo: '2026 (até 27/10)', rotuloComparacao: 'jan–out/2025',
    },
    base: 'civil', elemento: null, anos: [2026, 2025],
    criterios: ['Ano civil: OPs pela data de pagamento.', 'Ponte: posição de 27/10/2026.', 'Comparação com jan–out/2025.', 'DARF: pela competência.'],
    atualizadoEm: '2026-10-27T17:30:00.000Z',
    vazio: false,
    avisos: [],
    kpis: { empenhado: 2000.2, pago: 307181.33, saldo: 799.9, retido: 142.6, varEmpenhado: 100, varPago: 25, varSaldo: null, varRetido: -3.2 },
    restos: 100, pagoDasNes: 307081.33, pagoAnteriores: 100, qtdOps: 12, qtdCredores: 2, qtdNes: 4, pctTransporte: 60, pctPagoDoEmpenhado: 53,
    ponte: { empenhado: 2000.2, cancelado: 300, liquido: 800.1, retencoes: 100.2, saldo: 799.9 },
    meses,
    elementos: [
      { codigo: '3.3.90.33', desc: 'Transporte', pago: 184308.8, pct: 60 },
      { codigo: '3.3.90.36', desc: 'Serviços PF', pago: 122872.53, pct: 40 },
    ],
    credores: [{ nome: 'Álvaro Souza', pago: 200000 }, { nome: 'Bruno Lima', pago: 107181.33 }],
    municipios: [{ nome: 'Garanhuns', pago: 150000 }, { nome: 'Caruaru', pago: 34308.8 }],
    darf: meses.map((m, i) => ({ mes: m.mes, rotulo: m.rotulo, paga: i === 1 ? 312.5 : 0, pendente: i === 8 ? 50 : 0 })),
    nes: [
      { nome: 'A pagar', qtd: 1, valor: 200 },
      { nome: 'Parcial', qtd: 1, valor: 1500 },
      { nome: 'Paga', qtd: 1, valor: 0.2 },
      { nome: 'Cancelada', qtd: 1, valor: 300 },
    ],
    resumo: [
      { t: 'Em 2026 (até 27/10) foram pagos ', forte: false },
      { t: 'R$ 307 mil', forte: true },
      { t: ' a ', forte: false },
      { t: '2 credores', forte: true },
      { t: ', 25% a mais que em jan–out/2025. Das NEs empenhadas no período, restam ', forte: false },
      { t: 'R$ 799,90', forte: true },
      { t: ' a pagar.', forte: false },
    ],
  } as RespostaAnalises;
}

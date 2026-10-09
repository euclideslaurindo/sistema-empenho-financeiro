import { describe, test, expect } from 'vitest';
import { calcularTransporteAutonomo, dec, type EntradaTransporte, type FaixaIrrf, type ParametrosTransporte } from '@/lib/retencoes-transporte';
import { normalizarMunicipio, perfilDoElemento } from '@/lib/perfis-calculo';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import fixture from '../../docs/projeto-retencoes-v2/fixtures/eja-campo-5a-parcela.json';

// Seed da T24 (migration_16), como o MySQL devolve DECIMAL: texto.
const PARAMETROS: ParametrosTransporte = {
  base_percentual: '20.000000',
  inss_percentual: '11.000000',
  patronal_percentual: '20.000000',
  sest_percentual: '1.500000',
  senat_percentual: '1.000000',
  irrf_tributavel_percentual: '60.000000',
  desconto_simplificado: '607.200000',
  redutor_constante: '978.620000',
  redutor_coeficiente: '0.133145',
};
const FAIXAS: FaixaIrrf[] = [
  { ordem: 1, limiteAte: '2428.80', aliquota: '0.0000', parcelaDeduzir: '0.00' },
  { ordem: 2, limiteAte: '2826.65', aliquota: '7.5000', parcelaDeduzir: '182.16' },
  { ordem: 3, limiteAte: '3751.05', aliquota: '15.0000', parcelaDeduzir: '394.16' },
  { ordem: 4, limiteAte: '4664.68', aliquota: '22.5000', parcelaDeduzir: '675.49' },
  { ordem: 5, limiteAte: null, aliquota: '27.5000', parcelaDeduzir: '908.73' },
];
const TAXAS: Record<string, string> = { canhotinho: '15.20', capoeiras: '3.94', iati: '6.90', jucati: '3.00', jupi: '6.76' };
const CONFIG: ConfigRetencaoCampoMapeado[] = [
  ['irrf', 'IRRF'], ['iss', 'ISS'], ['inss', 'INSS'], ['patronal', 'Patronal'], ['sest_senat', 'SEST/SENAT'],
  ['outros', 'Outros'], ['taxa_bancaria', 'Taxa bancária'], ['taxa_pix', 'Taxa PIX'],
].map(([campo, rotulo], i) => ({
  campo, rotulo, tipo: i < 5 ? 'PERCENTUAL' : 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: i < 5,
  editavelOperador: campo.startsWith('taxa'), entraDarf: ['inss', 'patronal', 'sest_senat'].includes(campo), ativo: true, ordem: i,
}));

function entrada(brutoReais: number, municipio: string | null, over: Partial<EntradaTransporte> = {}): EntradaTransporte {
  const chave = normalizarMunicipio(municipio);
  return {
    brutoCents: Math.round(brutoReais * 100),
    elementoCodigo: '3.3.90.33',
    vigencia: '2026-01-01',
    parametros: PARAMETROS,
    faixas: FAIXAS,
    issMunicipio: municipio ? { nome: municipio, aliquota: '5.0000', taxaExpediente: TAXAS[chave] ?? '0.00' } : null,
    municipioCredor: municipio,
    credorMei: false,
    config: CONFIG,
    informados: {},
    perfil: 'GESTOR',
    ...over,
  };
}

const reais = (r: ReturnType<typeof calcularTransporteAutonomo>, campo: string) => (r.itens[campo] ?? 0) / 100;

describe('perfil e município', () => {
  test('só o 3.3.90.33 é transporte', () => {
    expect(perfilDoElemento('3.3.90.33')).toBe('TRANSPORTE_AUTONOMO');
    expect(perfilDoElemento('3.3.90.36')).toBe('PADRAO');
    expect(perfilDoElemento(null)).toBe('PADRAO');
  });
  test('normalizarMunicipio', () => {
    expect(normalizarMunicipio('  São   Bento do Una/PE ')).toBe('sao bento do una');
    expect(normalizarMunicipio('Águas Belas - PE')).toBe('aguas belas');
    expect(normalizarMunicipio('Brejão')).toBe('brejao');
  });
  test('dec lê DECIMAL como texto, sem float', () => {
    expect(dec('0.133145')).toBe(133145000000n);
    expect(dec('978.620000')).toBe(978620000000000n);
  });
});

describe('calcularTransporteAutonomo — casos do README', () => {
  test('Caso G: 11.970,00 em Águas Belas', () => {
    const r = calcularTransporteAutonomo(entrada(11970, 'Águas Belas'));
    expect(reais(r, 'irrf')).toBe(899.34);
    expect(reais(r, 'iss')).toBe(598.5);
    expect(reais(r, 'inss')).toBe(263.34);
    expect(r.snapshot.sest).toBe(35.91);
    expect(r.snapshot.senat).toBe(23.94);
    expect(reais(r, 'sest_senat')).toBe(59.85);
    expect(reais(r, 'patronal')).toBe(478.8);
    expect(r.informativos).toEqual(['patronal']);
    expect(r.liquidoCents / 100).toBe(10148.97); // patronal fora do total
  });

  test('Caso H: 6.317,50 em Canhotinho (taxa de expediente 15,20)', () => {
    const r = calcularTransporteAutonomo(entrada(6317.5, 'Canhotinho'));
    expect(reais(r, 'irrf')).toBe(0);
    expect(reais(r, 'iss')).toBe(331.08); // 315,875 + 15,20
    expect(reais(r, 'inss')).toBe(138.99);
    expect(r.snapshot.sest).toBe(18.95);
    expect(r.snapshot.senat).toBe(12.64);
    expect(r.liquidoCents / 100).toBe(5815.84);
  });

  test('Bartolomeu: 6.288,30 em Bom Conselho — desconto adicional maior que o IRRF zera', () => {
    const r = calcularTransporteAutonomo(entrada(6288.3, 'Bom Conselho'));
    expect(r.snapshot.irrf_tabela).toBeCloseTo(80.71, 2);
    expect(r.snapshot.desc_adicional).toBeCloseTo(141.36, 2);
    expect(reais(r, 'irrf')).toBe(0);
  });
});

describe('regras complementares', () => {
  test('taxa de expediente só soma onde existe', () => {
    const comTaxa = calcularTransporteAutonomo(entrada(1000, 'Jupi'));
    const semTaxa = calcularTransporteAutonomo(entrada(1000, 'Garanhuns'));
    expect(reais(comTaxa, 'iss')).toBe(56.76);
    expect(reais(semTaxa, 'iss')).toBe(50);
  });

  test('município sem cadastro: 5%, sem taxa, com aviso (não bloqueia)', () => {
    const r = calcularTransporteAutonomo(entrada(1000, null, { municipioCredor: 'Recife' }));
    expect(reais(r, 'iss')).toBe(50);
    expect(r.avisos.join(' ')).toContain('Município sem cadastro de ISS');
    expect(r.snapshot.municipio).toBe('Recife');
    expect(r.snapshot.municipio_cadastrado).toBe(false);
  });

  test('MEI: todas as retenções zeradas, líquido = bruto', () => {
    const r = calcularTransporteAutonomo(entrada(11970, 'Águas Belas', { credorMei: true }));
    for (const c of ['irrf', 'iss', 'inss', 'patronal', 'sest_senat']) expect(r.itens[c]).toBe(0);
    expect(r.liquidoCents).toBe(1197000);
    expect(r.avisos).toContain('Credor MEI: isento de retenções.');
  });

  test('taxa bancária digitada entra no total; GESTOR não sobrescreve IRRF', () => {
    const r = calcularTransporteAutonomo(entrada(11970, 'Águas Belas', { informados: { taxa_bancaria: 850, irrf: 1 } }));
    expect(reais(r, 'taxa_bancaria')).toBe(8.5);
    expect(reais(r, 'irrf')).toBe(899.34);
    expect(r.liquidoCents / 100).toBe(10140.47);
  });

  test('intermediários guardados sem arredondar para centavos', () => {
    const r = calcularTransporteAutonomo(entrada(11970.01, 'Águas Belas'));
    expect(r.snapshot.base_inss).toBe(2394.002);
    expect(r.snapshot.base_irrf).toBe(6574.806); // 60% de 11970,01 (7182,006) − 607,20
  });

  test('snapshot: rótulos sem % e patronal informativa (a impressão usa isso)', () => {
    const r = calcularTransporteAutonomo(entrada(11970, 'Águas Belas'));
    expect(r.snapshot.campos.patronal).toMatchObject({ rotulo: 'Patronal (informativa)', aliquota: null, informativo: true });
    expect(r.snapshot.campos.inss.aliquota).toBeNull();
    expect(r.snapshot.perfil).toBe('TRANSPORTE_AUTONOMO');
  });
});

describe('planilha EJA Campo inteira (91 linhas)', () => {
  test('todas dentro de 1 centavo; isentos zerados', () => {
    const campos: Array<[string, (r: any) => number]> = [
      ['irrf', (r) => reais(r, 'irrf')],
      ['iss', (r) => reais(r, 'iss')],
      ['inss', (r) => reais(r, 'inss')],
      ['patronal', (r) => reais(r, 'patronal')],
      ['sest', (r) => r.snapshot.sest],
      ['senat', (r) => r.snapshot.senat],
      ['liquido', (r) => r.liquidoCents / 100],
    ];
    let exatas = 0;
    const comDiferenca: string[] = [];
    for (const l of fixture.linhas) {
      const r = calcularTransporteAutonomo(entrada(l.bruto, l.municipio, { credorMei: l.isento }));
      let maiorDif = 0;
      for (const [campo, ler] of campos) {
        const dif = Math.abs(Math.round((ler(r) - (l.esperado as any)[campo]) * 100));
        expect(dif, `${l.id} ${campo}`).toBeLessThanOrEqual(1);
        maiorDif = Math.max(maiorDif, dif);
      }
      if (maiorDif === 0) exatas++;
      else comDiferenca.push(l.id);
    }
    // Registro do resultado (a T28 transforma isso no teste de conformidade formal).
    console.info(`EJA Campo: ${exatas} exatas, ${comDiferenca.length} com 1 centavo: ${comDiferenca.join(', ')}`);
    expect(exatas + comDiferenca.length).toBe(91);
  });
});

describe('sobrescrita do ADMIN em credor MEI no transporte (T26)', () => {
  test('ADMIN digita; GESTOR continua isento', () => {
    const admin = calcularTransporteAutonomo(
      entrada(11970, 'Águas Belas', { credorMei: true, sobrescreverMei: true, perfil: 'ADMIN', informados: { inss: 26334 } })
    );
    expect(reais(admin, 'inss')).toBe(263.34);
    expect(reais(admin, 'irrf')).toBe(0);
    expect(admin.snapshot.mei_sobrescrito).toBe(true);

    const gestor = calcularTransporteAutonomo(
      entrada(11970, 'Águas Belas', { credorMei: true, sobrescreverMei: true, perfil: 'GESTOR', informados: { inss: 26334 } })
    );
    expect(reais(gestor, 'inss')).toBe(0);
    expect(gestor.snapshot.mei_sobrescrito).toBeUndefined();
  });
});

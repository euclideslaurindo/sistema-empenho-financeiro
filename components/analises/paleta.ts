// Cores dos gráficos (validadas para daltonismo e contraste na B1).
// Âmbar tem um significado só: o que ainda falta pagar ou recolher.
export const paleta = {
  azul: '#1e3a8a',
  azulClaro: '#9fb2dc',
  azulMedio: '#5a73b5',
  ambar: '#e08a00',
  ambarTexto: '#8a4b00',
  verde: '#1f8a4c',
  cinza: '#94a3b8',
  /** Ordem fixa das séries categóricas (retenções: INSS, ISS, IRRF, SEST/SENAT, Patronal). */
  categoricas: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  hachuraCinza: 'repeating-linear-gradient(135deg, #94a3b8 0 3px, #cbd5e1 3px 6px)',
  hachuraPatronal: 'repeating-linear-gradient(45deg, #e87ba4 0 3px, #f6c9da 3px 6px)',
  /** Texto: nunca na cor da série. */
  texto: '#0f172a',
  textoSecundario: '#334155',
  textoMudo: '#5b6678',
  grade: '#e2e7ef',
  eixo: '#94a3b8',
} as const;

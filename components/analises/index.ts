// Componentes de gráfico da aba Análises (B3). A fonte dos títulos fica em
// ./fonte (só a página importa: o next/font não roda fora do Next).
export { CartaoGrafico } from './CartaoGrafico';
export { ComDica } from './Dica';
export { Legenda, type ItemLegenda } from './Legenda';
export { TabelaDados, type DadosTabela } from './TabelaDados';
export { Cascata, calcularCascata, type EtapaCascata } from './graficos/Cascata';
export { BarrasAgrupadas, type Categoria, type Serie, type Valores } from './graficos/BarrasAgrupadas';
export { BarrasVerticais, type ItemVertical } from './graficos/BarrasVerticais';
export { FaixaQuantidade } from './graficos/FaixaQuantidade';
export { BarrasEmpilhadas } from './graficos/BarrasEmpilhadas';
export { BarrasHorizontais, type ItemHorizontal } from './graficos/BarrasHorizontais';
export { paleta } from './paleta';
export { brl, curto, pct1 } from './formato';
export { teto, pct, gradeDoEixo, ESPACO_TOPO } from './escala';

"use client";
import { CartaoGrafico } from "../CartaoGrafico";
import { Cascata } from "../graficos/Cascata";
import { BarrasAgrupadas } from "../graficos/BarrasAgrupadas";
import { BarrasVerticais } from "../graficos/BarrasVerticais";
import { FaixaQuantidade } from "../graficos/FaixaQuantidade";
import { BarrasEmpilhadas } from "../graficos/BarrasEmpilhadas";
import { BarrasHorizontais } from "../graficos/BarrasHorizontais";
import {
  montarCredores,
  montarDarf,
  montarElementos,
  montarExecucao,
  montarMunicipios,
  montarNes,
  montarPagamentos,
  montarPonte,
  montarRetencoes,
} from "./montar";
import type { RespostaAnalises } from "./tipos";

/** A ponte e os 8 gráficos do protótipo aprovado, com os dados da API. */
export function GraficosAnalises({
  dados,
  onSelecionarMes,
  onSelecionarElemento,
}: {
  dados: RespostaAnalises;
  onSelecionarMes: (mes: string) => void;
  onSelecionarElemento: (codigo: string) => void;
}) {
  const ponte = montarPonte(dados);
  const exec = montarExecucao(dados);
  const elem = montarElementos(dados);
  const pag = montarPagamentos(dados);
  const cred = montarCredores(dados);
  const ret = montarRetencoes(dados);
  const darf = montarDarf(dados);
  const nes = montarNes(dados);
  const mun = montarMunicipios(dados);
  const fim = dados.periodo.fimEfetivo.split("-").reverse().join("/");

  return (
    <div className="flex flex-col gap-6">
      <CartaoGrafico id="ponte" sobretitulo={`Ponte do orçamento · NEs empenhadas no período, posição em ${fim}`} titulo={ponte.titulo} tabela={ponte.tabela} vazio={ponte.vazio} nota="Empenhado − cancelado − líquido pago − retenções e descontos = saldo a pagar. A área âmbar é o que ainda falta pagar.">
        <Cascata etapas={ponte.props.etapas} />
      </CartaoGrafico>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CartaoGrafico id="exec" sobretitulo="Execução mês a mês" titulo={exec.titulo} legenda={exec.legenda} tabela={exec.tabela} vazio={exec.vazio} nota="Clique num mês para ver as OPs pagas nele.">
          <BarrasAgrupadas {...exec.props} onSelecionar={onSelecionarMes} />
        </CartaoGrafico>

        <CartaoGrafico id="elem" sobretitulo="Pago por elemento de despesa" titulo={elem.titulo} tabela={elem.tabela} vazio={elem.vazio} nota="Clique num elemento para filtrar a página por ele.">
          <BarrasHorizontais {...elem.props} onSelecionar={(c) => c !== "sem-elemento" && onSelecionarElemento(c)} />
        </CartaoGrafico>

        <CartaoGrafico id="pag" sobretitulo="Pagamentos por mês" titulo={pag.titulo} tabela={pag.tabela} vazio={pag.vazio} nota="Valor e quantidade em gráficos separados, cada um com a sua escala.">
          <div className="flex flex-col gap-3">
            <BarrasVerticais itens={pag.props.itens} destaque={pag.props.destaque} onSelecionar={onSelecionarMes} />
            <FaixaQuantidade titulo="Quantidade de OPs" itens={pag.props.ops} />
          </div>
        </CartaoGrafico>

        <CartaoGrafico id="cred" sobretitulo="Os 10 maiores credores" titulo={cred.titulo} tabela={cred.tabela} vazio={cred.vazio}>
          <BarrasHorizontais {...cred.props} larguraRotulo={170} />
        </CartaoGrafico>

        <CartaoGrafico id="ret" sobretitulo="Retenções e encargos por mês" titulo={ret.titulo} legenda={ret.legenda} tabela={ret.tabela} vazio={ret.vazio} nota="A Patronal (hachurada) é informativa: aparece na OP e na DARF, mas não é descontada do credor.">
          <BarrasEmpilhadas {...ret.props} />
        </CartaoGrafico>

        <CartaoGrafico id="darf" sobretitulo="DARF por competência" titulo={darf.titulo} legenda={darf.legenda} tabela={darf.tabela} vazio={darf.vazio} nota="INSS, Patronal e SEST/SENAT. Segue a competência: não muda com a base nem com o elemento.">
          <BarrasEmpilhadas {...darf.props} altura={170} />
        </CartaoGrafico>

        <CartaoGrafico id="nes" sobretitulo="Situação das NEs do período" titulo={nes.titulo} tabela={nes.tabela} vazio={nes.vazio} nota="Na mesma posição da ponte: o fim do período.">
          <BarrasVerticais itens={nes.props.itens} rotulosNoTopo="todos" grade={false} altura={170} />
        </CartaoGrafico>

        <CartaoGrafico id="mun" sobretitulo="Transporte (3.3.90.33) por município" titulo={mun.titulo} tabela={mun.tabela} vazio={mun.vazio} nota="Pelo município do credor (Município do Expediente).">
          <BarrasHorizontais {...mun.props} larguraRotulo={150} />
        </CartaoGrafico>
      </div>
    </div>
  );
}

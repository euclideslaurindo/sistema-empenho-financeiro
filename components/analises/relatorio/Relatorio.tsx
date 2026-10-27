"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { Cascata } from "../graficos/Cascata";
import { BarrasAgrupadas } from "../graficos/BarrasAgrupadas";
import { Legenda } from "../Legenda";
import { brl, curto, pct1 } from "../formato";
import { montarExecucao, montarPonte } from "../tela/montar";
import type { RespostaAnalises } from "../tela/tipos";
import { Folha } from "./Folha";
import { elementosDoRelatorio, linhasDaPonte, retidoPorTipo } from "./montar-relatorio";

export interface IdentificacaoRelatorio {
  orgao: string;
  setor: string;
}

const serif = { fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif" };
const titulo2 = "m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#374151]";
const th = "border-b border-[#6b7280] py-1 text-left text-[11px] font-bold";
const td = "border-b border-[#e5e7eb] py-[3px]";

function Cabecalho({ id }: { id: IdentificacaoRelatorio }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-[#111827] pb-2.5" data-testid="relatorio-cabecalho">
      <Image src="/brasao_pernambuco.png" alt="Brasão de Pernambuco" width={38} height={42} className="h-[42px] w-auto flex-none" />
      <div className="flex min-w-0 flex-col text-[12px] leading-snug">
        <strong className="uppercase tracking-[0.12em]">Estado de Pernambuco</strong>
        {id.orgao && <span className="break-words">{id.orgao}</span>}
        {id.setor && <span className="break-words text-[#374151]">{id.setor}</span>}
      </div>
    </div>
  );
}

function Rodape({ emitido, pagina }: { emitido: string; pagina: number }) {
  return (
    <footer className="mt-auto flex justify-between border-t border-[#9ca3af] pt-2 text-[11px] text-[#374151]">
      <span>Relatório de Execução Financeira · emitido em {emitido}</span>
      <span>Página {pagina} de 2</span>
    </footer>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className={titulo2}>{titulo}</h2>
      {children}
    </section>
  );
}

/** O relatório A4 de prestação de contas: 2 folhas fixas, com os números da API (B2). */
export function Relatorio({ dados, identificacao, emitidoEm }: { dados: RespostaAnalises; identificacao: IdentificacaoRelatorio; emitidoEm: Date }) {
  const p = dados.periodo;
  const emitido = `${emitidoEm.toLocaleDateString("pt-BR")} às ${emitidoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const k = dados.kpis;
  const ponte = montarPonte(dados);
  const exec = montarExecucao(dados);
  const elementos = elementosDoRelatorio(dados.elementos);
  const retido = retidoPorTipo(dados.meses);
  const varTxt = (x: number | null) => (x === null ? "sem base de comparação" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${pct1(Math.abs(x))} sobre ${p.rotuloComparacao}`);
  const cartoes = [
    { nome: "Empenhado", valor: k.empenhado, v: k.varEmpenhado },
    { nome: "Pago no período", valor: k.pago, v: k.varPago },
    { nome: "Saldo a pagar", valor: k.saldo, v: k.varSaldo },
    { nome: "Retido dos credores", valor: k.retido, v: k.varRetido },
  ];

  return (
    <div className="flex flex-col gap-8 print:gap-0">
      <Folha pagina={1} total={2}>
        <div className="flex h-full flex-col gap-4">
          <Cabecalho id={identificacao} />
          <header className="flex flex-col gap-1">
            <h1 className="m-0 text-[28px] font-semibold leading-tight" style={serif}>
              Relatório de Execução Financeira
            </h1>
            <p className="m-0 text-[12px] leading-relaxed text-[#374151]">
              Período: {p.rotulo} ({p.inicio.split("-").reverse().join("/")} a {p.fimEfetivo.split("-").reverse().join("/")}) · Base:{" "}
              {dados.base === "civil" ? "ano civil (data do pagamento)" : "exercício da NE"}
              {dados.elemento ? ` · Elemento: ${dados.elemento}` : ""}
              <br />
              Comparação: {p.rotuloComparacao} · Emitido em {emitido}
            </p>
          </header>

          <Bloco titulo="Resumo">
            <p className="m-0 text-[14px] leading-relaxed" style={serif} data-testid="relatorio-resumo">
              {dados.resumo.map((x, i) => (x.forte ? <strong key={i}>{x.t}</strong> : <span key={i}>{x.t}</span>))}
            </p>
          </Bloco>

          <div className="grid grid-cols-4 border-y border-[#9ca3af]">
            {cartoes.map((c, i) => (
              <div key={c.nome} className={`flex min-w-0 flex-col gap-0.5 py-2.5 ${i ? "border-l border-[#d1d5db] pl-3" : ""}`}>
                <span className="text-[11px] font-bold text-[#374151]">{c.nome}</span>
                <span className="text-[15px] font-bold">{brl(c.valor)}</span>
                <span className="text-[11px] text-[#374151]">{varTxt(c.v)}</span>
              </div>
            ))}
          </div>

          <Bloco titulo={`1. Ponte do orçamento · NEs empenhadas no período, posição em ${p.fimEfetivo.split("-").reverse().join("/")}`}>
            <p className="m-0 text-[16px] font-semibold" style={serif}>
              {ponte.titulo}
            </p>
            {!ponte.vazio && <Cascata etapas={ponte.props.etapas} altura={190} />}
            <table className="w-full border-collapse text-[12px]">
              <caption className="sr-only">Ponte do orçamento</caption>
              <thead>
                <tr>
                  <th className={th}>Etapa</th>
                  <th className={`${th} text-right`}>Valor</th>
                  <th className={`${th} text-right`}>% do empenhado</th>
                </tr>
              </thead>
              <tbody>
                {linhasDaPonte(dados.ponte).map((l) => (
                  <tr key={l.nome} className={l.forte ? "font-bold" : ""}>
                    <td className={td}>
                      {l.sinal} {l.nome}
                    </td>
                    <td className={`${td} text-right`}>{brl(l.valor)}</td>
                    <td className={`${td} text-right`}>{pct1(l.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>

          {dados.avisos.length > 0 && (
            <div className="border border-[#9ca3af] px-3 py-2 text-[11px] leading-snug" data-testid="relatorio-avisos">
              <strong>Atenção: </strong>
              {dados.avisos.join(" ")}
            </div>
          )}

          <Rodape emitido={emitido} pagina={1} />
        </div>
      </Folha>

      <Folha pagina={2} total={2}>
        <div className="flex h-full flex-col gap-4">
          <Cabecalho id={identificacao} />

          <Bloco titulo="2. Execução mês a mês">
            <p className="m-0 text-[15px] font-semibold" style={serif}>
              {exec.titulo}
            </p>
            <Legenda itens={exec.legenda} />
            {!exec.vazio && <BarrasAgrupadas {...exec.props} altura={140} />}
          </Bloco>

          <div className="grid grid-cols-2 gap-7">
            <Bloco titulo="3. Pago por elemento">
              <table className="w-full border-collapse text-[12px]" data-testid="relatorio-elementos">
                <caption className="sr-only">Pago por elemento</caption>
                <tbody>
                  {elementos.map((e) => (
                    <tr key={e.nome}>
                      <td className={`${td} max-w-0 truncate pr-2`} title={e.nome}>
                        {e.nome}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>{curto(e.pago)}</td>
                      <td className={`${td} w-12 text-right`}>{pct1(e.pct)}</td>
                    </tr>
                  ))}
                  {elementos.length === 0 && (
                    <tr>
                      <td className={td}>Sem pagamentos no período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Bloco>
            <Bloco titulo="4. Retido por tipo">
              <table className="w-full border-collapse text-[12px]">
                <caption className="sr-only">Retido por tipo</caption>
                <tbody>
                  {retido.tipos.map((x) => (
                    <tr key={x.nome}>
                      <td className={td}>{x.nome}</td>
                      <td className={`${td} text-right`}>{brl(x.valor)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className={td}>Total retido</td>
                    <td className={`${td} text-right`}>{brl(retido.total)}</td>
                  </tr>
                  <tr>
                    <td className={td}>Patronal (informativa)</td>
                    <td className={`${td} text-right`}>{brl(retido.patronal)}</td>
                  </tr>
                </tbody>
              </table>
            </Bloco>
          </div>

          <Bloco titulo="5. Os 10 maiores credores">
            <table className="w-full border-collapse text-[12px]" data-testid="relatorio-credores">
              <caption className="sr-only">Os 10 maiores credores</caption>
              <thead>
                <tr>
                  <th className={`${th} w-8`}>Nº</th>
                  <th className={th}>Credor</th>
                  <th className={`${th} text-right`}>Pago</th>
                  <th className={`${th} text-right`}>% do total</th>
                </tr>
              </thead>
              <tbody>
                {dados.credores.map((c, i) => (
                  <tr key={`${i}-${c.nome}`}>
                    <td className={td}>{i + 1}</td>
                    <td className={`${td} max-w-0 truncate pr-2`} title={c.nome}>
                      {c.nome}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>{brl(c.pago)}</td>
                    <td className={`${td} text-right`}>{k.pago > 0 ? pct1(Math.round((c.pago / k.pago) * 1000) / 10) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>

          <section className="flex flex-col gap-0.5 border border-[#9ca3af] px-3 py-2 text-[11px] leading-snug">
            <strong className="uppercase tracking-[0.1em]">Critérios</strong>
            {dados.criterios.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </section>

          <div className="mt-auto grid grid-cols-2 gap-10 pt-8 text-[11px] text-[#374151]" data-testid="relatorio-assinaturas">
            <div className="border-t border-[#111827] pt-1.5">Responsável pelo setor financeiro</div>
            <div className="border-t border-[#111827] pt-1.5">Ordenador de despesa</div>
          </div>

          <Rodape emitido={emitido} pagina={2} />
        </div>
      </Folha>
    </div>
  );
}

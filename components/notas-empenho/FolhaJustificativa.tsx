"use client";
import Image from "next/image";
import { Folha } from "@/components/analises/relatorio/Folha";
import { textosDaFolha, type DadosJustificativa } from "@/lib/justificativa-saldo";

/** B13: a folha A4 da justificativa, no formato do modelo da supervisão. */
export function FolhaJustificativa({ dados }: { dados: DadosJustificativa }) {
  const t = textosDaFolha(dados);
  return (
    <Folha pagina={1} total={1}>
      <div className="flex flex-col text-[11.5pt] leading-relaxed" style={{ fontFamily: "Calibri, Arial, sans-serif" }} data-testid="folha-justificativa">
        <header className="flex items-center justify-center gap-3 mb-8">
          <Image src="/brasao_pernambuco.png" alt="Brasão de Pernambuco" width={70} height={78} className="h-[78px] w-auto" />
          <div className="text-[9pt] leading-tight">
            <p className="font-bold m-0">GOVERNO DE PERNAMBUCO</p>
            <p className="m-0">Secretaria de Educação</p>
          </div>
        </header>

        <h1 className="text-center text-[12pt] font-normal uppercase m-0 mb-8">{t.titulo}</h1>

        <p className="m-0 mb-3">{t.subtitulo}</p>
        <p className="m-0 mb-3">{t.instrumento}</p>
        <p className="m-0 mb-3">{t.objeto}</p>
        <p className="m-0 mb-3">Prezados(as) Senhores(as),</p>
        <p className="m-0 mb-3 text-justify">{t.abertura}</p>
        <p className="m-0 mb-2">{t.introMotivos}</p>
        <ul className="m-0 mb-3 pl-6 list-disc" data-testid="folha-motivos">
          {t.motivos.map((m) => (
            <li key={m} className="mb-1 text-justify">
              {m}
            </li>
          ))}
        </ul>
        <p className="m-0 mb-3 text-justify">{t.ressalva}</p>
        <p className="m-0 mb-2 text-justify">{t.valorAtualizado}</p>
        {t.devolucao && (
          <ul className="m-0 mb-3 pl-6 list-disc">
            <li className="text-justify">{t.devolucao}</li>
          </ul>
        )}
        <p className="m-0 mb-14">{t.encerramento}</p>

        <div className="mx-auto w-[60%] border-t border-black mb-3" aria-hidden="true" />
        {t.assinatura.map((l) => (
          <p key={l} className="m-0 mb-1">
            {l}
          </p>
        ))}
      </div>
    </Folha>
  );
}

"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import { ALTURA_PALCO, LARGURA_PALCO, acaoDaTecla, escalaDoPalco, proximoSlide, type AcaoSlide } from "./navegacao";

const LIMITE_DESLIZE = 50;
const OCULTAR_CONTROLES_MS = 3000;

/** Campos de texto não perdem a tecla para a apresentação. */
const ehCampo = (alvo: EventTarget | null) => {
  const el = alvo as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/**
 * Palco 16:9 (1280×720 de desenho) escalado para caber na janela, por cima do
 * sistema. Teclado, toque, tela cheia e o número do slide no endereço (#n).
 */
export function Palco({
  slide,
  total,
  titulo,
  fundo,
  onMudar,
  onSair,
  children,
}: {
  slide: number;
  total: number;
  /** Título do slide atual (para o leitor de tela). */
  titulo: string;
  fundo: string;
  onMudar: (n: number) => void;
  onSair: () => void;
  children: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const toqueX = useRef<number | null>(null);
  const [escala, setEscala] = useState(1);
  const [telaCheia, setTelaCheia] = useState(false);
  const [avisoTelaCheia, setAvisoTelaCheia] = useState(false);
  const [controlesVisiveis, setControlesVisiveis] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Os handlers mudam a cada render; o ouvinte do window lê sempre o mais recente.
  const estado = useRef({ slide, total, onMudar, onSair });
  useEffect(() => {
    estado.current = { slide, total, onMudar, onSair };
  });

  const ir = (acao: AcaoSlide) => {
    const s = estado.current;
    const novo = proximoSlide(s.slide, acao, s.total);
    if (novo !== s.slide) s.onMudar(novo);
  };

  const alternarTelaCheia = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (raiz.current?.requestFullscreen) await raiz.current.requestFullscreen();
      else throw new Error("sem tela cheia");
    } catch {
      // O navegador recusou (ou não tem): os slides continuam funcionando.
      setAvisoTelaCheia(true);
    }
  };
  const telaCheiaRef = useRef(alternarTelaCheia);
  useEffect(() => {
    telaCheiaRef.current = alternarTelaCheia;
  });

  // Escala para a janela.
  useEffect(() => {
    const medir = () => setEscala(escalaDoPalco(window.innerWidth, window.innerHeight));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Teclado: só enquanto a apresentação está aberta (removido ao sair).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || ehCampo(e.target)) return;
      const acao = acaoDaTecla(e.key);
      if (!acao) return;
      e.preventDefault();
      if (acao === "sair") estado.current.onSair();
      else if (acao === "tela-cheia") void telaCheiaRef.current();
      else ir(acao);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Tela cheia: o ícone acompanha o estado real.
  useEffect(() => {
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  // A rolagem do sistema fica travada enquanto a apresentação está aberta.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    palco.current?.focus();
    return () => {
      document.body.style.overflow = antes;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const mostrarControles = () => {
    setControlesVisiveis(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setControlesVisiveis(false), OCULTAR_CONTROLES_MS);
  };

  const botao = "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-slate-900/70 px-3 text-sm font-semibold text-white hover:bg-slate-900 focus-visible:outline focus-visible:outline-3 focus-visible:outline-amber-400 disabled:opacity-30";

  return (
    <div
      ref={raiz}
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: fundo }}
      onMouseMove={mostrarControles}
      onTouchStart={(e) => {
        toqueX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = toqueX.current;
        const x1 = e.changedTouches[0]?.clientX;
        toqueX.current = null;
        if (x0 === null || x1 === undefined) return;
        const dx = x1 - x0;
        if (Math.abs(dx) >= LIMITE_DESLIZE) ir(dx < 0 ? "proximo" : "anterior");
        else if (Math.abs(dx) < 10 && !(e.target as HTMLElement).closest("button")) ir(x1 > window.innerWidth / 2 ? "proximo" : "anterior");
      }}
    >
      <div
        ref={palco}
        tabIndex={-1}
        role="group"
        aria-roledescription="slide"
        aria-label={`Slide ${slide} de ${total}: ${titulo}`}
        data-testid="palco"
        className="absolute left-1/2 top-1/2 outline-none motion-safe:transition-opacity"
        style={{ width: LARGURA_PALCO, height: ALTURA_PALCO, transform: `translate(-50%, -50%) scale(${escala})` }}
      >
        {children}
      </div>

      <div
        className={`absolute right-4 top-4 flex gap-2 transition-opacity focus-within:opacity-100 ${controlesVisiveis ? "opacity-100" : "opacity-0"}`}
        style={{ top: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <button type="button" onClick={() => void alternarTelaCheia()} aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} className={botao}>
          {telaCheia ? <Minimize aria-hidden="true" className="h-4 w-4" /> : <Maximize aria-hidden="true" className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onSair} className={botao}>
          <X aria-hidden="true" className="h-4 w-4" /> Sair
        </button>
      </div>

      {avisoTelaCheia && (
        <p role="status" className="absolute left-1/2 top-4 m-0 -translate-x-1/2 rounded-lg bg-slate-900/85 px-4 py-2 text-sm text-white">
          Use F11 para tela cheia.
        </p>
      )}

      <div className="absolute bottom-4 right-4 flex items-center gap-2" style={{ bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}>
        <span className="hidden text-xs text-white/80 mix-blend-difference sm:inline">← → para navegar</span>
        <button type="button" onClick={() => ir("anterior")} disabled={slide <= 1} aria-label="Slide anterior" className={botao}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="min-w-14 rounded-lg bg-slate-900/70 px-3 py-2 text-center text-sm font-bold text-white" data-testid="contador">
          {slide} / {total}
        </span>
        <button type="button" onClick={() => ir("proximo")} disabled={slide >= total} aria-label="Próximo slide" className={botao}>
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Tipos das respostas da API (B2). `import type` é apagado na compilação:
// nada do banco vem para a tela.
import type { listarOpsDoRecorte, obterAnalises } from '@/lib/services/analises.service';

export type RespostaAnalises = Awaited<ReturnType<typeof obterAnalises>>;
export type RespostaOps = Awaited<ReturnType<typeof listarOpsDoRecorte>>;
export type MesAnalise = RespostaAnalises['meses'][number];

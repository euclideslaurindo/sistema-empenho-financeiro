"use client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Props {
  linhas: string[] | null;
  salvando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Confirmação com o diff legível antes de gravar (padrão da T07). */
export default function ConfirmarDiffDialog({ linhas, salvando, onConfirmar, onCancelar }: Props) {
  return (
    <AlertDialog open={!!linhas} onOpenChange={(open) => !open && onCancelar()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
        <AlertDialogDescription className="mt-2 mb-3 text-sm font-bold text-amber-700">
          Vale para as OPs novas; OPs emitidas não mudam.
        </AlertDialogDescription>
        <ul className="list-disc pl-5 mb-6 space-y-1 text-sm text-slate-700 max-h-60 overflow-y-auto">
          {linhas?.map((linha, i) => (
            <li key={i}>{linha}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            disabled={salvando}
            className="bg-blue-900 hover:bg-blue-800 shadow-blue-900/20 focus:ring-blue-800"
          >
            {salvando ? "Salvando..." : "Confirmar e salvar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

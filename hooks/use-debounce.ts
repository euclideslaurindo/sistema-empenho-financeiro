import { useCallback, useEffect, useRef } from "react";

/**
 * Retorna uma versão "debounced" do callback: só executa depois de `delay`
 * ms sem novas chamadas, cancelando a anterior a cada nova chamada.
 *
 * O timer fica em useRef (não useState), então digitar não causa re-render
 * a cada tecla — só quando o callback de fato roda.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

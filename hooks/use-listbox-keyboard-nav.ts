"use client";
import { useCallback, useState } from "react";

/**
 * Navegação por teclado (Arrow Up/Down, Enter, Escape) para dropdowns de
 * sugestão tipo combobox. Compartilhado entre os autocompletes de NE,
 * CPF/CNPJ e Nome do Credor para não reimplementar a mesma lógica 3x.
 */
export function useListboxKeyboardNav<T>(options: T[], onSelect: (option: T) => void) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const reset = useCallback(() => setHighlightedIndex(-1), []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (options.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          e.preventDefault();
          onSelect(options[highlightedIndex]);
          reset();
        }
      } else if (e.key === "Escape") {
        reset();
      }
    },
    [options, highlightedIndex, onSelect, reset],
  );

  return { highlightedIndex, setHighlightedIndex, onKeyDown, reset };
}

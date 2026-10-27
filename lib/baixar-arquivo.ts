/**
 * Baixa um arquivo gerado pelo servidor. Usa fetch (e não um <a href> direto)
 * para conferir a resposta antes: um erro (401/400/500) baixaria o JSON da
 * mensagem como se fosse o arquivo.
 */
export async function baixarArquivo(url: string, nome: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new Error(corpo?.error || "Não foi possível exportar a planilha.");
  }
  const href = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = href;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

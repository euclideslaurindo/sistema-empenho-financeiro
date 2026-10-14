// Credores da NE (T15/T16) saíram na rodada 2 (T30): a NE não tem mais
// credor; os credores são escolhidos na Ordem de Pagamento. Fica só o
// utilitário ainda usado pelo seletor de credor da OP (até a T35).

export const somenteDigitos = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");

# TASK-15 — Serviço e API da NE com vários credores
<!-- milestone: M6 - NE com vários credores | labels: backend,api,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 6 Multi-credor | P1 | ~12 h | T14, T01 | R7 |

## Objetivo
Permitir criar e editar uma NE com **vários credores**, cada um com seu **valor bruto**, garantindo que **a soma dos brutos seja exatamente o valor da NE**.

## Contexto (estado atual)
- `NotasEmpenhoService.criar/atualizar` recebem `credorNome` e `cpfCnpj` únicos (`criarNotaEmpenhoSchema`), gravam `credor_nome`/`cpf_cnpj` e usam transação (`withTransaction`).
- `listar` e `buscarPorNumero` devolvem `credorNome`/`cpfCnpj` e `saldoDisponivel` (valor − soma das OPs).
- Existe `GET /api/notas-empenho/duplicidade` baseado em valor/credor/subelemento.

## Escopo
### Entra
1. Campo opcional `credores: [{ cpfCnpj, valorBruto }]` em `POST/PUT /api/notas-empenho`.
2. Gravação em `ne_credores` + colunas legadas (primeiro credor) na mesma transação.
3. `listar` e `buscarPorNumero` devolvendo `credores` com `valorBruto`, `valorPago` (OPs do credor na NE) e `saldo`.
4. **Fallback** para NEs antigas sem linhas em `ne_credores`: sintetizar um credor a partir das colunas legadas, com bruto = valor da NE (`legado: true`).
5. Adaptar a checagem de duplicidade.
6. Auditoria da NE incluindo a lista de credores.

### Não entra
Telas (T16), OP (T17).

## Especificação técnica
### Validações (todas em **centavos**, usando `toCents` da T01)
- `credores.length ≥ 1` quando o campo vier; `cpfCnpj` únicos; todos devem existir em `credores` e estar `ativo = 1` (o **nome** vem do banco, nunca do cliente).
- Cada `valorBruto > 0`.
- `Σ valorBruto == valor da NE`. Caso contrário **422** com mensagem objetiva: `"A soma dos valores brutos (R$ 9.500,00) difere do valor da NE (R$ 10.000,00). Falta R$ 500,00."` (ou "Sobra").
- Na **edição**:
  - não é possível remover credor que já tenha OP na NE → 409;
  - o bruto de um credor não pode ficar abaixo do que ele já recebeu em OPs → 409;
  - o valor da NE não pode ficar abaixo do total já pago (regra que já existe) e, ao mudar o valor, é obrigatório reenviar `credores` fechando a soma.
- NE **cancelada** não aceita alteração de credores.

### Retrocompatibilidade
- Se `credores` **não** vier, o comportamento atual (um credor via `credorNome`/`cpfCnpj`) continua funcionando e é convertido internamente em `credores` com bruto = valor da NE.
- Colunas legadas: recebem o **primeiro** credor (D7) para não quebrar os outros sistemas.

### Resposta (exemplo)
```json
{ "credores": [
  { "cpfCnpj": "11.111.111/0001-11", "nome": "Maria Cavalcanti ME", "valorBruto": 6000.00, "valorPago": 2500.00, "saldo": 3500.00 },
  { "cpfCnpj": "222.222.222-22",     "nome": "José Silva",          "valorBruto": 4000.00, "valorPago": 0.00,    "saldo": 4000.00 }
] }
```
- Evitar N+1: buscar os credores das NEs da página com um único `WHERE numero_ne IN (...)` e o pago por credor com um único `GROUP BY numero_ne, credor_cpf_cnpj`.

## Arquivos
- **Alterados:** `lib/services/notas-empenho.service.ts`, `app/api/notas-empenho/route.ts`, `app/api/notas-empenho/[id]/route.ts`, `app/api/notas-empenho/duplicidade/route.ts`, `lib/schemas.ts`, `lib/types/db.ts`
- **Testes:** `tests/integration/notas-empenho.test.ts`, `tests/integration/notas-empenho-id.test.ts`

## Critérios de aceite
- [ ] NE de 10.000,00 com brutos 6.000,00 + 4.000,00 → 201.
- [ ] Brutos 6.000,00 + 3.999,99 → 422 com "Falta R$ 0,01".
- [ ] Mesmo credor duas vezes → 400/409.
- [ ] Editar tirando um credor que já recebeu OP → 409.
- [ ] Payload antigo (um credor, sem `credores`) continua criando NE normalmente.
- [ ] NE antiga (sem `ne_credores`) é devolvida com um credor sintetizado.
- [ ] Colunas legadas recebem o primeiro credor.

## Riscos e observações
- Comparar sempre em centavos; nunca `===` entre somas de `number`.
- Perfil CONSULTA continua sem permissão de escrita (padrão atual do serviço).

## Decisões em aberto relacionadas
D7.

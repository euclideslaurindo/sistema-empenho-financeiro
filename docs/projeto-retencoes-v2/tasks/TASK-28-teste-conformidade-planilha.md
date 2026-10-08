# TASK-28 — Teste de conformidade com a planilha EJA Campo
<!-- milestone: M10 - Cálculo do transporte (3.3.90.33) | labels: testes,calculo,transporte,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 10 Transporte (.33) | P1 | ~8 h | T25, T10 | R11 |

## Objetivo
Garantir que o cálculo do sistema para o 3.3.90.33 **reproduz a planilha real** (EJA Campo, 5ª parcela/2026, NE 28925), usando as 91 linhas com bruto como casos de teste.

## Contexto
- O arquivo [`fixtures/eja-campo-5a-parcela.json`](../fixtures/eja-campo-5a-parcela.json) foi gerado a partir da planilha. **Os nomes dos motoristas foram removidos de propósito** (dados pessoais); cada linha tem só `id`, `municipio`, `bruto`, `isento` e os valores `esperado` que a planilha tem na aba Total.
- Das 91 linhas: **68** têm retenção, **23** estão zeradas (`isento: true`, tratadas como MEI).
- Com a regra de arredondamento combinada (T01), **5 linhas** ficam 1 centavo abaixo da planilha (marcadas com `divergenciaConhecida`). A planilha arredonda em dois passos (3 casas, depois 2).

## Escopo
### Entra
- Copiar o fixture para `tests/fixtures/eja-campo-5a-parcela.json`.
- `tests/unit/conformidade-eja-campo.test.ts` (Vitest): para cada linha, rodar o motor com `perfilCalculo = TRANSPORTE_AUTONOMO`, `municipioCredor`, `credorIsMei = isento` e a vigência 2026.
- Comparações, em centavos:
  - 63 linhas com retenção: **igualdade exata** em IR, ISS, INSS 11%, patronal, SEST, SENAT e líquido.
  - 5 linhas com `divergenciaConhecida`: diferença máxima de **1 centavo** em cada item; o teste **lista** essas linhas na saída (não silencia).
  - 23 linhas isentas: todas as retenções 0 e líquido = bruto.
  - **Totais** da planilha: bruto 799.918,45 · IR 32.443,43 · ISS 30.869,61 · INSS 11% 13.537,66 · patronal 24.613,85 · SEST 1.846,06 · SENAT 1.230,73 · líquido 719.990,96, com tolerância de até 5 centavos nos totais.
- Teste de **sanidade do fixture** (91 linhas; 68 + 23).

### Não entra
Importar a planilha pela interface (adiado).

## Critérios de aceite
- [ ] O teste roda no CI (`npm test`) e passa.
- [ ] A saída informa quantas linhas foram exatas (63), quantas tiveram tolerância (5) e quantas isentas (23).
- [ ] Se alguém alterar a fórmula ou um parâmetro de forma que o resultado saia da tolerância, o teste falha.
- [ ] O fixture **não contém nomes** de pessoas.

## Riscos e observações
- Se o supervisor decidir adotar o arredondamento em dois passos da planilha, basta mudar a função de arredondamento (T01); o teste passa a exigir igualdade exata nas 68 linhas.
- Os valores esperados vêm da planilha **como foi usada**; isso valida a fórmula, mas não substitui a conferência legal da tabela do IRRF (D22).

## Decisões em aberto relacionadas
D17, D22.

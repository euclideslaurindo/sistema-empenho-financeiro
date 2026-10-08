# TASK-25 — Perfil de cálculo "Transporte autônomo" (3.3.90.33)
<!-- milestone: M10 - Cálculo do transporte (3.3.90.33) | labels: backend,calculo,financeiro,transporte,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 10 Transporte (.33) | P0 | ~14 h | T10, T24, T01 | R11, R12, R13 |

## Objetivo
Implementar no motor (T10) a estratégia `TRANSPORTE_AUTONOMO`, que reproduz **exatamente** a planilha EJA Campo para o elemento **3.3.90.33**. Os demais elementos (.36, .39, .30, .47) continuam com os percentuais padrão.

## Contexto
A planilha (92 motoristas) usa, em todas as fichas, as mesmas fórmulas. Um teste meu com essas fórmulas reproduziu **68 de 68** motoristas com retenção; 23 estão zerados (isentos).

## Escopo
### Entra
- `lib/retencoes-transporte.ts` (puro): `calcularTransporteAutonomo(entrada, parametros, faixasIrrf, issMunicipio)`.
- Leitura dos parâmetros por **vigência** (T24) e do município do credor com **normalização** (T18).
- Integração em `calcularRetencoes` (T10): `perfilCalculo === 'TRANSPORTE_AUTONOMO'` chama esta estratégia.
- Endpoint de prévia usado pelo formulário (ver T10/T11) já cobrindo esta estratégia.

### Não entra
Telas de edição dos parâmetros (T27). Regra MEI (já está na T10, regra 0).

## Especificação técnica
Todos os passos intermediários usam **aritmética exata** (BigInt/decimal com ≥ 6 casas); só os **itens finais** são arredondados para centavos (T01), e **depois** somados.

| # | Passo | Fórmula |
|---|---|---|
| 1 | Base INSS | `bruto × base_percentual` (20%) — **sem arredondar** |
| 2 | INSS 11% | `base × inss_percentual` |
| 3 | Patronal | `base × patronal_percentual` — **informativa** |
| 4 | SEST / SENAT | `base × sest_percentual` e `base × senat_percentual` |
| 5 | Desc. simplificado | `máx(desconto_simplificado, INSS 11% sem arredondar)` |
| 6 | Base IRRF | `bruto × irrf_tributavel_percentual − desc. simplificado` |
| 7 | IRRF (tabela) | faixa da base: `base × alíquota − parcela a deduzir` (isento até o 1º limite) |
| 8 | Desc. adicional | `máx(0; redutor_constante − redutor_coeficiente × bruto)` — usa o **bruto**, como a planilha (D22) |
| 9 | IRRF final | `máx(0; IRRF − desc. adicional)` |
| 10 | ISS | `bruto × aliquota_do_municipio + taxa_expediente_do_municipio` |
| 11 | Total de descontos | IRRF final + ISS + INSS 11% + SEST + SENAT (**sem a patronal**) |
| 12 | Líquido | `bruto − total` |

Regras complementares:
- **Município:** vem do cadastro do credor (T18), normalizado. Sem cadastro na tabela de ISS → alíquota padrão (5%), taxa de expediente 0 e `aviso: "Município sem cadastro de ISS"` (não bloqueia).
- **Vigência:** se não houver parâmetros/faixas para a data de referência → **422** "Parâmetros de cálculo do transporte não cadastrados para a data".
- **MEI** continua sendo tratado antes (T10, regra 0): tudo zerado.
- No `retencoes_snapshot`: `perfil`, `vigencia`, `base_inss`, `base_irrf`, `desc_simplificado`, `desc_adicional`, `iss_aliquota`, `taxa_expediente`, `municipio`.
- Os campos `informados` pelo operador seguem a regra de sobrescrita da T10 (só campos liberados ou ADMIN).

## Arquivos
- **Novos:** `lib/retencoes-transporte.ts`, `lib/services/parametros-calculo.service.ts` (leitura por vigência), `tests/unit/retencoes-transporte.test.ts`
- **Alterados:** `lib/retencoes.ts`, `lib/services/ordem-pagamento.service.ts` (carregar parâmetros/município na transação), `lib/types/db.ts`

## Critérios de aceite
- [ ] Caso G do README (Cícero Neves, 11.970,00, Águas Belas): IRRF 899,34 · ISS 598,50 · INSS 263,34 · SEST 35,91 · SENAT 23,94 · patronal 478,80 (informativa) · **líquido 10.148,97**.
- [ ] Caso H (6.317,50, Canhotinho): IRRF 0,00 · ISS **331,08** (315,875 + 15,20) · INSS 138,99 · SEST 18,95 · SENAT 12,64 · **líquido 5.815,84**.
- [ ] Bartolomeu (6.288,30, Bom Conselho, **não** MEI): desc. adicional 141,36 > IRRF 80,71 → **IRRF 0,00**.
- [ ] Município com taxa de expediente soma a taxa; sem taxa não soma.
- [ ] O conjunto de testes da T28 passa (63 exatos + 5 com tolerância de 1 centavo documentada).
- [ ] Mudar a tabela do IRRF para uma vigência futura **não** altera OPs com data anterior.
- [ ] Nenhum cálculo intermediário é arredondado antes da hora.

## Riscos e observações
- A tabela do IRRF e o redutor refletem a lei de 2026; **confirmar com a contabilidade** (D22).
- A diferença de 1 centavo em 5 motoristas vem do arredondamento em dois passos da planilha; o sistema segue a regra combinada (T01).

## Decisões em aberto relacionadas
D22, D23. **Fechadas:** D14, D17, D18, D19.

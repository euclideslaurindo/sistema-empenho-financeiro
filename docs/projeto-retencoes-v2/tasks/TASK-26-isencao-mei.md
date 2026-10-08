# TASK-26 — Isenção de credor MEI na OP e no cadastro
<!-- milestone: M10 - Cálculo do transporte (3.3.90.33) | labels: backend,frontend,credores,financeiro,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 10 Transporte (.33) | P1 | ~4 h | T10 | R14 |

## Objetivo
Tornar visível e seguro o fato de que **credor MEI não sofre nenhuma retenção** (IRRF, ISS, INSS 11%, Patronal, SEST/SENAT), em qualquer elemento. A regra de cálculo está na T10 (regra 0); esta task cuida do que o usuário **vê e cadastra**.

## Contexto
- O cadastro de credores já tem o campo `is_mei` (`isMei`), e `credor.service.ts` já o grava e devolve.
- Na planilha EJA Campo, **23 de 92** motoristas estão com todas as retenções zeradas; a confirmação do usuário é que MEI "zera tudo".
- **Ainda não há credores cadastrados:** o cadastro precisa nascer correto, porque o MEI muda o valor pago.

## Escopo
### Entra
1. **Cadastro de credores:** campo MEI em destaque, com texto de ajuda ("MEI não sofre retenção de IR, ISS, INSS, SEST/SENAT nem patronal"); aviso quando marcado MEI com CPF (MEI tem CNPJ).
2. **Listagens e seletores** (credores, NE com vários credores, OP): selo **MEI**.
3. **Formulário da OP:** ao escolher credor MEI, banner "Credor MEI — isento de retenções", campos de retenção zerados e desabilitados; a taxa bancária/PIX continua digitável (suposição; confirmar).
4. **Servidor:** garantir (já na T10) que o MEI é lido do banco e que o ADMIN só sobrescreve com confirmação e aviso registrado na auditoria.
5. **Impressão:** "Isento (MEI)" (T12).
6. **Importação futura:** a planilha de cálculo base deverá trazer o MEI do credor; deixar isso anotado no backlog.

### Não entra
Validar o MEI na Receita (consulta externa).

## Arquivos
- **Alterados:** `app/credores/page.tsx`, `lib/services/credor.service.ts` (se necessário), `components/op-form/OpPaymentData.tsx`, `components/op-form/OpTaxesSection.tsx`, `components/ne-form/NeCredoresField.tsx`
- **Testes:** `tests/integration/credores.test.ts`, `tests/unit/retencoes.test.ts`, componentes

## Critérios de aceite
- [ ] Credor MEI: OP sai com todas as retenções 0 e líquido = bruto (menos taxa bancária/PIX digitada, se houver).
- [ ] O mesmo bruto para credor **não MEI** calcula normalmente.
- [ ] O selo MEI aparece no cadastro, na lista e no seletor de credor da OP.
- [ ] Desmarcar o MEI volta às retenções normais nas OPs **novas** (OPs antigas não mudam).
- [ ] OP de MEI não gera DARF (T20).

## Riscos e observações
Se alguém esquecer de marcar o MEI, o credor será retido indevidamente. Vale uma conferência na entrada de cada credor novo.

## Decisões em aberto relacionadas
D24 (taxa bancária/PIX para MEI). **Fechada:** D16.

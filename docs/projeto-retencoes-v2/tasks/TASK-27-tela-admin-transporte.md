# TASK-27 — Tela do admin: parâmetros do transporte, tabela do IRRF e ISS por município
<!-- milestone: M10 - Cálculo do transporte (3.3.90.33) | labels: frontend,backend,admin,transporte,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 10 Transporte (.33) | P1 | ~12 h | T24, T25, T07 | R12, R13 |

## Objetivo
Permitir que **só o ADMIN** edite tudo o que o cálculo do 3.3.90.33 usa e que muda ao longo do tempo: percentuais, **tabela do IRRF (com vigência)** e **ISS/taxa de expediente por município**. Salvou, vale para todos, nas OPs novas.

## Contexto
- A T07 cria a tela dos campos de "Retenções e Descontos" (percentuais padrão). Esta task acrescenta o bloco do transporte na mesma área `/configuracoes/retencoes` (nova aba "Transporte (3.3.90.33)").
- O padrão de API/permissão é o da T06 (`GET` para autenticados, `PUT` só ADMIN, auditoria em `auditoria_financeira`).

## Escopo
### Entra
**API**
- `GET/PUT /api/configuracoes/calculo-transporte` (parâmetros por vigência)
- `GET/PUT /api/configuracoes/irrf` (faixas por vigência)
- `GET/POST/PUT /api/configuracoes/iss-municipios` (alíquota, taxa de expediente, apelidos, ativo)
- Escrita **somente ADMIN** (403 para os demais), Zod, transação e auditoria com antes/depois.

**Tela**
1. **Parâmetros do transporte:** base 20%, INSS 11%, patronal 20%, SEST 1,5%, SENAT 1%, tributável do IRRF 60%, desconto simplificado, redutor (constante e coeficiente). Mostra a **vigência atual** e permite **criar nova vigência** copiando a atual.
2. **Tabela do IRRF:** editor de faixas (limite, alíquota, parcela a deduzir) por vigência, com validações (limites crescentes, última faixa sem limite, alíquotas 0–100, sem faixa duplicada).
3. **ISS por município:** lista editável (alíquota, **taxa de expediente da prefeitura**, apelidos, ativo) + incluir município novo.
4. **Simulador:** escolhe município, digita o bruto e vê a "ficha" igual à da planilha (base INSS, base IRRF, desc. simplificado, desc. adicional, IRRF final, ISS + expediente, INSS, SEST, SENAT, patronal informativa, total, líquido), usando **o mesmo motor** do servidor.
5. **Confirmação com diff** antes de salvar ("IRRF faixa 3: 15% → 16%") e aviso fixo: "Vale para as OPs novas; OPs emitidas não mudam".

### Não entra
Editar o código das fórmulas (a estrutura do cálculo fica no código, testada).

## Especificação técnica
- Nova vigência só pode começar **hoje ou depois**; não se edita uma vigência já usada por OP (cria-se outra).
- O formulário da OP **não** recebe as tabelas: a prévia vem do servidor (T10/T11).
- Visual e acessibilidade seguem a T07.

## Arquivos
- **Novos:** `app/api/configuracoes/calculo-transporte/route.ts`, `app/api/configuracoes/irrf/route.ts`, `app/api/configuracoes/iss-municipios/route.ts`, `components/admin/TransporteParametros.tsx`, `components/admin/IrrfFaixasEditor.tsx`, `components/admin/IssMunicipiosTable.tsx`, `components/admin/TransporteSimulador.tsx`
- **Alterados:** `app/configuracoes/retencoes/page.tsx`, `lib/services/parametros-calculo.service.ts`, `lib/schemas.ts`

## Critérios de aceite
- [ ] GESTOR/CONSULTA não veem a aba e recebem 403 nas APIs de escrita.
- [ ] ADMIN altera a faixa do IRRF com vigência futura: OPs atuais **não** mudam; a partir da data, mudam.
- [ ] ADMIN altera a taxa de expediente de Canhotinho de 15,20 para 16,00: a próxima OP do .33 em Canhotinho soma 16,00.
- [ ] O simulador reproduz o Bartolomeu (IRRF final 0,00) e os casos G e H.
- [ ] Faixas inválidas (fora de ordem, sem última faixa) são recusadas com mensagem clara.
- [ ] Todas as mudanças ficam na auditoria com usuário e data.

## Riscos e observações
Tela de alto impacto financeiro: a confirmação com diff é obrigatória.

## Decisões em aberto relacionadas
D22, D23. **Fechadas:** D19.

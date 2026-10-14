# TASK-10 — Motor de cálculo de retenções no servidor (estratégias, MEI e patronal informativa)
<!-- milestone: M4 - Ordem de Pagamento | labels: backend,calculo,financeiro,P0 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 4 OP | P0 | ~12 h | T01, T03, T06, T09 | R1, R2, R3, R5 |

## Objetivo
Criar o motor único de cálculo (`lib/retencoes.ts`) e fazer `OrdemPagamentoService.criar` e `atualizar` usarem **a configuração do banco e o elemento da NE**, no lugar das alíquotas fixas e do "tudo marcado".

## Contexto (estado atual)
- Bloco `if (perfil !== 'ADMIN') { … 0.015 / 0.11 / 0.025 / 0.20 … }` duplicado em `criar` e `atualizar`.
- O servidor usa "valor enviado > 0" como indício de que o imposto estava marcado: um cliente pode enviar 0 e **pular** um imposto.
- `outrosDescontos` é zerado para não-ADMIN; `iss` é aceito como veio.
- Para ADMIN, `totalDescontos` e `valorLiquido` enviados pelo cliente são **gravados sem recalcular**.
- A NE já é lida dentro da transação (`SELECT id, valor, status FROM notas_empenho WHERE numero = ? FOR UPDATE`).
- Existem testes que simulam `conn.execute` por trecho de SQL (`tests/unit/calculos-op.test.ts`, `tests/integration/ordens-pagamento.test.ts`).

## Escopo
### Entra
1. `lib/retencoes.ts` (puro): `calcularRetencoes(...)`.
2. Leitura da config e da matriz dentro da transação (via `obterConfigRetencoes(conn)`).
3. Troca dos blocos de `criar` e `atualizar` pelo motor.
4. Gravação de `taxa_bancaria`, `taxa_pix`, `total_descontos`, `valor_liquido` (sempre **recalculados** no servidor) e `retencoes_snapshot`.
5. Novos campos no schema Zod: `taxaBancaria`, `taxaPix`.
6. Resposta do `POST` passa a devolver os valores calculados.

### Não entra
UI (T11), impressão (T12), DARF (T20).

## Especificação técnica
### Assinatura
```ts
type CampoTributario = 'irrf'|'iss'|'inss'|'patronal'|'sest_senat';
type CampoDesconto   = 'outros'|'taxa_bancaria'|'taxa_pix';

interface EntradaCalculo {
  brutoCents: number;
  elementoCodigo: string | null;
  config: ConfigCampo[];                       // de config_retencoes
  regras: Record<string, CampoTributario[]>;   // de elemento_retencoes
  informados: Partial<Record<CampoTributario|CampoDesconto, number /*cents*/>>;
  perfil: 'ADMIN'|'GESTOR'|'CONSULTA';
  perfilCalculo: 'SIMPLES'|'TRANSPORTE_AUTONOMO';   // de elementos_despesa.perfil_calculo
  credorIsMei: boolean;                             // de credores.is_mei, lido na transação
  municipioCredor?: string | null;                  // usado pela estratégia TRANSPORTE_AUTONOMO (ISS por município)
  dataReferencia: string;                           // data_pagamento > data_emissao > hoje (vigência das tabelas)
}
interface ResultadoCalculo {
  itens: Record<string, number>;               // cents por campo (inclui informativos, ex.: patronal)
  informativos: string[];                      // campos com desconta_credor = 0 (fora do total)
  totalDescontosCents: number;
  liquidoCents: number;
  avisos: string[];
  snapshot: object;
}
```

### Regras (na ordem)
0. **Credor MEI** (`credores.is_mei = 1`, lido do banco dentro da transação, nunca do cliente): **todas as retenções tributárias valem 0** (IRRF, ISS, INSS 11%, Patronal, SEST/SENAT) em **qualquer elemento**, com `aviso: 'Isento (MEI)'`. Taxa bancária, Taxa PIX e Outros continuam digitáveis (suposição; confirmar). O ADMIN ainda pode sobrescrever manualmente, com aviso.
0b. **Estratégia pelo perfil do elemento:** `SIMPLES` (as regras abaixo, percentuais sobre o bruto) ou `TRANSPORTE_AUTONOMO` (T25). Até a T25 existir, o 3.3.90.33 usa `SIMPLES`.
1. **Elemento desconhecido** (`null` ou sem linha em `elementos_despesa`): nenhum imposto automático; devolver aviso e **exigir valores digitados** apenas se o campo for editável; não assumir "todos os impostos".
2. Para cada campo tributário **ativo**:
   - se o elemento não o aplica → `0` (mesmo que o cliente envie valor);
   - se `calculo_automatico` → `calcPercentCents(bruto, aliquota)` (T01);
   - se não automático → valor informado (obrigatório, `0 ≤ v ≤ bruto`).
3. **Sobrescrita manual:** se `editavel_operador` **ou** `perfil = ADMIN`, e o cliente enviou valor, usar o enviado (validado). Caso contrário, ignorar o enviado.
4. Campos de desconto (`outros`, `taxa_bancaria`, `taxa_pix`): independem do elemento; usar o valor informado se o campo estiver ativo e permitido (`editavel_operador` ou ADMIN); senão `0`.
5. `total = Σ itens com desconta_credor = 1` (a **patronal é informativa e não entra**); `líquido = bruto − total`. Se `total > bruto` → **422** "Total de descontos maior que o valor a pagar". Cada item é **arredondado primeiro** (T01) e só depois somado, como a planilha faz.
6. O `snapshot` guarda alíquotas, flags e valores usados.

### Integração em `OrdemPagamentoService`
- `criar`: ler `elemento` da NE no `SELECT … FOR UPDATE` e usar `extrairCodigoElemento`. **Ignorar** o `elemento` enviado pelo cliente.
- `atualizar` (D12): recalcular **somente se** `valorPagamento`, credor ou elemento mudarem; caso contrário, preservar os valores já gravados (não aplicar a config nova a OP antiga por causa de uma edição irrelevante). Se a OP tiver DARF `PAGA`, bloquear mudança de valores (409 — ver T20).
- Remover `autoCalculate` e `appliedTax_*` do contrato (viram dependência do elemento).
- Manter tolerância e demais validações existentes (saldo da NE, soma dos itens, cheque duplicado).

## Arquivos
- **Novo:** `lib/retencoes.ts`, `tests/unit/retencoes.test.ts`
- **Alterados:** `lib/services/ordem-pagamento.service.ts`, `lib/schemas.ts`, `lib/types/db.ts`, `tests/unit/calculos-op.test.ts`, `tests/integration/ordens-pagamento.test.ts` e `ordem-pagamento.test.ts` (novos mocks de SQL para config/matriz)

## Critérios de aceite
- [ ] Casos A–F do README produzem exatamente os valores esperados.
- [ ] Elemento `3.3.90.14.01`: todas as retenções = 0, mesmo se o cliente enviar valores.
- [ ] Elemento `.30` não calcula ISS.
- [ ] GESTOR enviando `irrf` diferente do calculado: ignorado (campo não editável). Com `editavel_operador = 1`: aceito e gravado.
- [ ] ADMIN enviando `totalDescontos` errado: servidor recalcula e grava o correto.
- [ ] Cliente que "pula" um imposto enviando 0 continua pagando o imposto (calculado pelo servidor).
- [ ] Alterar a alíquota no admin muda as OPs **novas** e não muda as gravadas.
- [ ] `taxa_bancaria` e `taxa_pix` são gravadas, entram em `total_descontos` e reduzem `valor_liquido`.
- [ ] `retencoes_snapshot` preenchido nas OPs novas.
- [ ] Credor MEI: todas as retenções 0 em qualquer elemento, com aviso "Isento (MEI)".
- [ ] Patronal calculada e gravada, mas **fora** de `total_descontos` e do líquido (caso A do README: descontos 200,00, líquido 800,00, patronal 200,00 só informativa).
- [ ] Elemento sem perfil conhecido cai em `SIMPLES` e registra aviso.
- [ ] Todos os testes antigos relevantes foram atualizados e passam.

## Plano de testes
Unitários do motor (tabela por elemento × perfil × flags), integração de `criar`/`atualizar` (com mocks de config), e um teste de **regressão** garantindo que um payload "legado" (sem campos novos) ainda funciona.

## Riscos e observações
- **É a task de maior risco financeiro.** Revisão cuidadosa e homologação com conferência manual de ao menos 10 OPs reais.
- Mudar o `INSERT`/`UPDATE` exige atualizar todos os mocks de SQL por trecho nos testes existentes.

## Decisões em aberto relacionadas
D1, D2, D11, D12, D13. **Fechadas:** D15 (patronal informativa), D16 (MEI isento de tudo).

## Atualização de escopo (decisões de 07/10/2026)
- **Prévia no servidor:** criar `POST /api/ordens-pagamento/previa-retencoes` (ADMIN/GESTOR), que recebe `numeroNe`, `credorCpfCnpj`, `valorPagamento` e os campos digitados (taxa bancária, PIX, outros) e devolve os valores calculados pelo **mesmo motor** da gravação. É o que o formulário (T11) usa; assim o navegador não precisa conhecer tabelas do IRRF nem regras do transporte.
- A estratégia `TRANSPORTE_AUTONOMO` é implementada na **T25**; a regra do **MEI** (regra 0) já vale aqui e a tela dela está na **T26**.
- O leitor de configuração (`obterConfigRetencoes`) continua sem cache de servidor.

## Correção (13/10/2026, D43)
O que foi implementado difere do item "Prévia no servidor" acima: a rota é **`POST /api/ordens-pagamento/previa`** (não existe `previa-retencoes`), e a tela usa a prévia do servidor **só no 3.3.90.33** (`PreviaTransporteEffect`); nos demais elementos o cálculo é feito **no navegador** (`AutoCalcEffect`, mesmas regras do motor). A gravação continua sendo a autoridade (o servidor recalcula ao salvar). Decisão mantida na rodada 2 (D43): na emissão em lote, NE do .33 usa `POST /api/ordens-pagamento/previa-lote`; os demais elementos calculam localmente por linha (T34/T35).

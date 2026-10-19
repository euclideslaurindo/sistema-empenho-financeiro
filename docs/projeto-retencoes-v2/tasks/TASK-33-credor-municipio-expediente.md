# TASK-33 — Cadastro de credores: campo "Município (Expediente)" e uso no cálculo da taxa de expediente
<!-- milestone: M11 - Ajustes do supervisor (rodada 2) | labels: frontend,backend,credores,calculo,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 11 Rodada 2 | P1 | ~7 h | T32, T25, **T28** | R19 |

## Objetivo
Adicionar ao cadastro de credores o campo **"Município (Expediente)"** (opcional, "se for o caso") e fazer com que **esse campo — e só ele —** determine a **taxa de expediente da prefeitura** no cálculo do elemento **3.3.90.33**.

## Contexto (estado atual)
- **Coluna no banco:** `credores.municipioExpediente` (**camelCase**, `VARCHAR(100) NULL`) — já existe em produção, vazia, criada fora de migration; a T32 garante que exista nos outros ambientes. **Decisão D41:** usar esse nome; **nunca** criar `municipio_expediente`.
- **Tela** (`app/credores/page.tsx`, print do supervisor): campos CNPJ/CPF, Nome/Razão Social, selo **MEI**, PIS, RG, Órgão emissor/UF, Data de emissão, CEP, Logradouro, Nº, Bairro, **Município**, **UF**, Telefone, Banco, Agência, Conta corrente, Chave PIX. O "Município" atual é o **endereço** do credor (coluna `cidade`).
- **Serviço** (`lib/services/credor.service.ts`): `CredorService` tem **só** `listar`, `criar`, `atualizar` e `excluir`. **Não existe** `buscar` nem um serviço de "autocomplete": as sugestões de credor da OP (`buscarCpfSugestoes`/`buscarCredorSugestoes` em `OpPaymentData.tsx`) chamam `GET /api/credores?busca=…&limit=8`, que é o próprio `listar`. Grava e lê `cidade`/`uf` com `normalizarCidade`, `normalizarUf` e `validarMunicipio` (`lib/credor-endereco.ts`).
- **Validação:** **não existe schema de credor em `lib/schemas.ts`**; o serviço lê o `body` direto e valida ali.
- **Cálculo** (`lib/services/calculo-op.service.ts`, ~43–68): `SELECT cidade, uf, is_mei FROM credores WHERE cpf_cnpj = ? OR <dígitos> = ? LIMIT 1` — **sem filtrar `ativo = 1`** — e, no perfil `TRANSPORTE_AUTONOMO`, `obterIssMunicipio(conn, credor?.cidade)` e `municipioCredor: credor?.cidade`. Ou seja, hoje a taxa de expediente sai do **município do endereço**.
- **Motor** (`lib/retencoes-transporte.ts`): quando o município não é encontrado em `iss_municipios`, gera o aviso "Município sem cadastro de ISS: usada a alíquota padrão (5%) sem taxa de expediente."
- **Tabela de ISS** (`iss_municipios`, `migration_16.sql`): `chave` normalizada, `nome`, `aliquota`, `taxa_expediente`, `apelidos`, `ativo`; API `GET /api/configuracoes/iss-municipios` (T27); normalização em `lib/perfis-calculo.ts` (`normalizarMunicipio`). Taxas de expediente atuais: Canhotinho 15,20 · Capoeiras 3,94 · Iati 6,90 · Jupi 6,76 · Jucati 3,00.
- **Motivo da mudança:** o município onde a pessoa **mora** pode ser diferente do município da **prefeitura que cobra** a taxa. O supervisor quer um campo próprio.

## Escopo
### Entra
**Cadastro (frontend)**
1. Campo **"Município (Expediente)"** na tela de credores, **logo depois de Município/UF**, opcional, `maxLength = 100`. Texto de ajuda: "Preencha só se este credor tiver taxa de expediente (ex.: Canhotinho). Usado no elemento 3.3.90.33."
2. Sugestões (`<datalist>` ou autocomplete) a partir dos municípios **ativos** de `iss_municipios`; o usuário pode digitar outro texto.
3. Aviso **não bloqueante** quando o texto não corresponde a nenhum município cadastrado: "Município sem cadastro de ISS; a taxa de expediente será R$ 0,00 até o admin cadastrá-lo."
4. O campo aparece na listagem/consulta de credores e no resultado de `GET /api/credores?busca=` (usado pelas sugestões da OP, T35), como `municipioExpediente`.

**API/serviço**
5. `credor.service.ts`: `criar`, `atualizar` e `listar` passam a ler/gravar a coluna `municipioExpediente` (payload `municipioExpediente`; vazio vira `NULL`). Como a coluna já é camelCase, o `listar` **não precisa de alias** (diferente de `conta_corrente as contaCorrente`); no `atualizar`, a chave do objeto que monta o `SET` é `municipioExpediente`. Normalização leve (trim, espaços duplicados). A regra de `validarMunicipio` vale só para `cidade`/`uf` (não para este campo). A validação continua no serviço (não há schema de credor em `lib/schemas.ts`).
6. O `SELECT` de credor do cálculo passa a trazer `municipioExpediente` e a **filtrar `ativo = 1`**. É seguro: `CredorService.excluir` recusa (409) desativar credor que tenha OP, então nenhuma OP existente perde o credor por causa do filtro.

**Cálculo (somente 3.3.90.33)**
7. `calculo-op.service.ts`: `obterIssMunicipio(conn, credor?.municipioExpediente)` e `municipioCredor: credor?.municipioExpediente ?? null`.
8. **Sem `municipioExpediente` preenchido → taxa de expediente = 0, ISS pela alíquota padrão (5%) e SEM aviso** (o campo é "se for o caso" — D45). **Não** se usa mais a `cidade` do endereço como reserva (D38). Esta é uma **mudança de comportamento** em relação à T25. Hoje o motor avisaria "Município sem cadastro de ISS" nesse caso; o aviso precisa ser suprimido quando o campo está vazio.
9. Município preenchido que **não existe** na tabela → alíquota padrão, taxa 0 e `aviso` "Município de expediente sem cadastro de ISS" no resultado da prévia (não bloqueia a OP). É o **único** caso com aviso (D45).
10. O `retencoes_snapshot` guarda `municipio` (expediente), `iss_aliquota` e `taxa_expediente`, como já faz.
11. Para os demais elementos (.30, .36, .39, .47 e legados) **nada muda**: a taxa de expediente continua valendo **só no .33** por enquanto (D27).

### Não entra
- Aplicar a taxa de expediente a outros elementos.
- Mexer na taxa bancária (continua digitada na OP).
- Preencher o campo automaticamente a partir do CEP/CNPJ.

## Especificação técnica
```ts
// calculo-op.service.ts (trecho)
const sqlCredor = `SELECT cidade, uf, municipioExpediente, is_mei FROM credores
   WHERE ativo = 1 AND (cpf_cnpj = ? OR <dígitos> = ?) LIMIT 1`;
// ...
obterIssMunicipio(conn, credor?.municipioExpediente),   // antes: credor?.cidade
municipioCredor: credor?.municipioExpediente ?? null,
```
- `obterIssMunicipio` já normaliza o nome (`normalizarMunicipio`) e aceita apelidos (ex.: "SBU" → São Bento do Una).
- Exemplo: credor MEI = não; elemento 3.3.90.33; bruto R$ 6.317,50; **expediente = Canhotinho** → ISS 331,08 (315,875 + 15,20). **Mesmo credor com `cidade = Canhotinho` e expediente vazio** → ISS 315,88 (sem a taxa e sem aviso).
- **Dependência da T28:** o teste de conformidade da planilha EJA Campo ainda não existe como arquivo próprio (hoje é um teste dentro de `tests/unit/retencoes-transporte.test.ts`). Fazer a T28 antes; nesta task ele passa a informar `municipioExpediente` (o valor da coluna `municipio` do fixture) em vez do município do endereço.
- **Testes com mock de SQL:** `tests/integration/transporte-op.test.ts` casa o texto `SELECT cidade, uf, is_mei`, e `credores.test.ts`/`credores-id.test.ts` casam os SQL do serviço; os matchers precisam do nome novo da coluna.

## Arquivos afetados
- **Alterados:** `app/credores/page.tsx`, `lib/services/credor.service.ts`, `app/api/credores/route.ts` e `[id]/route.ts` (se repassarem campos explicitamente), `lib/services/calculo-op.service.ts`, `lib/retencoes-transporte.ts` (suprimir o aviso quando o campo está vazio), `lib/types/db.ts` (`CredorDB.municipioExpediente`)
- **Testes:** `tests/integration/credores.test.ts`, `credores-id.test.ts`, `transporte-op.test.ts`, `tests/unit/retencoes-transporte.test.ts`, `tests/unit/credores-page-mei.test.tsx`, e o teste de conformidade (T28)

## Critérios de aceite
- [ ] O campo "Município (Expediente)" aparece no cadastro, é opcional e salva/edita/limpa.
- [ ] Credor com expediente "Canhotinho" no 3.3.90.33 paga ISS **com** R$ 15,20 de taxa de expediente.
- [ ] Credor com `cidade = Canhotinho` **sem** expediente **não** paga a taxa e **não** recebe aviso.
- [ ] Expediente com apelido ("SBU") resolve o município certo.
- [ ] Expediente preenchido e inexistente na tabela → ISS 5%, taxa 0 e aviso (a OP é emitida).
- [ ] Em outro elemento (ex.: .36), o expediente preenchido **não** altera o cálculo.
- [ ] `GET /api/credores?busca=` devolve `municipioExpediente`.
- [ ] O cálculo ignora credor inativo (`ativo = 0`).
- [ ] O conjunto de testes da T28 continua passando (63 exatos + 5 com tolerância de 1 centavo, entre os 68 motoristas com retenção; os 23 isentos zerados).

## Testes
- **Integração:** criar/editar credor com e sem expediente; cálculo do .33 com/sem expediente, com apelido e com município inexistente; elemento .36 ignorando o campo; credor inativo.
- **Componente:** campo, sugestões e aviso.

## Riscos e observações
- Mudança de comportamento: credores já cadastrados na homologação que dependiam da `cidade` perderão a taxa até receberem o novo campo. Avisar quem cadastra.
- Quem edita a tabela de ISS (T27) cria os municípios das sugestões; manter nomes consistentes.
- O deploy desta task só depois da `migration_17` no ambiente (T32). Em produção ela já foi executada em 14/10/2026.
- **Collation:** `credores.municipioExpediente` está em `utf8mb4_0900_ai_ci` (criada fora de migration). Comparar o município sempre no código (`normalizarMunicipio`, como `obterIssMunicipio` já faz); **não** fazer `JOIN`/`=` com `iss_municipios` no SQL, que pode dar "Illegal mix of collations".

## Decisões relacionadas
**Fechadas:** D27 (município de expediente só no .33), D38 (o campo determina sozinho a taxa; sem ele, taxa 0), D41 (coluna `municipioExpediente`), D45 (sem aviso quando o campo está vazio).

## Implementação (14/10/2026)
- `lib/perfis-calculo.ts`: `encontrarIssMunicipio(lista, nome)` (chave ou apelido, normalizado) — usado por `obterIssMunicipio` e pela tela.
- `credor.service.ts`: `listar` devolve `municipioExpediente`; `criar` grava (vazio → `NULL`, máx. 100 → 400); `atualizar` só mexe na coluna se o campo vier no payload.
- `calculo-op.service.ts`: `SELECT municipioExpediente, is_mei … WHERE ativo = 1`; a `cidade` não é mais lida no cálculo.
- `retencoes-transporte.ts`: aviso "Município de expediente sem cadastro de ISS" só quando o campo foi preenchido.
- Tela de credores: campo com `<datalist>` dos municípios ativos, ajuda e aviso não bloqueante; a lista mostra "expediente: …".
- Simulador do admin (T27): rótulo "Município (Expediente)" e opção "Sem município de expediente".
- Testes: conformidade (T28) agora passa o município como `municipioExpediente` (continua 63/5/23); casos Canhotinho 331,08 × sem campo 315,88, apelido SBU, município sem cadastro, elemento .36 e credor ativo; serviço e tela de credores.

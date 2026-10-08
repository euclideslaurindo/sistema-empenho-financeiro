# TASK-06 — Serviço e API de configuração de retenções
<!-- milestone: M3 - Config admin | labels: backend,api,admin,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 3 Config admin | P1 | ~6 h | T03 | R4, R5 |

## Objetivo
Ler e gravar toda a configuração de *Retenções e Descontos* (campos + matriz por elemento), valendo para **todos os usuários** assim que o admin salvar.

## Contexto (estado atual)
- `app/api/configuracoes/route.ts` já tem `GET` (qualquer autenticado) e `PUT` restrito a `ADMIN` para configurações gerais (`configuracoes_sistema`). Mesmo padrão de permissão será seguido.
- O dashboard usa cache em memória de 5 min (`DashboardService`). **A configuração de retenções NÃO pode usar esse tipo de cache**, senão "valer para todos" deixaria de ser imediato.

## Escopo
### Entra
- `lib/services/config-retencoes.service.ts` com `obterConfigRetencoes(conn?)` (usável dentro de transações) e `salvarConfigRetencoes(payload, usuario)`.
- `GET /api/configuracoes/retencoes` (todos autenticados, `Cache-Control: no-store`).
- `PUT /api/configuracoes/retencoes` (**somente ADMIN**).
- Validação Zod, transação única e auditoria.

### Não entra
Tela (T07) e uso no cálculo (T10).

## Especificação técnica
### Contrato
```json
// GET
{
  "campos": [
    { "campo": "irrf", "rotulo": "IRRF", "tipo": "PERCENTUAL", "aliquota": 1.5,
      "calculoAutomatico": true, "editavelOperador": false, "entraDarf": false, "ativo": true, "ordem": 10 }
  ],
  "regras": { "3.3.90.36": ["irrf","iss","inss","patronal","sest_senat"], "3.3.90.14": [] },
  "versao": "2026-10-06T14:22:10.000Z"
}
```
`PUT` recebe o mesmo formato (sem `versao`; opcionalmente `versaoBase` para detectar edição concorrente → **409** com mensagem "A configuração foi alterada por outro administrador").

### Validações
- `campo` precisa estar na lista fixa de 8 campos (não é possível criar campos novos pela API nesta fase).
- `aliquota`: obrigatória para `PERCENTUAL` com `calculoAutomatico = true`; `0 ≤ x ≤ 100`, máximo 4 casas decimais. Para `VALOR_DIGITADO` deve ser `null`.
- `taxa_bancaria` e `taxa_pix` não podem ter `tipo = PERCENTUAL`.
- `regras`: só aceita códigos existentes em `elementos_despesa` e só os 5 campos tributários.
- `entraDarf` só pode ser `true` em campos tributários.
- Rótulo: 1–60 caracteres, sem HTML.

### Gravação
1. `BEGIN`
2. `UPDATE config_retencoes` linha a linha (guardando `updated_by`).
3. Substituir a matriz: `DELETE FROM elemento_retencoes WHERE elemento_codigo IN (...)` + `INSERT` das linhas novas (somente para os elementos enviados).
4. Registrar em `auditoria_financeira` (`entidade = 'config_retencoes'`, `entidade_id` = UUID fixo da configuração; `dados_anteriores`/`dados_novos` em JSON).
5. `COMMIT`.

### Efeito para os usuários
O formulário busca a configuração ao abrir e ao voltar o foco para a aba; o servidor lê do banco a cada OP. Não há cache de servidor.

## Arquivos
- **Novos:** `lib/services/config-retencoes.service.ts`, `app/api/configuracoes/retencoes/route.ts`, `tests/integration/config-retencoes.test.ts`
- **Alterados:** `lib/schemas.ts` (schema Zod), `lib/types/db.ts`

## Critérios de aceite
- [ ] GESTOR/CONSULTA fazendo `PUT` → 403; sem login → 401.
- [ ] `PUT` com alíquota 101 ou 5 casas decimais → 400.
- [ ] `PUT` válido altera o `GET` seguinte imediatamente (sem F5 duplo, sem cache).
- [ ] A auditoria registra antes/depois e o usuário.
- [ ] Alterar a alíquota **não** modifica nenhuma OP já gravada.
- [ ] Edição concorrente detectada (409) quando `versaoBase` estiver desatualizada.

## Riscos e observações
- Alíquota errada vira dinheiro errado: a tela (T07) deve mostrar confirmação com o antes/depois; a API só garante integridade.
- O `DELETE`+`INSERT` da matriz precisa estar na mesma transação do `UPDATE` dos campos.

## Decisões em aberto relacionadas
D1, D2, D4.

# TASK-04 — Serviço e API de elementos/subelementos
<!-- milestone: M2 - Elementos | labels: backend,api,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 2 Elementos | P1 | ~6 h | T02, T03 | R3, R10 |

## Objetivo
Expor elementos, subelementos e a matriz de retenções por API, e oferecer funções utilitárias para extrair o código do elemento a partir do texto gravado.

## Contexto (estado atual)
Padrão do projeto: rota fina em `app/api/**/route.ts` → serviço em `lib/services/*.service.ts` → `lib/db.ts` (`query`, `withTransaction`). Autenticação por `getAuthUser`, respostas padronizadas por `unauthorizedResponse`/`forbiddenResponse` e `withErrorHandler`. Auditoria em `auditoria_financeira`.

## Escopo
### Entra
- `lib/elementos.ts` (funções puras) e `lib/services/elemento.service.ts`.
- `GET /api/elementos` (todos os perfis autenticados).
- Escrita (ADMIN): `POST /api/elementos`, `PUT /api/elementos/[codigo]`, `DELETE /api/elementos/[codigo]` (= `ativo = 0`), e o equivalente para `/api/subelementos`.
- Testes de integração no padrão de `tests/integration/*.test.ts`.

### Não entra
Telas (T05 e T08).

## Especificação técnica
### Funções puras (`lib/elementos.ts`)
```ts
extrairCodigoElemento("3.3.90.36 - Outros Serviços de Terceiros - Pessoa Física") // "3.3.90.36"
extrairCodigoElemento("3.3.90.14.01 - Diárias…")                                  // "3.3.90.14.01"
extrairCodigoElemento("") / null                                                  // null
codigoDoElementoPai("3.3.90.14.01")                                               // "3.3.90.14"
montarValorElemento({ codigo, descricao })                                        // "3.3.90.36 - Outros Serviços…"
```
Regex sugerida: `^\s*(\d(?:\.\d+)+)`.

### `GET /api/elementos`
```json
{
  "elementos": [
    {
      "codigo": "3.3.90.14",
      "descricao": "Diárias - Civil",
      "valor": "3.3.90.14 - Diárias - Civil",
      "legado": false,
      "retencoes": [],
      "subelementos": [
        { "codigo": "3.3.90.14.01", "descricao": "Diárias Pessoal Civil Dentro do Estado",
          "valor": "3.3.90.14.01 - Diárias Pessoal Civil Dentro do Estado" }
      ]
    }
  ]
}
```
- Só `ativo = 1` por padrão; `?incluirInativos=1` apenas para ADMIN.
- Uma única consulta por tabela (sem N+1) e montagem em memória.
- `Cache-Control: no-store`.

### Escrita (ADMIN)
- Validar com Zod: `codigo` (regex acima), `descricao` (1–200), `ordem`, `ativo`.
- Código duplicado → **409**. Subelemento com elemento inexistente → **400**.
- `DELETE` nunca apaga linha: faz `ativo = 0` (NEs antigas continuam exibindo o texto gravado).
- Toda escrita registra `auditoria_financeira` (`entidade = 'elementos_despesa'`).

## Arquivos
- **Novos:** `lib/elementos.ts`, `lib/services/elemento.service.ts`, `app/api/elementos/route.ts`, `app/api/elementos/[codigo]/route.ts`, `app/api/subelementos/route.ts`, `app/api/subelementos/[codigo]/route.ts`
- **Novos testes:** `tests/unit/elementos.test.ts`, `tests/integration/elementos.test.ts`
- **Tipos:** `lib/types/db.ts` (interfaces das tabelas novas)

## Critérios de aceite
- [ ] `GET /api/elementos` sem login → 401.
- [ ] Perfil GESTOR/CONSULTA tentando `POST` → 403; ADMIN → 201.
- [ ] Código repetido → 409; subelemento de elemento inexistente → 400.
- [ ] `DELETE` marca `ativo = 0` e o item some do `GET` padrão, mas continua no banco.
- [ ] Os elementos devolvidos incluem `retencoes` (lista de campos que se aplicam) lida de `elemento_retencoes`.
- [ ] `extrairCodigoElemento` cobre os 11 elementos semeados e textos legados em caixa diferente.

## Riscos e observações
- O `valor` montado (`codigo - descricao`) **precisa ser idêntico** ao texto já gravado nas NEs antigas; testar com amostra real.
- Registros antigos com textos fora do padrão → `extrairCodigoElemento` devolve `null` e o cálculo cai na regra "sem elemento conhecido" (ver T10).

## Decisões em aberto relacionadas
D3, D9.

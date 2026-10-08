# TASK-08 — (Opcional) Tela do admin: elementos e subelementos
<!-- milestone: M3 - Config admin | labels: frontend,admin,opcional,P3 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 3 Config admin | P3 (opcional) | ~8 h | T04 | R10 |

## Objetivo
Permitir que o admin cadastre, edite e desative elementos e subelementos **sem precisar de script SQL** quando surgir um elemento novo (como o 3.3.90.47 e os subelementos do 14).

## Contexto (estado atual)
Hoje, incluir um elemento exige editar `lib/constants.ts` e publicar uma nova versão. Depois da T02/T04 isso passa a ser dado do banco; esta task só entrega a tela.

## Escopo
### Entra
- Rota `app/configuracoes/elementos/page.tsx` (ADMIN).
- Lista com busca, criação, edição de descrição/ordem, ativar/desativar.
- Subelementos dentro de cada elemento.
- Ao criar um elemento novo, oferecer marcar quais impostos se aplicam (grava em `elemento_retencoes` via API da T06) — por padrão **nenhum**, com aviso.
- Invalidar o cache do `use-elementos` ao salvar.

### Não entra
Exclusão física; edição do **código** de elemento já usado em NEs.

## Especificação técnica
- Código imutável depois de criado (evita inconsistência com textos gravados).
- Desativar um elemento mantém as NEs antigas intactas.
- Reaproveitar os componentes visuais da T07.

## Arquivos
- **Novos:** `app/configuracoes/elementos/page.tsx`, `components/admin/ElementosTable.tsx`
- **Alterados:** `hooks/use-elementos.ts` (invalidação)

## Critérios de aceite
- [ ] ADMIN cria o elemento "3.3.90.99" e ele aparece no select da NE sem novo deploy.
- [ ] Desativar remove da lista de seleção, mas NEs antigas continuam exibindo o texto.
- [ ] Código duplicado mostra erro amigável (409 da API).
- [ ] Criar elemento **não** o deixa com retenções por engano (começa sem impostos e avisa).

## Riscos e observações
Pode ser adiada sem prejuízo: o seed da T02 já cobre a lista atual.

## Decisões em aberto relacionadas
D3, D9.

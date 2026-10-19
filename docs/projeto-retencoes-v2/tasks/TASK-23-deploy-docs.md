# TASK-23 — Deploy, checklist de produção e documentação
<!-- milestone: M9 - Fechamento | labels: deploy,documentacao,P1 -->

| Fase | Prioridade | Estimativa | Depende de | Requisito |
|---|---|---|---|---|
| 9 Fechamento | P1 | ~5 h | todas | todos |

## Objetivo
Colocar em produção com segurança e deixar a documentação do repositório atualizada.

## Contexto (estado atual)
- O banco é compartilhado com outras aplicações; scripts SQL rodam manualmente no Workbench por conta privilegiada.
- O README descreve instalação, rotas e API; `contexto_sessao_atual.md` e `docs/` guardam o histórico das sessões.
- CI em `.github/workflows/ci.yml`; há `Dockerfile` e `docker-compose.yml`.

## Escopo
### Entra
**Plano de execução em produção (ordem obrigatória)**
1. Backup do schema `empenho`.
2. Rodar em **homologação**: `migration_10` → `11` → `12` → `13` → `14` → `15` (conferindo `schema_migrations` entre cada uma).
3. **Revisão do usuário** do seed (matriz de retenções, alíquotas, `@mes_corte` da DARF) e das decisões D1–D13.
4. Rodar as mesmas migrations em produção (fora do horário de uso).
5. Deploy do código (só depois das migrations).
6. Smoke test em produção: login, abrir `/configuracoes/retencoes`, criar NE e OP de teste (cancelar/excluir depois, se permitido), abrir `/darf`.
7. **Avisar o supervisor** de que, a partir do deploy, o líquido das OPs novas **sobe** (a patronal deixa de ser descontada) e que o 3.3.90.33 passa a usar o cálculo da planilha EJA Campo.
8. **Cadastrar os credores com MEI e município corretos** antes de emitir OPs (eles definem as retenções e o ISS).
9. Comunicar aos usuários: "taxas agora definidas pelo administrador; novos campos de taxa bancária/PIX".

**Documentação**
- `README.md`: novas rotas (`/darf`, `/configuracoes/retencoes`, `/configuracoes/elementos`) e novas rotas de API.
- `database/`: arquivos `migration_10.sql` a `migration_15.sql` com cabeçalho no padrão existente.
- `docs/`: atualizar `database_analysis.md` e criar `docs/RETENCOES_V2.md` resumindo regras finais.
- `contexto_sessao_atual.md`: registrar o que foi feito e as pendências (incluindo os itens adiados).
- Registrar no PR/CHANGELOG as **mudanças de comportamento** (arredondamento novo, taxas vindas do admin, servidor como autoridade).

**Plano de rollback**
- Código: voltar ao release anterior (as colunas/tabelas novas são ignoradas pelo código antigo).
- Banco: **não** remover colunas/tabelas; qualquer `DROP` só com aprovação explícita.

### Não entra
Mudança de infraestrutura/servidor.

## Arquivos
`README.md`, `docs/*`, `database/migration_10..15.sql`, `contexto_sessao_atual.md`.

## Critérios de aceite
- [ ] Migrations aplicadas em homologação e produção, na ordem, sem erro.
- [ ] Seed revisado e aprovado pelo usuário **antes** de produção.
- [ ] Smoke test em produção concluído.
- [ ] Documentação atualizada e itens adiados listados como backlog (ISS com taxas e multas, lembrete de DAE, salvar empenhos automaticamente, importar planilha).
- [ ] Nenhum commit/push feito sem o usuário pedir.

## Riscos e observações
Se o deploy do código ocorrer antes das migrations, as telas novas falham (tabelas inexistentes). Por isso a ordem é obrigatória.

## Decisões em aberto relacionadas
Todas as D devem estar fechadas.

## Atualização de escopo (rodada 2, 13/10/2026)
A rodada 2 tem **`migration_17`** (garante `credores.municipioExpediente` — nome em camelCase, já existente em produção, D41 — e só confere as colunas nulas da NE, sem `MODIFY`, D47) e o plano de deploy dela na **T37**. Numeração real das migrations no repositório: 11 (T02), 12 (T03), 13 (T09), 14 (T14), 15 (T19), 16 (T24) e 17 (T32).

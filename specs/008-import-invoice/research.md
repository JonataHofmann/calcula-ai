# Phase 0 Research: Importar Fatura

Decisões que resolvem as incógnitas técnicas do plano. Formato: Decisão / Justificativa / Alternativas rejeitadas.

## R1 — Decriptação e extração de texto do PDF (em `ai-ms`)

**Decisão**: Usar `pdfjs-dist` (build legacy para Node) dentro de `ai-ms`. A senha é passada em `getDocument({ data, password })`; o texto é extraído por página via `page.getTextContent()`. Encapsular em `pdf-reader.ts` com uma API pequena: `readPdfText(buffer, password): Promise<{ pages: string[] }>` que lança um erro tipado `InvalidPdfPasswordError` quando a senha está errada e `UnreadablePdfError` quando não há camada de texto.

**Justificativa**: `pdfjs-dist` é maduro, puro JS (sem binários nativos), suporta PDFs criptografados via `password`, e distingue o erro de senha (`PasswordException`) do resto — essencial para FR-002/SC-005. Extração de texto cobre faturas nativas (texto), que é o caso comum.

**Alternativas rejeitadas**:
- `pdf-lib`: não extrai texto nem lida bem com decriptação para leitura.
- `mupdf`/wasm: capaz, porém binário/wasm mais pesado e menos comum no ecossistema Node do repo.
- Enviar o PDF cru direto ao modelo: perde controle sobre decriptação/senha e aumenta custo/risco; preferimos extrair texto localmente e mandar só o texto.

## R2 — Faturas escaneadas (sem camada de texto)

**Decisão**: Fora do escopo desta versão para OCR dedicado. Quando `readPdfText` detecta ausência de texto (`UnreadablePdfError`), o sistema responde "não foi possível extrair transações" (FR edge case). Deixar como evolução futura o fallback de visão (render de página → modelo multimodal via `AIProvider`).

**Justificativa**: Mantém escopo enxuto; a maioria das faturas de cartão é PDF com texto. SC-005 é satisfeito (erro claro, nada gravado).

**Alternativas rejeitadas**: incluir OCR/visão agora — aumenta escopo, custo e superfície de erro sem necessidade comprovada.

## R3 — Provider de IA e extração estruturada

**Decisão**: Implementar `AIProvider` (interface já existente em `services/ai-ms/src/common/ai-provider.ts`) com `RouterAiProvider`: cliente `fetch` para o 9Router/AI Gateway usando `AI_ROUTER_URL` + `AI_ROUTER_API_KEY` (já declarados em `libs/config`). A extração é um `generate()` com prompt que recebe o texto da fatura e pede **JSON** (lista de transações + mês de referência). A saída é validada com Zod (`invoiceExtractionSchema`); em falha de parse, uma re-tentativa com instrução corretiva, depois erro tipado.

**Justificativa**: Respeita a arquitetura pretendida (todo tráfego LLM atrás de `AIProvider`, ADR-008). Validação Zod da saída torna o resultado confiável e testável. Mantém a lógica de IA 100% em `ai-ms` (FR-004).

**Alternativas rejeitadas**:
- SDK direto de um provider específico em `ai-ms`: viola a abstração `AIProvider`/roteador de modelos.
- Parsing por regex do texto da fatura sem IA: frágil entre bancos/layouts; o spec pede extração por IA.

## R4 — Emissão de métricas e logging seguro

**Decisão**: Emitir `AIUsageMetrics` (tipo em `libs/observability`) a cada chamada de extração (model, tokens, latência). Logging via `@finance/logger` (`createLogger({ name: 'ai-ms' })`). **Nunca** logar: senha do PDF, conteúdo do PDF, prompts com dados pessoais, payloads financeiros. A senha é recebida, usada para abrir o PDF e descartada; não entra em nenhum log/resposta.

**Justificativa**: FR-017/SC-006 e regra 10 do AGENTS.md. Métricas dão observabilidade sem vazar conteúdo.

**Alternativas rejeitadas**: logar amostras do texto para debug — risco de vazamento de dado financeiro.

## R5 — Autenticação entre camadas (quem chama quem)

**Decisão**:
- `web → bff`: cookie de sessão (`credentials: 'include'`); `SessionAuthGuard` (global) resolve o usuário e injeta o access token.
- `bff → ai-ms` e `bff → api`: **token de usuário** (Bearer, `session.tokens.accessToken`) via clientes HTTP do BFF.
- `ai-ms`: adicionar `AuthModule` (JwtAuthGuard + `KeycloakTokenVerifier`, copiado de `services/api/src/common`) para validar o JWT e obter `userId` (`@CurrentUser`). `ai-ms` **não** chama `api` nem o banco.
- Persistência no `api`: rota **autenticada por usuário** (`@CurrentUser`), não service-account.

**Justificativa**: O BFF já detém o token do usuário, então não é preciso criar client Keycloak/role de service-account nova (diferente do caminho do banking-ms, que roda sem usuário). Menos configuração, mesma segurança (userId sempre do JWT). `ai-ms` continua sem acesso a dados.

**Alternativas rejeitadas**:
- Caminho service-account (`ServiceAccountGuard` + `AI_MS_KEYCLOAK_CLIENT_ID/SECRET`) como no `synced-import`: desnecessário aqui porque há usuário na origem; adicionaria credenciais e uma role nova sem ganho.
- `ai-ms` chamar `api` para sugestões/persistência: violaria a fronteira (ai-ms sem dados) e acoplaria serviços; o BFF orquestra melhor.

## R6 — Sugestão de categoria por histórico (FR-007/FR-008)

**Decisão**: Nova rota de leitura no `api`: `GET /transactions/category-suggestions?descriptions=a|b|c&type=expense` (escopada ao usuário). Para cada descrição normalizada (trim + lowercase + colapsar espaços), retorna o `categoryId` da **despesa mais recente** do usuário com a mesma descrição normalizada (comparação por `LOWER(description)` normalizada). O BFF chama essa rota após a extração e devolve cada linha com `suggestedCategoryId`. Quando não há histórico, `null` (usuário escolhe).

**Justificativa**: Mantém a regra de dados no `api` (dono do domínio). Uma consulta em lote (todas as descrições de uma vez) evita N+1. Ordenar por `dueDate`/`createdAt` desc garante "ocorrência mais recente" (FR-008).

**Alternativas rejeitadas**:
- Fazer a sugestão no `ai-ms`: exigiria acesso a dados (proibido).
- Fazer no commit: a sugestão precisa aparecer **antes** de gravar, na revisão (FR-005/FR-007).
- Índice/coluna normalizada dedicada agora: começar com `LOWER(...)` + índice existente por usuário; otimização só se necessário (sem complexidade prematura).

## R7 — Escopo de substituição/merge e critério de dedup

**Decisão**:
- **Escopo (FR-019)**: `creditCardId` + janela do **mês de referência** da fatura. A janela é derivada do `referenceMonth` (YYYY-MM) confirmado na revisão; comparam-se/substituem-se apenas transações do cartão cujo `dueDate` cai nesse mês.
- **Dedup (FR-018)**: duas transações são iguais quando têm **mesma data (dia) + mesmo valor + mesma descrição normalizada** (trim/lowercase/espaços colapsados). Difere em qualquer um → distintas.
- **Replace**: em uma transação de banco, apagar as transações do escopo (cartão+mês) e inserir todas as linhas revisadas.
- **Merge**: inserir só as linhas cujo trio (data,valor,descrição normalizada) não exista no escopo; contar/ reportar ignoradas.

**Justificativa**: Casa com o esclarecimento Q1/Q2. Transação de banco garante atomicidade (regra 7 AGENTS). Escopo por cartão+mês evita apagar histórico de outros períodos/cartões (FR-014/FR-019).

**Alternativas rejeitadas**: dedup por data+valor apenas (risco de descartar compras legítimas iguais no dia); similaridade aproximada de descrição (complexo/impreciso) — ambos rejeitados no /speckit-clarify.

## R8 — Parcelas ("X/Y") e status/vencimento

**Decisão**:
- Detectar o padrão "X/Y" no texto (ex.: "PARC 03/10", "Parcela 3 de 10") na extração; a linha carrega `installmentNumber`/`installmentCount`. Na revisão o usuário confirma.
- No commit, linha com parcela → criar transação `installment` reusando a lógica existente de `transactions.service.create` (gera grupo com `groupId`, ocorrências mensais `addMonthClamped`, `installmentNumber/Count`). Linha sem parcela → `single`.
- **Status/vencimento (Q3/Q4)**: gravar como `pending`; `dueDate` = dia de vencimento do cartão (`dueDay`) no mês de referência (helper `billing-cycle.ts`). O usuário efetiva ao pagar (fluxo existente `effectuate`).
- `source = 'imported'` (novo valor) para rastrear origem; migration amplia o CHECK de `source` (hoje `manual|synced`).

**Justificativa**: Reusa recorrência/parcelamento já testados (não reinventa). `pending`+vencimento da fatura mantém consistência com o módulo de Transações. `source='imported'` separa importação de fatura de `synced` (Pluggy) sem colidir.

**Alternativas rejeitadas**:
- Detectar parcela e gerar ocorrências futuras no `ai-ms`: geração é regra de domínio → fica no `api`.
- Reusar `source='synced'`: mistura semânticas (banco vs fatura) e poderia colidir com dedup por `externalId` do Pluggy.
- Gravar `paid`: a fatura ainda será paga; quebraria o fluxo pendente→efetivar.

### Nota de borda (parcelas + reimportação)

Como a fatura mostra só a parcela corrente, importar cria o grupo inteiro (ocorrências futuras). Numa reimportação com **replace** do mesmo mês, o dedup por (data,valor,descrição) da parcela corrente evita duplicar o grupo; ocorrências futuras de um grupo criado numa importação anterior não são recriadas se a parcela corrente for reconhecida como duplicada. Documentado em `data-model.md`; refinamento (dedup por grupo/`externalId` determinístico) fica como melhoria futura se necessário.

## R9 — Upload multipart através das camadas

**Decisão**: `web` envia `FormData` (arquivo PDF + `password` + `creditCardId`) para o BFF; `apps/web/services/api-client.ts` ganha uma variante que **não** força `Content-Type: application/json` (deixa o browser definir o boundary). BFF usa `FileInterceptor` (multer) para receber o arquivo e um novo método no `AiApiClient` para repassar como `FormData`/stream ao `ai-ms`; `ai-ms` recebe via `FileInterceptor`. Atenção ao `ValidationPipe({ whitelist, forbidNonWhitelisted })` global — o endpoint multipart valida campos manualmente (Zod) em vez de depender do whitelist sobre o corpo multipart.

**Justificativa**: Não existe plumbing de upload no repo; multer já vem com `@nestjs/platform-express`. Repassar como stream evita bufferizar o PDF em memória duas vezes quando possível.

**Alternativas rejeitadas**: base64 do PDF em JSON — infla payload ~33% e ainda passa pelo whitelist; menos eficiente para arquivos.

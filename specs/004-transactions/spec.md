# Feature Specification: Transações

**Feature Branch**: `004-transactions`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "crie o cadastro de transações (id, dono, description, dueDate, amount, recurrence single/fixed/installment, effectiveDate, type despesa/receita, notes, status pending/paid, endDate, installmentCount, installmentNumber, groupId, categoria, conta, cartão) com formulário em popup, filtros e ordenação na listagem, painel de pendentes de meses anteriores e ação de efetivar"

## Clarifications

### Session 2026-08-17

- Q: Escopo de grupo ("esta e futuras"/"todas") afeta ocorrências já pagas? → A: Sim — afeta todas as ocorrências do intervalo, incluindo as já `paid`.
- Q: Uma transação já `paid` pode ser editada pelo popup? → A: Sim — todos os campos são editáveis; `status`/`effectiveDate`/valor efetivo são preservados.
- Q: Como a listagem lida com volume? → A: Escopo por mês — a listagem mostra um mês por vez, com navegação entre meses (sem paginação).
- Q: Qual fuso define "hoje" e as fronteiras de mês? → A: Persistência de datas em UTC; o frontend calcula "hoje", "mês corrente" e "meses anteriores" conforme o fuso do usuário.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar e gerir transações avulsas (Priority: P1)

O usuário registra uma transação avulsa (despesa ou receita) informando descrição, data de vencimento, valor, categoria e a origem do dinheiro (uma conta **ou** um cartão de crédito para despesas; conta para receitas). O cadastro, a edição e a exclusão acontecem sempre em um popup. As transações aparecem em uma listagem em tabela.

**Why this priority**: É o núcleo do módulo — sem registrar e visualizar transações, nada mais entrega valor. Sozinha já é um MVP utilizável.

**Independent Test**: Criar, editar e excluir uma transação `single` pelo popup e vê-la aparecer/atualizar/sumir na listagem, com categoria e origem (conta ou cartão) corretas e escopo por usuário.

**Acceptance Scenarios**:

1. **Given** o usuário autenticado na tela de Transações, **When** abre o popup de nova transação, preenche uma despesa com conta e confirma, **Then** a transação é criada com `status = pending`, `recurrence = single` e aparece na listagem.
2. **Given** uma despesa sendo criada, **When** o usuário seleciona um cartão de crédito em vez de conta, **Then** o sistema aceita a despesa vinculada ao cartão (sem conta).
3. **Given** uma despesa sendo criada, **When** o usuário não informa nem conta nem cartão (ou informa ambos), **Then** o sistema recusa e exibe erro de validação.
4. **Given** uma transação existente do usuário, **When** ele a edita pelo popup e salva, **Then** os novos valores são persistidos e refletidos na listagem.
5. **Given** uma transação de OUTRO usuário, **When** o usuário tenta acessá-la/editá-la/excluí-la, **Then** o sistema responde como "não encontrada".

---

### User Story 2 - Efetivar transação pendente (Priority: P2)

Na listagem, cada transação pendente tem um botão **Efetivar**. Ao clicar, abre um popup para escolher a **data** (padrão: hoje) e o **valor** (padrão: o valor previsto). Ao confirmar, a transação passa a `paid`, registrando data e valor efetivos.

**Why this priority**: Marcar pagamentos é a ação recorrente principal após o cadastro; dá sentido ao ciclo pendente → pago.

**Independent Test**: Efetivar uma transação `single` pendente com data e valor padrão e verificar que fica `paid` com `effectiveDate` e valor efetivo definidos; efetivar novamente não é permitido.

**Acceptance Scenarios**:

1. **Given** uma transação pendente, **When** o usuário clica em Efetivar, **Then** o popup abre com data = hoje e valor = valor previsto.
2. **Given** o popup de efetivação aberto, **When** o usuário confirma sem alterar nada, **Then** a transação vira `paid` com `effectiveDate = hoje` e valor efetivo = valor previsto.
3. **Given** o popup de efetivação, **When** o usuário altera o valor para um valor diferente e confirma, **Then** a transação vira `paid` com o valor efetivo informado (o valor previsto original é preservado).
4. **Given** uma transação já `paid`, **When** o usuário tenta efetivá-la de novo, **Then** a ação é bloqueada/indisponível.

---

### User Story 3 - Recorrência parcelada e fixa (Priority: P3)

O usuário cria transações recorrentes:

- **Parcelada (`installment`)**: informa o número de parcelas e **ou** o valor da parcela **ou** o valor total — o sistema calcula o campo que faltou (valor da parcela = total ÷ nº parcelas; total = valor da parcela × nº parcelas). Na criação, o sistema **gera todas as N linhas**, cada uma com `installmentNumber` (1..N), `dueDate` acrescido de um mês por parcela e o mesmo `groupId`.
- **Fixa (`fixed`)**: repete mensalmente, com ou sem data de término (`endDate`). A ocorrência de cada mês é **materializada apenas na efetivação**: efetivar a ocorrência pendente gera a próxima ocorrência pendente (`dueDate` + 1 mês), respeitando `endDate` quando houver.

Editar ou excluir uma ocorrência que pertence a um grupo abre um modal perguntando o **escopo**: só esta ocorrência, esta e as futuras, ou todas do grupo.

**Why this priority**: Recorrência é o principal diferencial do módulo, mas depende do cadastro (US1) e agrega mais valor após a efetivação (US2).

**Independent Test**: Criar uma parcelada em 3x e ver 3 linhas com `groupId` comum, `installmentNumber` 1/2/3 e vencimentos mensais; criar uma fixa e, ao efetivar a ocorrência atual, ver a próxima ocorrência pendente surgir.

**Acceptance Scenarios**:

1. **Given** uma nova transação parcelada, **When** o usuário informa nº de parcelas = 3 e valor da parcela = 100,00, **Then** o total exibido é 300,00 e são geradas 3 linhas de 100,00 com vencimentos mensais consecutivos e mesmo `groupId`.
2. **Given** uma nova transação parcelada, **When** o usuário informa nº de parcelas = 3 e valor total = 100,00, **Then** o valor da parcela calculado é 33,33 (com ajuste de centavos na última parcela para somar 100,00).
3. **Given** uma transação fixa sem `endDate`, **When** o usuário efetiva a ocorrência pendente, **Then** ela vira `paid` e uma nova ocorrência pendente é criada com vencimento no mês seguinte, mesmo `groupId`.
4. **Given** uma transação fixa com `endDate`, **When** a efetivação alcançaria um vencimento posterior ao `endDate`, **Then** nenhuma nova ocorrência é gerada.
5. **Given** uma ocorrência de um grupo, **When** o usuário a edita/exclui, **Then** um modal pergunta o escopo (só esta / esta e futuras / todas) e a operação aplica-se exatamente ao escopo escolhido.

---

### User Story 4 - Filtrar, buscar e ordenar a listagem (Priority: P4)

A listagem é **escopada a um mês por vez**: mostra as transações com vencimento no mês de referência e oferece navegação entre meses (anterior/próximo). Sobre esse mês, o usuário filtra por: busca textual (em `description`, `amount` e `notes`), intervalo de data de vencimento (início e fim), valor (correspondência parcial, estilo "contém"), recorrência, tipo, categoria, conta e cartão de crédito. Cada coluna do cabeçalho permite ordenar (asc/desc).

**Why this priority**: Melhora muito a usabilidade quando o volume cresce, mas o módulo funciona sem isso.

**Independent Test**: Aplicar cada filtro isoladamente e combinados, verificar que o conjunto exibido corresponde ao critério; clicar em um cabeçalho e ver a ordenação alternar entre ascendente e descendente.

**Acceptance Scenarios**:

1. **Given** várias transações, **When** o usuário digita um termo na busca, **Then** a listagem mostra apenas transações cujo `description`, `amount` ou `notes` contêm o termo.
2. **Given** o filtro de intervalo de vencimento, **When** o usuário define início e fim, **Then** apenas transações com `dueDate` dentro do intervalo são exibidas.
3. **Given** o filtro de valor, **When** o usuário digita um valor parcial, **Then** transações cujo valor "contém" o texto informado são exibidas.
4. **Given** filtros de recorrência/tipo/categoria/conta/cartão, **When** o usuário seleciona valores, **Then** somente as transações correspondentes permanecem.
5. **Given** a listagem, **When** o usuário clica no cabeçalho de uma coluna, **Then** a ordenação por aquela coluna alterna entre ascendente e descendente.
6. **Given** a listagem no mês corrente, **When** o usuário navega para o mês anterior/próximo, **Then** a tabela passa a exibir apenas as transações com vencimento no mês selecionado.

---

### User Story 5 - Painel de pendentes de meses anteriores (Priority: P5)

A listagem oferece a opção **"mostrar despesas pendentes dos meses anteriores"**. Quando ativada, exibe, em um grid acima da listagem principal, as transações **não pagas** com vencimento em meses anteriores ao mês corrente.

**Why this priority**: Ajuda a não perder pagamentos atrasados; é um refinamento sobre a listagem já existente.

**Independent Test**: Ter uma transação pendente com vencimento no mês passado, ativar a opção e vê-la aparecer no grid superior; ao efetivá-la, ela some do grid.

**Acceptance Scenarios**:

1. **Given** transações pendentes com vencimento em meses anteriores, **When** o usuário ativa a opção, **Then** um grid acima da listagem exibe essas transações atrasadas.
2. **Given** o grid de atrasados visível, **When** o usuário efetiva uma delas, **Then** ela deixa de aparecer no grid.
3. **Given** nenhuma pendência de meses anteriores, **When** o usuário ativa a opção, **Then** o grid mostra um estado vazio.

---

### Edge Cases

- **Origem inválida**: despesa sem conta e sem cartão, ou com ambos → recusada. Receita vinculada a cartão → recusada (receita usa conta).
- **Valores**: `amount` ≤ 0 → recusado.
- **Parcelas**: `installmentCount` < 1 → recusado; informar simultaneamente valor da parcela e valor total inconsistentes → o sistema prioriza recalcular a partir de um deles e sinaliza; `installmentNumber` fora de 1..`installmentCount` → recusado.
- **Fixa**: `endDate` anterior ao `dueDate` inicial → recusado.
- **Efetivar já pago**: bloqueado/indisponível.
- **Escopo de grupo em ocorrência única**: se o grupo tem só uma ocorrência restante, "esta e futuras" e "todas" têm o mesmo efeito.
- **Escopo de grupo alcança pagas**: "esta e futuras"/"todas" aplicam-se também às ocorrências já `paid` no intervalo — editar altera os valores/campos dessas linhas; excluir remove-as.
- **Exclusão idempotente de grupo**: excluir "todas" de um grupo já parcialmente excluído não gera erro.
- **Isolamento**: categoria/conta/cartão referenciados devem pertencer ao mesmo usuário; recurso de outro usuário → "não encontrado".
- **Data efetiva**: pode ser hoje ou uma data escolhida; o padrão é hoje.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir criar, editar e excluir transações do usuário autenticado, sempre por meio de um popup (formulário em modal). A edição MUST ser permitida também para transações já `paid` (todos os campos editáveis), preservando `status`, `effectiveDate` e o valor efetivo salvos na efetivação.
- **FR-002**: Cada transação MUST conter: `description`, `dueDate`, `amount`, `recurrence`, `type`, `status`, `categoria` e uma origem de valor; e MAY conter `effectiveDate`, valor efetivo, `notes`, `endDate`, `installmentCount`, `installmentNumber` e `groupId`, conforme a recorrência.
- **FR-003**: `recurrence` MUST ser um de `single`, `fixed`, `installment`, com padrão `single`.
- **FR-004**: `type` MUST ser um de `despesa` (expense) ou `receita` (income).
- **FR-005**: `status` MUST ser um de `pending` ou `paid`, com padrão `pending`.
- **FR-006**: Para `type = despesa`, o sistema MUST exigir exatamente **uma** origem: uma conta **ou** um cartão de crédito (nunca ambos, nunca nenhum).
- **FR-007**: Para `type = receita`, o sistema MUST vincular a transação a uma conta e MUST NOT aceitar cartão de crédito.
- **FR-008**: A `categoria` MUST ser obrigatória e coerente com o `type` da transação.
- **FR-009**: O sistema MUST permitir a uma despesa fixa ter ou não `endDate` (fim opcional).
- **FR-010**: Ao criar uma transação `installment`, o sistema MUST aceitar o número de parcelas e **ou** o valor da parcela **ou** o valor total, calculando o campo ausente (valor da parcela = total ÷ nº parcelas; total = valor da parcela × nº parcelas), com ajuste de centavos na última parcela para o total fechar.
- **FR-011**: Ao criar uma transação `installment`, o sistema MUST gerar todas as N ocorrências como linhas, cada uma com `installmentNumber` de 1 a N, `dueDate` incrementado em um mês por parcela e um `groupId` comum.
- **FR-012**: Para `installment`, cada linha MUST persistir o valor **por parcela** em `amount`.
- **FR-013**: Para `fixed`, o sistema MUST materializar a ocorrência de cada período **apenas na efetivação**: ao efetivar a ocorrência pendente, o sistema MUST gerar a próxima ocorrência pendente (`dueDate` + 1 mês) com o mesmo `groupId`, respeitando `endDate` quando existir.
- **FR-014**: Para `fixed` com `endDate`, o sistema MUST NOT gerar ocorrência cujo vencimento ultrapasse o `endDate`.
- **FR-015**: O sistema MUST expor, na listagem, um botão **Efetivar** para transações pendentes que abre um popup com **data** (padrão hoje) e **valor** (padrão o valor previsto).
- **FR-016**: Ao confirmar a efetivação, o sistema MUST marcar a transação como `paid`, registrar `effectiveDate` e o valor efetivo, preservando o valor previsto original.
- **FR-017**: O sistema MUST impedir a efetivação de uma transação já `paid`.
- **FR-018**: Ao editar ou excluir uma ocorrência pertencente a um grupo (`groupId`), o sistema MUST perguntar o escopo (só esta / esta e futuras / todas) e aplicar a operação exatamente ao escopo escolhido, **incluindo as ocorrências já `paid`** dentro do intervalo (o escopo não pula lançamentos efetivados).
- **FR-019**: A listagem MUST ser escopada a um mês de referência por vez, com navegação entre meses (anterior/próximo) e padrão no mês corrente; e MUST oferecer filtros por: busca textual em `description`/`amount`/`notes`; intervalo de `dueDate` (início/fim); valor por correspondência parcial ("contém"); `recurrence`; `type`; categoria; conta; e cartão de crédito, aplicados sobre o mês selecionado.
- **FR-020**: A listagem MUST permitir ordenar por qualquer coluna a partir do seu cabeçalho, alternando ascendente/descendente.
- **FR-021**: A listagem MUST oferecer a opção "mostrar despesas pendentes dos meses anteriores" que, quando ativa, exibe em um grid acima as transações não pagas com vencimento anterior ao mês corrente.
- **FR-022**: Toda leitura e escrita MUST ser escopada ao usuário autenticado; qualquer transação, categoria, conta ou cartão de outro usuário MUST ser tratado como "não encontrado".
- **FR-023**: O sistema MUST validar os limites de cada campo (valor > 0, `installmentCount` ≥ 1, `installmentNumber` em 1..`installmentCount`, `endDate` ≥ `dueDate` inicial) e recusar entradas inválidas com mensagem clara.
- **FR-024**: A interface MUST ser componentizada e apresentar transições/animações fluidas nas aberturas de popup e mudanças de lista.

### Key Entities *(include if feature involves data)*

- **Transação (Transaction)**: representa um lançamento financeiro do usuário. Atributos: `id`, `userId` (dono), `description`, `dueDate` (vencimento), `amount` (valor previsto; para parcelada = valor por parcela), valor efetivo (quando pago), `recurrence` (single/fixed/installment), `effectiveDate` (data de pagamento, opcional), `type` (despesa/receita), `notes` (opcional), `status` (pending/paid), `endDate` (fim da fixa, opcional), `installmentCount` (total de parcelas), `installmentNumber` (parcela atual, 1-based), `groupId` (agrupa parcelas/ocorrências fixas). Relaciona-se com **Categoria** (obrigatória), **Conta** (opcional) e **Cartão de Crédito** (opcional), com a regra de origem exclusiva por tipo.
- **Grupo de recorrência (Recurrence Group)**: identidade lógica (`groupId`) que reúne as ocorrências de uma parcelada ou de uma fixa, base para operações com escopo (só esta / esta e futuras / todas).
- **Categoria / Conta / Cartão de Crédito**: entidades já existentes no sistema, referenciadas pela transação e sempre pertencentes ao mesmo usuário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue registrar uma transação avulsa (abrir popup → preencher → salvar → ver na lista) em menos de 30 segundos.
- **SC-002**: Ao criar uma parcelada em N parcelas, o usuário vê exatamente N linhas com vencimentos mensais consecutivos e a soma dos valores das parcelas igual ao total informado (sem diferença de centavos).
- **SC-003**: Efetivar uma transação pendente leva no máximo 2 cliques a partir da listagem (Efetivar → Confirmar) e reflete o status `paid` imediatamente.
- **SC-004**: 100% das tentativas de acessar transações de outro usuário resultam em "não encontrado" (nenhum vazamento entre usuários).
- **SC-005**: Com filtros aplicados, a listagem exibe apenas resultados que satisfazem todos os critérios ativos, verificável em 100% dos casos de teste de filtro.
- **SC-006**: Uma despesa pendente vencida em mês anterior aparece no grid de "pendentes de meses anteriores" assim que a opção é ativada e desaparece imediatamente após ser efetivada.

## Assumptions

- **Efetivação com valor próprio**: além de `effectiveDate`, o sistema guarda o **valor efetivo** informado no popup (que pode diferir do valor previsto), preservando o valor previsto original. Esse "valor efetivo" é um atributo adicional à lista de campos citada no pedido.
- **Materialização**: parceladas geram todas as linhas na criação; fixas não pré-geram ocorrências futuras — cada ocorrência nasce na efetivação da anterior. Assim, uma fixa mantém no máximo uma ocorrência pendente por vez.
- **Vencimento mensal**: o incremento de recorrência é de 1 mês; quando o dia do vencimento não existe no mês seguinte, usa-se o último dia do mês.
- **Fuso e fronteiras de tempo**: todas as datas (`dueDate`, `effectiveDate`, `endDate`) são persistidas em UTC. As fronteiras de "hoje" (efetivação padrão), "mês corrente" (escopo da listagem) e "meses anteriores" (grid de atrasados) são calculadas no frontend conforme o fuso do usuário.
- **Busca textual por valor**: o filtro de valor "contém" trata o valor como texto para correspondência parcial (ex.: "12" casa 12,00 / 112,50), conforme pedido; comparações exatas ficam a cargo do intervalo/ordenção.
- **Categoria coerente com tipo**: a categoria escolhida deve ser do mesmo `type` (despesa/receita) da transação.
- **Origem por tipo**: despesa usa conta **ou** cartão; receita usa conta. Transferência entre contas está fora de escopo desta feature.
- **Autenticação/isolamento**: reutiliza a identidade do usuário já existente (JWT); `userId` nunca vem do cliente.
- **Escopo v1**: orçamentos, relatórios, anexos/comprovantes e notificações de vencimento estão fora de escopo desta feature.

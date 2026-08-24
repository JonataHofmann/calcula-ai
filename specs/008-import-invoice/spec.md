# Feature Specification: Importar Fatura

**Feature Branch**: `008-import-invoice`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "crie uma funcionalidade, que se chama \"improtar fatura\", onde eu vou enviar o pdf da fatura e a senha do pdf, e ele vai ler o pdf, vai extrair com IA as transações. Regras: perguntar ao usuário se deve substituir as transações já cadastradas (se sim, apaga as existentes e adiciona as extraídas do pdf; se não, faz o merge cuidando pra não duplicar); antes de salvar no banco, mostrar a lista de transações a serem importadas, com o campo \"categoria\" para o usuário informar; caso haja uma despesa de meses anteriores com o mesmo nome, buscar a categoria e deixar como default; toda a lógica de IA deve ficar dentro do ai-ms."

## Clarifications

### Session 2026-08-24

- Q: Qual o escopo do conjunto de "transações já cadastradas" comparado na substituição/merge? → A: Transações do cartão selecionado no mês/período de referência da fatura.
- Q: Qual o critério de duplicidade no merge? → A: Mesma data + mesmo valor + mesma descrição (normalizada: sem diferença de caixa/espaços extras).
- Q: Com que status as despesas importadas são gravadas? → A: `pending`, com vencimento na data de vencimento da fatura; o usuário efetiva ao pagar.
- Q: Como o mês/período de referência da fatura é determinado? → A: Extraído do PDF (vencimento/competência), com o usuário podendo confirmar/ajustar na revisão.
- Q: Como importar linhas parceladas da fatura (ex.: "Parcela 3/10")? → A: Detectar o padrão "X/Y" e criar como transação parcelada (`installment`), gerando as ocorrências futuras.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extrair transações do PDF da fatura (Priority: P1)

O usuário autenticado seleciona um cartão de crédito, envia o arquivo PDF da fatura junto com a senha do PDF e aciona a importação. O sistema abre o PDF protegido, lê seu conteúdo e usa IA para identificar as transações da fatura (data, descrição e valor). Ao final, o sistema apresenta a lista de transações extraídas para revisão, ainda sem persistir nada.

**Why this priority**: É o núcleo da feature. Sem extrair corretamente as transações de um PDF protegido, nenhuma das demais regras (revisão, categorização, substituir/merge) entrega valor. Sozinha já é um MVP demonstrável: enviar fatura → ver transações extraídas.

**Independent Test**: Enviar um PDF de fatura com a senha correta e verificar que o sistema retorna a lista de transações extraídas (data, descrição, valor) para revisão, sem gravar no banco.

**Acceptance Scenarios**:

1. **Given** o usuário autenticado na tela de Importar Fatura com um cartão selecionado, **When** envia um PDF válido com a senha correta e confirma, **Then** o sistema processa o arquivo e exibe a lista de transações extraídas para revisão.
2. **Given** um PDF protegido por senha, **When** a senha informada está incorreta, **Then** o sistema não extrai nada e informa que a senha do PDF está incorreta.
3. **Given** um arquivo enviado que não é um PDF de fatura legível (corrompido, formato inesperado ou sem transações reconhecíveis), **When** o sistema tenta processá-lo, **Then** informa que não foi possível extrair transações e nenhuma alteração é feita.
4. **Given** um PDF válido com senha correta, **When** a extração é concluída, **Then** cada transação extraída apresenta ao menos data, descrição e valor.

---

### User Story 2 - Revisar e categorizar antes de salvar (Priority: P1)

Antes de qualquer gravação, o usuário vê a lista de transações a serem importadas em uma tela de revisão. Para cada transação há um campo **categoria** que o usuário pode informar. Quando existe uma despesa de meses anteriores com o **mesmo nome/descrição**, o sistema já sugere a categoria dessa despesa anterior como valor padrão, agilizando a revisão. O usuário confirma a lista para prosseguir com a gravação.

**Why this priority**: A categorização correta é o principal valor de negócio da importação (organizar gastos). A pré-seleção de categoria por histórico reduz drasticamente o esforço manual. Depende da US1, mas é indispensável para a importação ter utilidade real.

**Independent Test**: A partir de uma lista de transações extraídas, verificar que cada linha permite escolher categoria, que descrições coincidentes com despesas anteriores vêm com a categoria pré-preenchida, e que a confirmação leva ao passo de gravação.

**Acceptance Scenarios**:

1. **Given** a lista de transações extraídas exibida, **When** o usuário visualiza cada linha, **Then** há um campo de categoria editável por transação.
2. **Given** uma transação extraída cuja descrição coincide com uma despesa de mês anterior do próprio usuário, **When** a lista de revisão é montada, **Then** a categoria daquela despesa anterior aparece pré-selecionada como padrão.
3. **Given** uma transação extraída sem correspondência no histórico, **When** a lista é montada, **Then** a categoria fica vazia/sem sugestão e o usuário pode escolhê-la manualmente.
4. **Given** o usuário revisando a lista, **When** altera a categoria sugerida de uma transação, **Then** o valor escolhido substitui a sugestão para aquela transação.
5. **Given** a lista revisada, **When** o usuário confirma, **Then** o sistema avança para a decisão de substituir/merge (US3) antes de gravar.

---

### User Story 3 - Substituir ou mesclar com transações existentes (Priority: P2)

Ao confirmar a importação, o sistema pergunta se as transações já cadastradas da fatura devem ser **substituídas**. Se **sim**, o sistema apaga as transações existentes correspondentes àquela fatura e grava todas as extraídas. Se **não**, o sistema faz o **merge**: adiciona as extraídas que ainda não existem e não duplica as que já estão cadastradas.

**Why this priority**: Garante reimportações seguras (correção de fatura anterior) e importações incrementais sem lixo duplicado. É essencial para uso repetido, mas o valor principal (extrair + categorizar) já existe sem ela.

**Independent Test**: Importar uma fatura sobre um conjunto que já contém transações; escolher "substituir" e verificar que as antigas foram removidas e só as novas ficam; repetir escolhendo "não substituir" e verificar que nenhuma transação é duplicada.

**Acceptance Scenarios**:

1. **Given** a lista revisada e confirmada, **When** o sistema detecta que já existem transações cadastradas para aquela fatura, **Then** pergunta ao usuário se deseja substituí-las.
2. **Given** a pergunta de substituição, **When** o usuário escolhe **substituir**, **Then** as transações existentes correspondentes à fatura são apagadas e todas as extraídas são gravadas.
3. **Given** a pergunta de substituição, **When** o usuário escolhe **não substituir (merge)**, **Then** apenas as transações extraídas ainda inexistentes são adicionadas e as já existentes não são duplicadas.
4. **Given** a escolha de merge, **When** uma transação extraída é considerada igual a uma já cadastrada, **Then** ela é ignorada (não gera duplicata) e o usuário é informado de quantas foram ignoradas.
5. **Given** não existirem transações prévias para a fatura, **When** o usuário confirma, **Then** todas as extraídas são gravadas sem que a pergunta de substituição precise alterar o resultado.

---

### Edge Cases

- **Senha incorreta ou PDF não protegido**: senha errada bloqueia a extração com mensagem clara; se o PDF não exigir senha, a senha informada é ignorada sem erro.
- **PDF ilegível/sem transações**: arquivo corrompido, digitalizado como imagem sem texto reconhecível, ou sem linhas de transação → sistema informa que não há transações e nada é gravado.
- **Extração parcial/valores ambíguos**: linhas cuja data ou valor não puderam ser determinados com confiança são sinalizadas na revisão para o usuário corrigir ou descartar antes de gravar.
- **Descrição repetida no histórico com categorias diferentes**: quando há mais de uma categoria histórica para o mesmo nome, usa-se a da despesa anterior mais recente como padrão sugerido.
- **Usuário abandona a revisão**: se o usuário sair antes de confirmar, nada é gravado e nenhuma transação existente é alterada.
- **Fatura de outro usuário / cartão de outro usuário**: o usuário só pode importar para os próprios cartões e só enxerga/afeta as próprias transações.
- **Valores de estorno/crédito na fatura**: linhas negativas (estornos/pagamentos) são apresentadas na revisão e o usuário decide mantê-las ou descartá-las.
- **Parcela sem total legível**: quando o padrão "X/Y" é detectado parcialmente (ex.: parcela atual sem total), a linha é sinalizada na revisão para o usuário completar o total ou tratá-la como avulsa antes de gravar.
- **Reprocessamento do mesmo arquivo**: reimportar o mesmo PDF sem "substituir" não deve duplicar transações já importadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um usuário autenticado inicie uma importação de fatura selecionando um dos seus cartões de crédito e enviando um arquivo PDF acompanhado da senha do PDF.
- **FR-002**: O sistema MUST abrir/desbloquear o PDF usando a senha informada e, quando a senha estiver incorreta, MUST interromper a operação com mensagem específica de senha inválida, sem gravar nada.
- **FR-003**: O sistema MUST extrair, com apoio de IA, a lista de transações contidas na fatura, identificando ao menos data, descrição e valor de cada uma.
- **FR-003a**: O sistema MUST determinar o mês/período de referência da fatura a partir do conteúdo do PDF (data de vencimento/competência) e MUST permitir que o usuário confirme ou ajuste esse período na revisão antes de gravar.
- **FR-003b**: O sistema MUST detectar linhas parceladas na fatura (padrão "X/Y", ex.: "Parcela 3/10"), sinalizando o número da parcela atual e o total; na revisão, essas linhas MUST ser apresentadas como parceladas para o usuário confirmar.
- **FR-003c**: Ao gravar uma linha parcelada, o sistema MUST criá-la como transação parcelada (`installment`) do domínio, gerando as ocorrências correspondentes (agrupadas por `groupId`, com `installmentNumber`/`installmentCount`), consistente com o comportamento de parcelamento já existente no módulo de Transações.
- **FR-004**: Toda a lógica de leitura do PDF e extração por IA MUST residir no serviço de IA (`ai-ms`); os demais serviços apenas solicitam a extração e recebem o resultado estruturado.
- **FR-005**: O sistema MUST apresentar ao usuário a lista de transações extraídas para revisão **antes** de qualquer gravação no banco.
- **FR-006**: O sistema MUST oferecer, para cada transação na revisão, um campo de **categoria** que o usuário pode informar ou alterar.
- **FR-007**: Para cada transação extraída, o sistema MUST procurar despesas de meses anteriores do próprio usuário com a mesma descrição/nome e, havendo correspondência, MUST pré-selecionar a categoria dessa despesa anterior como padrão sugerido.
- **FR-008**: Quando houver múltiplas categorias históricas para a mesma descrição, o sistema MUST usar a categoria da ocorrência mais recente como padrão sugerido.
- **FR-009**: O sistema MUST perguntar ao usuário se deseja **substituir** as transações já cadastradas correspondentes à fatura antes de gravar.
- **FR-010**: Ao escolher **substituir**, o sistema MUST apagar as transações existentes correspondentes à fatura e MUST gravar todas as transações extraídas revisadas.
- **FR-011**: Ao escolher **não substituir (merge)**, o sistema MUST adicionar somente as transações extraídas que ainda não existem e MUST evitar duplicar as já cadastradas.
- **FR-012**: O sistema MUST informar ao usuário um resumo do resultado da gravação (quantas adicionadas, quantas ignoradas por duplicidade e, no caso de substituição, quantas removidas).
- **FR-013**: O sistema MUST vincular cada transação importada ao cartão de crédito selecionado e ao usuário autenticado, gravando-as como despesas com `status = pending` e vencimento na data de vencimento da fatura; o usuário as efetiva ao pagar (fluxo existente de efetivação).
- **FR-014**: O sistema MUST garantir isolamento por usuário: um usuário só pode importar para os próprios cartões e a importação nunca lê, apaga ou altera transações de outro usuário.
- **FR-015**: O sistema MUST permitir que o usuário descarte ou corrija linhas sinalizadas como incertas (data/valor não reconhecidos) antes de confirmar; linhas descartadas não são gravadas.
- **FR-016**: O sistema MUST não persistir nenhuma transação enquanto o usuário não confirmar a revisão e a decisão de substituir/merge.
- **FR-017**: O sistema MUST tratar a senha do PDF como dado sensível, não a expondo em logs, respostas ou telas após o uso.
- **FR-018**: O sistema MUST considerar duas transações equivalentes (duplicadas) para fins de merge quando tiverem a **mesma data**, o **mesmo valor** e a **mesma descrição normalizada** (comparação ignorando diferenças de caixa e espaços extras); transações que diferem em qualquer um desses três campos são tratadas como distintas.
- **FR-019**: O sistema MUST restringir o conjunto de "transações já cadastradas" comparadas na substituição/merge às transações do **cartão selecionado** dentro do **mês/período de referência da fatura**; transações de outros cartões ou de outros períodos nunca são apagadas nem comparadas.

### Key Entities *(include if feature involves data)*

- **Fatura Importada (sessão de importação)**: representa uma tentativa de importação — cartão de crédito alvo, usuário dono, período/mês de referência, origem (arquivo PDF), estado (extraída / revisada / gravada / cancelada) e resumo do resultado. Existe para orquestrar o fluxo; pode ou não ser persistida além da conclusão.
- **Transação Extraída (item de revisão)**: linha candidata proveniente do PDF — data, descrição, valor, categoria sugerida (do histórico) e categoria escolhida pelo usuário, sinalização de incerteza e indicação de parcelamento (número da parcela atual e total, quando detectado "X/Y"). Ao gravar, converte-se em Transação (despesa) `single` ou `installment` vinculada ao cartão.
- **Transação**: entidade existente do domínio (descrição, dueDate, valor, tipo despesa/receita, categoria, cartão, status). A importação cria/atualiza despesas vinculadas ao cartão selecionado.
- **Categoria**: entidade existente do domínio, usada para categorizar cada transação importada e como fonte da sugestão baseada em histórico.
- **Cartão de Crédito**: entidade existente do domínio; a fatura importada é sempre vinculada a um cartão do usuário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em faturas legíveis, o sistema extrai corretamente ao menos 95% das linhas de transação (data, descrição e valor) sem intervenção manual.
- **SC-002**: Pelo menos 70% das transações cujo nome já apareceu em meses anteriores chegam à revisão com a categoria correta pré-selecionada.
- **SC-003**: O usuário consegue concluir uma importação típica (envio → revisão → gravação) em menos de 3 minutos para uma fatura de até ~50 transações.
- **SC-004**: Em reimportações com opção de merge, 0% de transações duplicadas são criadas.
- **SC-005**: 100% das importações com senha incorreta ou arquivo ilegível terminam sem qualquer alteração no banco e com mensagem de erro compreensível.
- **SC-006**: A senha do PDF nunca aparece em logs, respostas de API ou telas após o processamento (verificável por inspeção).

## Assumptions

- A fatura importada é sempre de **um cartão de crédito**, selecionado pelo usuário no início do fluxo; as transações importadas são gravadas como **despesas** vinculadas a esse cartão.
- O período/mês de referência da fatura é derivado do conteúdo do PDF (vencimento/competência) e pode ser confirmado/ajustado pelo usuário na revisão.
- A sugestão de categoria por histórico considera apenas despesas do **próprio usuário** e compara pela **descrição/nome** (correspondência normalizada, ignorando maiúsculas/minúsculas e espaços extras).
- As categorias disponíveis na revisão são as já cadastradas pelo usuário (reutiliza o cadastro de Categorias existente); não faz parte desta feature criar categorias automaticamente.
- A extração por IA e a leitura do PDF ocorrem no serviço `ai-ms`; a persistência das transações continua no serviço responsável pelo domínio de transações.
- Datas são persistidas em UTC e a interpretação de "mês/período" segue o fuso do usuário, consistente com o módulo de Transações existente.
- O upload é de um único arquivo PDF por importação; múltiplos arquivos por vez estão fora do escopo desta versão.
- Limites de tamanho de arquivo e formatos aceitos seguem padrões da aplicação (PDF apenas), com mensagem de erro amigável quando excedidos.

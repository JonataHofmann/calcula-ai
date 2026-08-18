# Feature Specification: Cadastros — Contas, Categorias e Cartões de Crédito

**Feature Branch**: `003-accounts-categories-cards`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "crie os cadastros: #Conta (id, usuário dono, name, bank com seletor de bancos, icon com seletor de ícones, color com seletor de cor, apresentação em card); #Categorias (id, usuário dono, name, icon, color, type expense/income, com subcategorias, categorias padrão para todos que o usuário pode excluir só para si, e criar novas personalizadas); #Cartão de crédito (id, usuário dono, name, lastDigits, dueDay, closingDay, limit, brand, apresentação em card simulando cartão). Frontend com animações (react motion), forms de incluir/editar em popup, aplicação componentizada. Arquitetura com boas práticas de sistemas distribuídos, microserviços e BFF, expondo somente dados necessários, monorepo."

## Clarifications

### Session 2026-08-17

- Q: O usuário pode personalizar (editar) uma categoria padrão só para si, ou apenas ocultá-la? → A: Pode editar categorias padrão só para si via override pessoal (copy-on-write); a edição não afeta outros usuários. Também pode ocultar.
- Q: De onde vêm as listas de bancos e bandeiras? → A: Catálogo estático interno curado e versionado na aplicação, exposto pelo BFF à UI; sem integração externa.
- Q: O cartão de crédito se vincula a uma conta pagadora neste cadastro? → A: Não. Cartão é independente da conta nesta feature; a relação fica para a feature futura de faturas/pagamentos.
- Q: A hierarquia de subcategorias é fixa em 2 níveis ou recursiva? → A: Recursiva — subcategorias podem ter sub-subcategorias em profundidade arbitrária (árvore auto-referenciada).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastro de Contas (Priority: P1)

Como usuário autenticado, quero cadastrar minhas contas (ex.: conta corrente, poupança, carteira) informando um nome, o banco, um ícone e uma cor de identificação, para organizar visualmente de onde meu dinheiro entra e sai. Cada conta é apresentada como um card com sua identidade visual (ícone + cor + banco).

**Why this priority**: A conta é a entidade base que ancora todo o restante da plataforma financeira (transações, saldos, cartões). Sem ela, nenhuma movimentação pode ser atribuída a uma origem/destino.

**Independent Test**: Autenticar, criar uma conta escolhendo banco, ícone e cor; verificar que ela aparece como card com a identidade visual escolhida; editar e excluir a conta e verificar a atualização da lista.

**Acceptance Scenarios**:

1. **Given** usuário autenticado sem contas, **When** aciona "Nova conta", **Then** um popup (modal) de formulário é exibido com campos de nome, seletor de banco, seletor de ícone e seletor de cor.
2. **Given** o formulário de conta aberto, **When** o usuário seleciona um banco a partir do seletor de bancos, **Then** o banco escolhido fica associado à conta.
3. **Given** o formulário de conta aberto, **When** o usuário abre o seletor de ícones, **Then** vê uma variedade ampla de ícones e pode escolher um; ao abrir o seletor de cor, escolhe uma cor de uma paleta.
4. **Given** dados válidos preenchidos, **When** o usuário confirma, **Then** a conta é salva, o popup fecha com transição animada e a conta aparece como um card com o ícone, a cor e o banco selecionados.
5. **Given** uma conta existente, **When** o usuário aciona "Editar", **Then** o mesmo popup abre pré-preenchido e as alterações são refletidas no card ao salvar.
6. **Given** uma conta existente, **When** o usuário aciona "Excluir" e confirma, **Then** a conta é removida da lista com transição animada.
7. **Given** o formulário com nome vazio, **When** o usuário tenta salvar, **Then** a validação impede o envio e sinaliza o campo obrigatório.
8. **Given** usuário A e usuário B, **When** cada um lista suas contas, **Then** cada um vê apenas as próprias contas, nunca as do outro.

---

### User Story 2 - Cadastro de Categorias com subcategorias (Priority: P2)

Como usuário autenticado, quero organizar minhas movimentações em categorias (ex.: Alimentação, Transporte, Salário) do tipo despesa ou receita, cada uma com ícone e cor, e com subcategorias (ex.: Alimentação → Restaurante, Mercado). A plataforma já oferece um conjunto de categorias padrão para todos os usuários; posso ocultar (excluir) qualquer categoria padrão apenas para mim, sem afetar outros usuários, e posso criar categorias personalizadas.

**Why this priority**: Categorias são a espinha dorsal da classificação financeira futura (orçamentos, relatórios), mas dependem de o usuário já estar no ambiente autenticado com a base de contas.

**Independent Test**: Autenticar, visualizar as categorias padrão separadas por tipo (despesa/receita), ocultar uma padrão e confirmar que ela some apenas para o usuário atual, criar uma categoria personalizada com subcategorias, e editar/excluir a personalizada.

**Acceptance Scenarios**:

1. **Given** um novo usuário, **When** acessa Categorias, **Then** vê um conjunto de categorias padrão pré-existentes, agrupadas por tipo (despesa e receita), cada uma com ícone e cor.
2. **Given** uma categoria padrão, **When** o usuário a exclui/oculta, **Then** ela deixa de aparecer para esse usuário, permanece disponível para os demais usuários, e o próprio usuário pode restaurá-la.
3. **Given** o usuário, **When** cria uma categoria personalizada, **Then** um popup de formulário permite informar nome, tipo (despesa/receita), ícone e cor, e a categoria passa a aparecer junto às demais do mesmo tipo.
4. **Given** uma categoria (padrão ou personalizada), **When** o usuário adiciona subcategorias, **Then** as subcategorias ficam vinculadas à categoria e são exibidas de forma hierárquica.
5. **Given** uma categoria personalizada, **When** o usuário a edita ou exclui, **Then** as alterações se aplicam apenas ao seu próprio conjunto de categorias.
6. **Given** o tipo de uma categoria (despesa/receita), **When** o usuário filtra ou visualiza, **Then** despesas e receitas ficam claramente distinguíveis.
7. **Given** usuário A e usuário B, **When** cada um personaliza suas categorias, **Then** as personalizações e exclusões de um não afetam o outro.

---

### User Story 3 - Cadastro de Cartões de Crédito (Priority: P3)

Como usuário autenticado, quero cadastrar meus cartões de crédito informando nome, quatro últimos dígitos, dia de vencimento, dia de fechamento, limite e bandeira, para acompanhar meus cartões. Cada cartão é apresentado em formato de card visual que simula um cartão de crédito real (bandeira, últimos dígitos, nome).

**Why this priority**: Complementa a gestão financeira e reaproveita o padrão de card visual do design system, mas não é pré-requisito para contas e categorias.

**Independent Test**: Autenticar, cadastrar um cartão com todos os campos; verificar que aparece como card visual simulando um cartão físico; editar limite/datas e excluir o cartão.

**Acceptance Scenarios**:

1. **Given** usuário autenticado, **When** aciona "Novo cartão", **Then** um popup de formulário é exibido com campos de nome, últimos dígitos, dia de vencimento, dia de fechamento, limite e bandeira.
2. **Given** o formulário de cartão, **When** o usuário informa os quatro últimos dígitos, **Then** apenas quatro dígitos numéricos são aceitos.
3. **Given** o formulário de cartão, **When** o usuário informa dia de vencimento e dia de fechamento, **Then** somente dias válidos de um mês (1–31) são aceitos.
4. **Given** dados válidos, **When** o usuário confirma, **Then** o cartão é salvo e apresentado como um card visual que simula um cartão de crédito, exibindo bandeira, nome e os quatro últimos dígitos.
5. **Given** um cartão existente, **When** o usuário edita (ex.: limite, datas) ou exclui, **Then** o card é atualizado ou removido com transição animada.
6. **Given** usuário A e usuário B, **When** cada um lista seus cartões, **Then** cada um vê apenas os próprios cartões.

---

### Edge Cases

- O que acontece quando o usuário tenta criar duas contas/categorias/cartões com o mesmo nome? (Assumido: permitido; a identidade visual e demais campos diferenciam; nomes duplicados não bloqueiam.)
- Como o sistema trata a exclusão de uma categoria padrão que o usuário já havia ocultado e depois tenta ocultar de novo? (Operação idempotente: permanece oculta.)
- O que acontece com subcategorias quando a categoria pai é excluída/ocultada? (As subcategorias vinculadas deixam de ser exibidas junto com a categoria pai.)
- Como o sistema lida com dia de fechamento igual ao dia de vencimento, ou dias 29–31 em meses curtos? (Datas são armazenadas como dia do mês; a resolução do dia efetivo em cada mês é responsabilidade de features futuras de fatura, fora do escopo deste cadastro.)
- O que acontece ao tentar salvar um formulário com campos obrigatórios vazios ou valores inválidos (limite negativo, dígitos não numéricos)? (Validação impede o envio e sinaliza os campos.)
- Como a lista se comporta sem nenhum registro? (Estado vazio com chamada à ação de criar o primeiro registro.)

## Requirements *(mandatory)*

### Functional Requirements

**Contas**

- **FR-001**: O sistema MUST permitir que o usuário autenticado crie, visualize, edite e exclua suas contas.
- **FR-002**: Cada conta MUST conter nome, banco, ícone e cor, e MUST ser associada ao usuário dono.
- **FR-003**: O sistema MUST oferecer um seletor de bancos a partir de um catálogo estático interno curado de bancos, exposto pela aplicação (sem integração externa).
- **FR-004**: O sistema MUST oferecer um seletor de ícones com uma variedade ampla de opções de ícones.
- **FR-005**: O sistema MUST oferecer um seletor de cor com uma paleta de opções.
- **FR-006**: O sistema MUST apresentar cada conta como um card exibindo sua identidade visual (ícone, cor e banco).

**Categorias**

- **FR-007**: O sistema MUST fornecer um conjunto de categorias padrão, comum a todos os usuários, agrupadas por tipo (despesa/receita).
- **FR-008**: Cada categoria MUST conter nome, ícone, cor e tipo (despesa ou receita).
- **FR-009**: O sistema MUST permitir que o usuário crie categorias personalizadas associadas a si.
- **FR-010**: O sistema MUST permitir que o usuário oculte/exclua uma categoria padrão apenas para si, sem afetar outros usuários, e MUST permitir restaurá-la.
- **FR-010a**: O sistema MUST permitir que o usuário personalize (edite nome, ícone, cor) uma categoria padrão apenas para si, criando um override pessoal (copy-on-write) que não afeta outros usuários; o usuário MUST poder reverter ao padrão original.
- **FR-011**: O sistema MUST permitir que o usuário edite e exclua suas categorias personalizadas, afetando somente o próprio conjunto.
- **FR-012**: O sistema MUST suportar subcategorias vinculadas a uma categoria (padrão ou personalizada), com hierarquia recursiva de profundidade arbitrária (subcategoria pode conter sub-subcategorias), e apresentá-las de forma hierárquica.
- **FR-013**: O sistema MUST distinguir visualmente categorias de despesa e de receita.

**Cartões de Crédito**

- **FR-014**: O sistema MUST permitir que o usuário autenticado crie, visualize, edite e exclua seus cartões de crédito.
- **FR-015**: Cada cartão MUST conter nome, quatro últimos dígitos, dia de vencimento, dia de fechamento, limite e bandeira, e MUST ser associado ao usuário dono.
- **FR-016**: O sistema MUST validar que os últimos dígitos sejam exatamente quatro dígitos numéricos e que os dias de vencimento e fechamento sejam dias válidos do mês (1–31).
- **FR-017**: O sistema MUST apresentar cada cartão como um card visual que simula um cartão de crédito, exibindo bandeira, nome e os quatro últimos dígitos.

**Transversais (todos os cadastros)**

- **FR-018**: Todos os formulários de criação e edição MUST ser apresentados em popup (modal) sobreposto à lista.
- **FR-019**: As transições de abertura/fechamento de popup e de inserção/remoção de itens MUST ser animadas para uma experiência fluida.
- **FR-020**: O sistema MUST validar campos obrigatórios e valores inválidos antes de persistir, sinalizando erros ao usuário.
- **FR-021**: Cada usuário MUST acessar apenas seus próprios registros; o sistema MUST impedir que um usuário veja ou altere registros de outro usuário.
- **FR-022**: O sistema MUST apresentar um estado vazio com ação para criar o primeiro registro em cada cadastro sem itens.
- **FR-023**: O sistema MUST expor externamente somente os dados necessários de cada entidade para a interface, sem vazar campos internos desnecessários.

### Key Entities *(include if feature involves data)*

- **Conta (Account)**: Representa uma origem/destino de dinheiro do usuário. Atributos: identificador, usuário dono, nome, banco, ícone, cor. Pertence a um único usuário.
- **Categoria (Category)**: Agrupador de movimentações. Atributos: identificador, nome, ícone, cor, tipo (despesa/receita), origem (padrão do sistema ou personalizada do usuário). Categorias padrão são compartilhadas; personalizadas pertencem a um usuário. Relaciona-se com Subcategorias.
- **Subcategoria (Subcategory)**: Detalhamento de uma categoria. Atributos: identificador, nome, pai (categoria ou outra subcategoria). Estrutura recursiva/auto-referenciada: vinculada a exatamente um pai; pode conter subcategorias filhas em profundidade arbitrária. Herda o tipo (despesa/receita) da categoria raiz.
- **Ocultação de Categoria por Usuário (User Category Hidden)**: Registro que marca uma categoria padrão como oculta para um usuário específico, sem removê-la para os demais. Relaciona usuário ↔ categoria padrão.
- **Override de Categoria por Usuário (User Category Override)**: Personalização pessoal (copy-on-write) de uma categoria padrão para um usuário — armazena os campos sobrescritos (nome, ícone, cor). Relaciona usuário ↔ categoria padrão; reversível ao original. Não visível a outros usuários.
- **Cartão de Crédito (Credit Card)**: Representa um cartão de crédito do usuário. Atributos: identificador, usuário dono, nome, quatro últimos dígitos, dia de vencimento, dia de fechamento, limite, bandeira. Pertence a um único usuário.
- **Banco (Bank)**: Item de referência de um catálogo estático interno curado de bancos, disponível para seleção. Atributos: identificador/nome, identidade visual. Somente leitura para o usuário.
- **Bandeira (Brand)**: Item de referência de um catálogo estático interno curado das bandeiras de cartão disponíveis para seleção. Somente leitura para o usuário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário consegue cadastrar uma nova conta (com banco, ícone e cor) em menos de 1 minuto na primeira tentativa.
- **SC-002**: Um usuário consegue criar uma categoria personalizada com ao menos uma subcategoria em menos de 90 segundos.
- **SC-003**: 100% dos registros (contas, categorias, cartões) exibidos a um usuário pertencem ou estão disponíveis a esse usuário; nenhum registro de outro usuário é exposto.
- **SC-004**: Ocultar uma categoria padrão afeta somente o usuário que a ocultou, verificável comparando as listas de dois usuários distintos.
- **SC-005**: Todos os formulários de criação/edição abrem em popup e concluem com o item refletido na lista sem recarregar a página inteira.
- **SC-006**: 95% das operações de criação/edição/exclusão refletem visualmente na lista em até 1 segundo após a confirmação.
- **SC-007**: Um cartão cadastrado é reconhecível como cartão de crédito pela apresentação visual (bandeira, últimos dígitos e nome visíveis) em uma verificação de usabilidade.

## Assumptions

- **Autenticação existente**: O fluxo de identidade e sessão já entregue na feature `001-app-shell-keycloak-login` (sessão conduzida pelo BFF, cookie httpOnly) é reutilizado; "usuário dono" deriva da identidade autenticada.
- **Design system existente**: Componentes visuais e o padrão de card visual de cartão de crédito da feature `002-design-system` são reutilizados; ícones, cores e cards seguem os tokens já definidos.
- **Arquitetura**: O trabalho ocorre em monorepo com separação por domínio (microserviços por domínio de negócio) e um BFF que agrega e expõe à interface somente os dados necessários de cada cadastro; contratos entre camadas expõem o mínimo necessário.
- **Subcategorias recursivas**: A hierarquia de subcategorias é recursiva (auto-referenciada), permitindo sub-subcategorias em profundidade arbitrária; a UI deve exibir e permitir navegar/criar em qualquer nível.
- **Moeda única**: O limite do cartão e valores monetários assumem uma única moeda padrão (BRL), sem conversão nesta feature.
- **Listas de referência curadas**: A lista de bancos, o conjunto de ícones, a paleta de cores e as bandeiras de cartão são conjuntos curados/predefinidos disponibilizados pela aplicação.
- **Categorias padrão**: Existe um conjunto inicial padrão de categorias de despesa e receita, definido pela aplicação e comum a todos os usuários no primeiro acesso.
- **Nomes não únicos**: Nomes de contas, categorias e cartões não precisam ser únicos; duplicidade é permitida.
- **Escopo do cadastro**: Esta feature cobre apenas os cadastros (CRUD e apresentação). Transações, faturas, saldos e orçamentos que usam essas entidades estão fora do escopo. O cartão de crédito não se vincula a uma conta pagadora nesta feature (relação adiada para faturas/pagamentos).
- **Frontend animado e componentizado**: A interface usa animações para transições fluidas e é construída com componentes reutilizáveis (incluindo seletor de banco, seletor de ícone e seletor de cor reaproveitáveis entre formulários).

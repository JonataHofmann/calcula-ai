# Feature Specification: Design System — Financial Dashboard

**Feature Branch**: `002-design-system`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "crie um design system baseado no https://www.figma.com/design/8kMF6TIrl8aRLKeTcpRouQ/Financial-Dashboard--Community-?node-id=1-12&t=pu0VZN4uPnj4B39A-1 — não fuja muito disso, mas caso não exista o componente necessário, crie baseado nesse layout. crie os componentes básicos"

## Clarifications

### Session 2026-08-17

- Q: Fonte da verdade para os tokens de design? → A: Extração via Figma API/MCP com token de acesso fornecido pelo usuário; valores exatos (cores, tipografia, espaçamentos, raios, sombras) extraídos do arquivo de referência.
- Q: Suporte a temas (claro/escuro)? → A: Dois temas completos (claro + escuro) nesta feature, com alternância pelo usuário.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fundação visual: tokens de design (Priority: P1)

Como desenvolvedor da plataforma, ao construir qualquer tela eu utilizo um conjunto único de tokens de design (cores, tipografia, espaçamentos, raios de borda, sombras) extraídos do layout de referência do Figma (Financial Dashboard Community). Todas as telas da aplicação consomem os mesmos tokens, garantindo consistência visual sem valores mágicos espalhados pelo código.

**Why this priority**: Tokens são a base de todo o resto do design system; componentes sem tokens geram inconsistência imediata.

**Independent Test**: Inspecionar o pacote de design system e verificar que cores, tipografia e espaçamentos estão definidos como tokens nomeados e que uma tela de exemplo os consome sem valores hardcoded.

**Acceptance Scenarios**:

1. **Given** o layout de referência do Figma, **When** os tokens são definidos, **Then** a paleta de cores (primária, secundária, superfícies, texto, estados de sucesso/erro/aviso), escala tipográfica e escala de espaçamento refletem o visual da referência.
2. **Given** os tokens definidos, **When** um desenvolvedor constrói uma nova tela, **Then** consegue estilizar usando apenas tokens nomeados, sem redefinir cores ou tamanhos manualmente.
3. **Given** uma mudança em um token (ex.: cor primária), **When** o token é atualizado, **Then** todos os componentes que o consomem refletem a mudança sem edição individual.

---

### User Story 2 - Componentes básicos de interface (Priority: P1)

Como desenvolvedor, tenho à disposição um conjunto de componentes básicos reutilizáveis, fiéis ao layout de referência: botões (variações primário/secundário/fantasma e estados hover/foco/desabilitado/carregando), campos de entrada (texto, seleção, busca) com estados de erro e ajuda, cartões de conteúdo, badges/etiquetas, avatar, tabela de dados simples, e indicadores de carregamento. Componentes que já existem no design system são evoluídos para aderir ao layout de referência; os que não existem são criados seguindo o mesmo visual.

**Why this priority**: São os blocos de construção de todas as telas da plataforma financeira (dashboard, transações, cartões etc.).

**Independent Test**: Renderizar cada componente isoladamente em uma página de demonstração e comparar visualmente com o layout de referência, incluindo todos os estados interativos.

**Acceptance Scenarios**:

1. **Given** o conjunto de componentes básicos, **When** renderizados numa página de demonstração, **Then** cada um apresenta visual consistente com o layout de referência (cores, tipografia, raios, sombras).
2. **Given** um botão, **When** o usuário interage (hover, foco via teclado, clique, estado desabilitado, estado carregando), **Then** cada estado tem feedback visual distinto e perceptível.
3. **Given** um campo de entrada com valor inválido, **When** a validação falha, **Then** o campo exibe estado de erro com mensagem associada e indicação visual clara.
4. **Given** componentes já existentes no design system (botão, cartão, badge, skeleton), **When** o design system é aplicado, **Then** eles passam a seguir o novo visual sem quebrar os usos existentes.

---

### User Story 3 - Componentes de dashboard financeiro (Priority: P2)

Como desenvolvedor construindo telas financeiras, tenho componentes específicos do domínio inspirados no layout de referência: cartão de métrica/saldo (valor monetário com variação percentual), representação visual de cartão de crédito, lista de transações (item com ícone, descrição, data e valor com sinal), e contêiner de gráfico com título e legenda.

**Why this priority**: Aceleram a construção das telas do produto, mas dependem dos tokens e componentes básicos (P1).

**Independent Test**: Montar uma página de demonstração reproduzindo a composição do dashboard de referência usando apenas componentes do design system.

**Acceptance Scenarios**:

1. **Given** um cartão de métrica, **When** recebe um valor monetário e uma variação, **Then** exibe o valor formatado em BRL e a variação com cor semântica (positiva/negativa).
2. **Given** um item de transação, **When** o valor é negativo (despesa) ou positivo (receita), **Then** a cor e o sinal do valor comunicam a natureza da transação.
3. **Given** a composição de componentes do design system, **When** montada em página de demonstração, **Then** o resultado se aproxima visualmente do dashboard de referência sem customizações fora do design system.

---

### User Story 4 - Página de demonstração viva (Priority: P3)

Como desenvolvedor ou designer, acesso uma página de demonstração interna que exibe todos os tokens e componentes do design system com seus estados e variações, servindo de documentação viva e ferramenta de revisão visual.

**Why this priority**: Documentação viva facilita adoção e revisão, mas o design system funciona sem ela.

**Independent Test**: Navegar até a página de demonstração e verificar que todos os componentes e tokens estão listados com variações e estados.

**Acceptance Scenarios**:

1. **Given** a página de demonstração, **When** acessada, **Then** exibe todos os componentes do design system com suas variações e estados interativos.
2. **Given** um novo componente adicionado ao design system, **When** registrado na página de demonstração, **Then** aparece listado com suas variações.

---

### Edge Cases

- Textos longos (nomes de transação, rótulos) em componentes: truncamento com reticências sem quebrar layout.
- Valores monetários grandes (milhões) em cartões de métrica: formatação BRL mantém legibilidade sem overflow.
- Componentes em larguras pequenas (a partir de 360px): adaptam-se sem sobreposição ou corte de conteúdo.
- Estados de dados vazios (tabela sem linhas, lista de transações vazia): componente exibe estado vazio amigável.
- Navegação exclusivamente por teclado: todos os componentes interativos são alcançáveis e operáveis com indicador de foco visível.
- Elementos do layout de referência sem equivalente direto: criar componente novo seguindo tokens e linguagem visual da referência (não inventar estilo divergente).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Design system MUST definir tokens de cor (primária, secundária, superfícies/fundos, texto, bordas, e cores semânticas de sucesso, erro, aviso e informação) extraídos do arquivo Figma de referência via Figma API/MCP (valores exatos, não aproximados).
- **FR-002**: Design system MUST definir escala tipográfica (família, tamanhos, pesos, alturas de linha) e escala de espaçamento/raios/sombras derivadas do layout de referência.
- **FR-003**: Tokens MUST ser a única fonte de estilo dos componentes; nenhum componente pode usar valores de cor/tamanho fora dos tokens.
- **FR-004**: Design system MUST fornecer componente de botão com variantes (primário, secundário, fantasma/texto, destrutivo) e estados (padrão, hover, foco, desabilitado, carregando).
- **FR-005**: Design system MUST fornecer campos de formulário (entrada de texto, seleção, campo de busca) com rótulo, texto de ajuda, estado de erro com mensagem e estado desabilitado.
- **FR-006**: Design system MUST fornecer componentes de conteúdo: cartão (card), badge/etiqueta com variantes semânticas, avatar (imagem e iniciais) e separador.
- **FR-007**: Design system MUST fornecer tabela de dados simples (cabeçalho, linhas, estado vazio) e indicadores de carregamento (skeleton e spinner).
- **FR-008**: Design system MUST fornecer componentes de domínio financeiro: cartão de métrica (valor BRL + variação percentual com cor semântica), item/lista de transações (ícone, descrição, data, valor com sinal), representação visual de cartão de crédito e contêiner de gráfico (título, legenda, área de conteúdo).
- **FR-009**: Componentes existentes (botão, cartão, badge, skeleton) MUST ser evoluídos para o novo visual mantendo compatibilidade com os usos atuais.
- **FR-010**: Todos os componentes interativos MUST ser operáveis por teclado com indicador de foco visível e nomes acessíveis.
- **FR-011**: Contraste texto/fundo dos tokens MUST atender nível AA de acessibilidade (4.5:1 para texto normal, 3:1 para texto grande).
- **FR-012**: Componentes MUST se adaptar a larguras a partir de 360px sem perda de conteúdo ou sobreposição.
- **FR-013**: Componentes que exibem coleções (tabela, lista de transações) MUST prover estado vazio.
- **FR-014**: Valores monetários exibidos por componentes do design system MUST ser formatados em BRL a partir de valores decimais em string (nunca float).
- **FR-015**: Sistema MUST prover página de demonstração interna exibindo todos os tokens e componentes com variações e estados.
- **FR-016**: Componentes do design system MUST ser genéricos (sem regras de negócio ou chamadas a serviços); composições específicas de feature ficam fora do design system.
- **FR-017**: Design system MUST prover dois temas completos (claro e escuro) via tokens semânticos; todos os componentes MUST renderizar corretamente em ambos.
- **FR-018**: Usuário MUST poder alternar entre tema claro e escuro; a preferência MUST ser persistida entre sessões e respeitar a preferência do sistema operacional como padrão inicial.

### Key Entities

- **Token de Design**: valor nomeado de estilo (cor, tamanho, espaçamento, raio, sombra, tipografia); fonte única de verdade visual.
- **Componente**: unidade reutilizável de interface com variantes e estados definidos; consome exclusivamente tokens.
- **Variante**: variação visual nomeada de um componente (ex.: botão primário/secundário).
- **Estado**: condição interativa ou de dados de um componente (hover, foco, desabilitado, carregando, erro, vazio).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos componentes listados nos requisitos existem, renderizam e são exibidos na página de demonstração com todas as variantes e estados.
- **SC-002**: Zero valores de cor ou tipografia fora dos tokens nos componentes do design system (verificável por inspeção/lint).
- **SC-003**: 100% dos pares texto/fundo definidos pelos tokens atendem contraste AA.
- **SC-004**: Todos os componentes interativos são operáveis por teclado com foco visível em 100% dos casos testados.
- **SC-005**: Uma composição de dashboard montada apenas com componentes do design system é reconhecível como derivada do layout de referência em revisão visual lado a lado.
- **SC-006**: Componentes existentes atualizados não quebram nenhum uso atual (build e testes do monorepo permanecem verdes).
- **SC-007**: Componentes permanecem íntegros (sem overflow/sobreposição) em larguras de 360px a 1440px.
- **SC-008**: 100% dos componentes renderizam corretamente nos temas claro e escuro (verificável na página de demonstração com alternância); contraste AA atendido em ambos.
- **SC-009**: A preferência de tema escolhida persiste após recarregar a página e em nova sessão.

## Assumptions

- O layout de referência é o "Financial Dashboard (Community)" do Figma informado pelo usuário; fidelidade é "próxima, não pixel-perfect" — componentes ausentes na referência são criados seguindo a mesma linguagem visual.
- Os valores dos tokens são extraídos do arquivo Figma via Figma API/MCP; o usuário fornecerá o token de acesso antes da implementação. Se a extração falhar (arquivo indisponível, permissões), o fallback é aproximação por inspeção visual com revisão posterior.
- O design system vive no pacote compartilhado de UI existente (`packages/ui`) e é consumido inicialmente pela aplicação web do usuário (`apps/web`).
- Tema claro segue fielmente a referência do Figma; tema escuro é derivado da mesma paleta e linguagem visual (a referência não define dark mode explícito), mantendo as cores de marca e semânticas.
- Componentes de gráfico limitam-se ao contêiner (título, legenda, área); a biblioteca/implementação de gráficos em si fica fora do escopo desta feature.
- A página de demonstração é uma rota interna simples da aplicação web (não requer ferramenta dedicada de catálogo).
- Idioma e formatação: português (BR), moeda BRL, consistente com o restante do projeto.
- Ícones usados pelos componentes seguem um conjunto único consistente com o visual da referência.

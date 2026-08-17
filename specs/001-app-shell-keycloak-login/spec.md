# Feature Specification: App Shell & Keycloak Login

**Feature Branch**: `001-app-shell-keycloak-login`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "crie a base do projeto, menu lateral, header, e o fluxo de logar da aplicação com o keycloak. faça o fluxo de login com keycloak, onde se não estiver logado va para o keycloak e quando logar volte para aplicação. adicione as validações no back e no front"

## Clarifications

### Session 2026-08-17

- Q: Onde vive a sessão do usuário (postura de segurança do token)? → A: Fluxo OIDC conduzido pelo BFF (confidential client): tokens ficam no servidor, browser recebe apenas cookie de sessão httpOnly.
- Q: Política de expiração da sessão na aplicação? → A: Renovação silenciosa enquanto usuário ativo + expiração por inatividade de 30 minutos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login com redirecionamento ao provedor de identidade (Priority: P1)

Um usuário não autenticado acessa qualquer página protegida da aplicação. Ele é automaticamente redirecionado para a tela de login do provedor de identidade (Keycloak). Após informar credenciais válidas, ele retorna automaticamente à aplicação, autenticado, na página que originalmente tentou acessar (ou na página inicial).

**Why this priority**: Sem autenticação nenhuma funcionalidade financeira pode ser exposta com segurança. É o pré-requisito de todo o resto da plataforma.

**Independent Test**: Acessar a aplicação sem sessão ativa, verificar redirecionamento ao provedor de identidade, autenticar e verificar retorno à aplicação com sessão válida e identidade do usuário visível.

**Acceptance Scenarios**:

1. **Given** usuário sem sessão ativa, **When** acessa qualquer rota protegida da aplicação, **Then** é redirecionado para a página de login do provedor de identidade.
2. **Given** usuário na tela de login do provedor, **When** informa credenciais válidas, **Then** retorna à aplicação autenticado e vê seu nome/identificação no header.
3. **Given** usuário na tela de login do provedor, **When** informa credenciais inválidas, **Then** permanece no provedor com mensagem de erro e não acessa a aplicação.
4. **Given** usuário autenticado, **When** acessa rotas protegidas, **Then** navega normalmente sem novo redirecionamento de login.
5. **Given** usuário tentou acessar uma rota protegida específica antes do login, **When** completa o login, **Then** retorna a essa mesma rota (deep-link preservado).

---

### User Story 2 - Base visual da aplicação: menu lateral e header (Priority: P2)

Um usuário autenticado vê a estrutura base da aplicação: um menu lateral com as áreas principais da plataforma financeira (ex.: Visão Geral, Contas, Transações, Cartões, Orçamentos, Metas) e um header com identificação do usuário e ação de sair. O menu lateral pode ser recolhido/expandido e o estado é preservado durante a navegação.

**Why this priority**: A estrutura de navegação é a fundação de todas as telas futuras, mas só faz sentido após o login existir.

**Independent Test**: Após autenticar, verificar presença do menu lateral com itens de navegação, header com nome do usuário e botão de logout, e comportamento de recolher/expandir o menu.

**Acceptance Scenarios**:

1. **Given** usuário autenticado, **When** a aplicação carrega, **Then** vê menu lateral com itens de navegação e header com sua identificação.
2. **Given** menu lateral expandido, **When** usuário clica em recolher, **Then** o menu recolhe e permanece recolhido ao navegar entre páginas.
3. **Given** usuário em uma seção, **When** olha o menu lateral, **Then** o item da seção atual aparece visualmente destacado (estado ativo).
4. **Given** usuário em tela pequena (mobile/tablet), **When** a aplicação carrega, **Then** o menu lateral se adapta (recolhido/overlay) sem quebrar o layout.

---

### User Story 3 - Logout e encerramento de sessão (Priority: P2)

Um usuário autenticado clica em "Sair" no header. Sua sessão é encerrada tanto na aplicação quanto no provedor de identidade, e ele é levado de volta ao fluxo de login.

**Why this priority**: Encerrar sessão é requisito de segurança básico de uma aplicação financeira; complementa o login.

**Independent Test**: Autenticar, clicar em sair, verificar que a sessão foi invalidada e que um novo acesso exige login novamente.

**Acceptance Scenarios**:

1. **Given** usuário autenticado, **When** clica em "Sair", **Then** a sessão é encerrada na aplicação e no provedor de identidade.
2. **Given** usuário que acabou de sair, **When** tenta acessar uma rota protegida, **Then** é redirecionado ao login novamente.

---

### User Story 4 - Proteção e validação no backend (Priority: P1)

Toda requisição do frontend ao backend carrega a credencial de sessão do usuário. O backend valida essa credencial (assinatura, expiração, emissor, audiência) antes de processar qualquer operação. Requisições sem credencial válida são rejeitadas com erro de não autorizado. A identidade do usuário usada nas operações vem exclusivamente da credencial verificada, nunca de dados enviados pelo cliente.

**Why this priority**: Validação apenas no frontend não é segurança. Em plataforma financeira, o backend é a última linha de defesa e deve rejeitar qualquer acesso não autenticado.

**Independent Test**: Chamar endpoints do backend sem credencial, com credencial expirada e com credencial adulterada — todos devem ser rejeitados. Chamar com credencial válida — deve ser aceito e a identidade extraída corretamente.

**Acceptance Scenarios**:

1. **Given** requisição sem credencial de autenticação, **When** chega ao backend, **Then** é rejeitada com status de não autorizado.
2. **Given** requisição com credencial expirada ou inválida (assinatura, emissor ou audiência incorretos), **When** chega ao backend, **Then** é rejeitada com status de não autorizado.
3. **Given** requisição com credencial válida, **When** chega ao backend, **Then** é processada e a identidade do usuário é derivada exclusivamente da credencial verificada.
4. **Given** credencial do usuário expira durante o uso, **When** o frontend detecta a expiração, **Then** renova a sessão silenciosamente ou redireciona ao login sem perda abrupta de contexto.

---

### Edge Cases

- Usuário com sessão expirada no meio da navegação: aplicação tenta renovação silenciosa; se falhar, redireciona ao login preservando a rota atual.
- Provedor de identidade indisponível: aplicação exibe mensagem de erro amigável em vez de tela quebrada ou loop de redirecionamento.
- Retorno do provedor com parâmetros inválidos/adulterados (callback manipulado): aplicação rejeita e reinicia o fluxo de login.
- Usuário abre múltiplas abas: login/logout em uma aba reflete nas demais (sem estados inconsistentes de sessão).
- Loop de redirecionamento (login → app → login): fluxo deve detectar e interromper com mensagem de erro após tentativas falhas.
- Acesso direto a URL de callback sem fluxo iniciado: aplicação trata graciosamente e redireciona ao início do login.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema MUST redirecionar automaticamente usuários não autenticados para a página de login do provedor de identidade (Keycloak) ao acessarem qualquer rota protegida.
- **FR-002**: Sistema MUST retornar o usuário à aplicação após login bem-sucedido, restaurando a rota originalmente solicitada quando houver.
- **FR-003**: Sistema MUST exibir, após o login, a estrutura base da aplicação: menu lateral de navegação e header.
- **FR-004**: Menu lateral MUST listar as áreas principais da plataforma (Visão Geral, Contas, Transações, Cartões, Orçamentos, Metas) com indicação visual do item ativo.
- **FR-005**: Menu lateral MUST poder ser recolhido/expandido pelo usuário, com estado preservado durante a navegação na sessão.
- **FR-006**: Header MUST exibir a identificação do usuário autenticado (nome e/ou e-mail) e uma ação de logout.
- **FR-007**: Logout MUST encerrar a sessão na aplicação e no provedor de identidade, retornando o usuário ao fluxo de login.
- **FR-008**: Backend MUST validar a credencial de autenticação de toda requisição (assinatura, expiração, emissor, audiência) antes de processá-la.
- **FR-009**: Backend MUST rejeitar com status de não autorizado toda requisição sem credencial válida.
- **FR-010**: Backend MUST derivar a identidade do usuário exclusivamente da credencial verificada, nunca de campos enviados pelo cliente.
- **FR-011**: Sistema MUST renovar a sessão silenciosamente enquanto o usuário estiver ativo; se a renovação falhar, MUST redirecionar ao login.
- **FR-016**: Sessão MUST expirar após 30 minutos de inatividade do usuário; ao expirar, próximo acesso a rota protegida exige novo login.
- **FR-017**: Tokens do provedor de identidade MUST permanecer exclusivamente no lado servidor (camada de agregação/BFF); o navegador MUST receber apenas cookie de sessão httpOnly, nunca tokens acessíveis a scripts.
- **FR-012**: Frontend MUST validar e rejeitar parâmetros de retorno (callback) inválidos ou adulterados, reiniciando o fluxo de login.
- **FR-013**: Sistema MUST exibir mensagem de erro amigável quando o provedor de identidade estiver indisponível, sem entrar em loop de redirecionamento.
- **FR-014**: Layout base (menu lateral + header) MUST se adaptar a telas pequenas (responsivo) sem perda de acesso à navegação.
- **FR-015**: Rotas protegidas MUST ser inacessíveis a usuários não autenticados tanto pela navegação quanto por acesso direto via URL.

### Key Entities

- **Usuário Autenticado**: pessoa identificada pelo provedor de identidade; atributos relevantes: identificador único, nome, e-mail. A identidade é sempre derivada da credencial verificada.
- **Sessão**: estado de autenticação do usuário na aplicação, mantida no lado servidor e referenciada no navegador apenas por cookie httpOnly; renovada silenciosamente enquanto o usuário está ativo; expira após 30 minutos de inatividade; encerrada explicitamente via logout ou implicitamente por expiração.
- **Item de Navegação**: entrada do menu lateral; atributos: rótulo, destino, estado ativo, ícone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das rotas protegidas redirecionam usuários não autenticados ao login (verificável por acesso direto a cada rota sem sessão).
- **SC-002**: Usuário com credenciais válidas completa o ciclo acesso → login → retorno à aplicação em menos de 30 segundos.
- **SC-003**: 100% das requisições ao backend sem credencial válida (ausente, expirada ou adulterada) são rejeitadas como não autorizadas.
- **SC-004**: Após login, o usuário vê menu lateral e header com sua identificação em 100% dos carregamentos bem-sucedidos.
- **SC-005**: Logout invalida a sessão em 100% dos casos: qualquer acesso subsequente a rota protegida exige novo login.
- **SC-006**: Nenhum loop infinito de redirecionamento ocorre em cenários de falha do provedor (verificável por teste de indisponibilidade simulada).
- **SC-007**: A estrutura base (menu + header) permanece utilizável em larguras de tela a partir de 360px.
- **SC-008**: Nenhum token do provedor de identidade é acessível via scripts no navegador (verificável por inspeção de storage/cookies: apenas cookie de sessão httpOnly presente).
- **SC-009**: Sessão inativa por mais de 30 minutos exige novo login em 100% dos casos; usuário ativo não é interrompido por expiração.

## Assumptions

- O provedor de identidade Keycloak já está disponível no ambiente de desenvolvimento (via docker compose existente no projeto) com realm e client a serem configurados nesta feature.
- O fluxo de autenticação segue OAuth2/OIDC Authorization Code conduzido pela camada de agregação (BFF) como confidential client; o navegador nunca manipula tokens diretamente.
- Auto-registro de usuários (sign-up) fica a cargo do próprio provedor de identidade; a aplicação não implementa tela própria de cadastro nesta feature.
- Os itens do menu lateral (Contas, Transações, Cartões, Orçamentos, Metas) são placeholders de navegação nesta feature; as telas de destino podem ser páginas vazias/em construção.
- Escopo limitado à aplicação web do usuário final (`apps/web`); o app admin e mobile ficam fora desta feature.
- Perfis/roles de autorização granular (além de "autenticado") ficam fora do escopo desta feature.
- Idioma da interface: português (BR), consistente com o domínio financeiro BRL do projeto.

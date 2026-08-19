# Feature Specification: Relatório de Previsão de Despesas

**Feature Branch**: `005-expense-forecast-report`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "crie um relatorio de previsao de despesas cada colna eh o mes (a partir do mes atual selecionado no global filter), e mostre todos os parcelamentos com o total no final da tabela, mostre tbm as despesas fixas | descricao | mes 1 | mes 2 | mes 3 | mes 4 | ... | carro (36x) | tv (2x) | celular (3x) | aluguel (fixa) | total | ... adicione um filtro para selecionar o maximo de meses pra frente que deve mostrar, deve ser 1,3,6,12,24,36"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar previsão de despesas por mês (Priority: P1)

Como usuário autenticado, quero ver uma tabela onde cada linha é um compromisso financeiro recorrente (um parcelamento em andamento ou uma despesa fixa) e cada coluna é um mês futuro, para entender quanto já está comprometido do meu orçamento nos próximos meses.

**Why this priority**: É o núcleo do relatório — sem a tabela mês-a-mês, o relatório não existe. Sozinha já entrega o valor central pedido.

**Independent Test**: Com parcelamentos e despesas fixas já cadastrados, abrir o relatório e verificar que cada linha mostra a descrição do compromisso e o valor devido em cada coluna de mês, com "-" nos meses em que aquele compromisso não se aplica mais.

**Acceptance Scenarios**:

1. **Given** o usuário tem uma transação de recorrência `installment` com 36 parcelas em andamento, **When** abre o relatório, **Then** vê uma linha com a descrição do compromisso e a contagem de parcelas (ex.: "carro (36x)"), com o valor da parcela preenchido em cada mês dentro do intervalo restante de parcelas.
2. **Given** um parcelamento com 2 parcelas restantes a partir do mês corrente, **When** o relatório exibe mais de 2 colunas de mês, **Then** as colunas além da 2ª mostram "-" para essa linha (o compromisso já terminou).
3. **Given** o usuário tem uma transação de recorrência `fixed` (ex.: aluguel) sem data de término, **When** abre o relatório, **Then** vê uma linha para essa despesa fixa com o mesmo valor preenchido em todas as colunas de mês exibidas.
4. **Given** uma despesa fixa com data de término (`endDate`) dentro do intervalo exibido, **When** o mês da coluna é posterior ao término, **Then** essa coluna mostra "-" para a linha correspondente.
5. **Given** múltiplas linhas exibidas, **When** o relatório é renderizado, **Then** existe uma linha de total ao final da tabela somando, por coluna de mês, todos os valores não vazios daquela coluna.
6. **Given** usuário A e usuário B, **When** cada um abre o relatório, **Then** cada um vê apenas os próprios compromissos (parcelamentos e despesas fixas), nunca os do outro.

---

### User Story 2 - Selecionar o horizonte de meses (Priority: P2)

Como usuário, quero escolher quantos meses à frente o relatório deve projetar (1, 3, 6, 12, 24 ou 36 meses), para ajustar a visão entre um planejamento de curto e de longo prazo.

**Why this priority**: Complementa a User Story 1 controlando sua abrangência; sem ela o relatório ainda funciona, só que com um horizonte fixo.

**Independent Test**: Abrir o relatório, trocar o filtro de horizonte entre as opções disponíveis e verificar que o número de colunas de mês exibidas muda de acordo, mantendo o primeiro mês igual ao mês corrente do filtro global.

**Acceptance Scenarios**:

1. **Given** o relatório aberto, **When** o usuário abre o filtro de horizonte, **Then** vê exatamente as opções 1, 3, 6, 12, 24 e 36 meses.
2. **Given** o usuário seleciona um horizonte de "3" meses, **When** a tabela é atualizada, **Then** ela exibe exatamente 3 colunas de mês, começando no mês atualmente selecionado no filtro global de período.
3. **Given** o usuário já selecionou um horizonte nesta sessão, **When** ele navega para outra tela e volta ao relatório, **Then** o horizonte escolhido permanece selecionado (não volta ao padrão).
4. **Given** o filtro global de período muda para outro mês, **When** o usuário está no relatório, **Then** o mês 1 da tabela passa a ser o novo mês selecionado globalmente, mantendo o mesmo horizonte de meses já escolhido.

---

### Edge Cases

- O que acontece quando o usuário não tem nenhum parcelamento nem despesa fixa cadastrados? O relatório deve mostrar um estado vazio claro, sem tabela ou com tabela contendo só a linha de total zerada.
- Como o sistema trata um parcelamento cujo início é depois do mês 1 exibido (compromisso ainda não começou)? As colunas anteriores ao início mostram "-"; as colunas a partir do início mostram o valor da parcela.
- Como o sistema trata despesas fixas ou parcelamentos com valores diferentes entre ocorrências (ex.: parcela reajustada)? O valor exibido em cada coluna deve refletir o valor da ocorrência real daquele mês, não um valor fixo assumido para todas as colunas.
- Como o relatório se comporta se o horizonte selecionado (ex.: 36 meses) ultrapassa a última ocorrência de todos os compromissos? As colunas restantes mostram "-" e a linha de total dessas colunas fica zerada, sem erro.
- Transações de recorrência `single` (avulsas, não parceladas e não fixas) não representam compromisso futuro recorrente e não entram nas linhas do relatório.
- Receitas (`type = receita`) não entram no relatório, que é restrito a despesas (`type = despesa`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um relatório tabular em que cada coluna representa um mês, começando pelo mês atualmente selecionado no filtro global de período (mês 1) e avançando sequencialmente.
- **FR-002**: O sistema DEVE incluir, como linhas do relatório, todos os parcelamentos (`recurrence = installment`) em aberto do usuário autenticado, cada um representado por uma única linha (agrupada pelo identificador de grupo do parcelamento) com sua descrição e a contagem total de parcelas (ex.: "carro (36x)").
- **FR-003**: O sistema DEVE incluir, como linhas do relatório, todas as despesas fixas (`recurrence = fixed`) do usuário autenticado, cada uma representada por uma única linha com sua descrição (ex.: "aluguel (fixa)").
- **FR-004**: Para cada linha e cada coluna de mês, o sistema DEVE exibir o valor devido daquele compromisso naquele mês quando ele se aplica, ou um indicador de ausência (ex.: "-") quando o compromisso não se aplica àquele mês (parcelamento já concluído, despesa fixa encerrada, ou compromisso ainda não iniciado).
- **FR-005**: O sistema DEVE exibir uma linha de total ao final da tabela, somando por coluna todos os valores aplicáveis (não vazios) daquele mês.
- **FR-006**: O sistema DEVE fornecer um filtro de horizonte de meses com exatamente as opções 1, 3, 6, 12, 24 e 36, controlando quantas colunas de mês são exibidas.
- **FR-007**: O sistema DEVE, ao alterar o filtro de horizonte, atualizar o número de colunas exibidas mantendo o mês 1 inalterado.
- **FR-008**: O sistema DEVE, ao mudar o mês selecionado no filtro global de período, recalcular o mês 1 do relatório e as colunas subsequentes de acordo, preservando o horizonte de meses já escolhido.
- **FR-009**: O sistema DEVE restringir os compromissos exibidos ao usuário autenticado (dono da transação), sem expor compromissos de outros usuários.
- **FR-010**: O sistema DEVE restringir as linhas do relatório a transações do tipo despesa (`type = despesa`); receitas não devem aparecer.
- **FR-011**: O sistema DEVE exibir um estado vazio claro quando o usuário não possui nenhum parcelamento em aberto nem despesa fixa cadastrada.
- **FR-012**: O sistema DEVE formatar todos os valores monetários no padrão monetário brasileiro (ex.: "1.000,00").

### Key Entities *(include if feature involves data)*

- **Linha de Previsão (derivada)**: Visão computada, não persistida, que representa um compromisso recorrente do usuário — um grupo de parcelas (`groupId` de transações `installment`) ou uma despesa fixa (`fixed`) — com descrição, contagem de parcelas quando aplicável, e o valor projetado para cada mês do horizonte. Deriva-se inteiramente das transações já existentes (nenhuma nova entidade persistida é introduzida).
- **Horizonte de Meses**: Preferência de exibição (1, 3, 6, 12, 24 ou 36) que determina quantas colunas de mês o relatório mostra a partir do mês corrente do filtro global.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário com parcelamentos e despesas fixas cadastrados consegue visualizar o total comprometido dos próximos 3 meses em menos de 10 segundos após abrir o relatório.
- **SC-002**: Trocar o horizonte de meses atualiza a tabela exibida sem exigir recarregar a página ou navegar para outra tela.
- **SC-003**: 100% dos valores mensais exibidos na linha de total correspondem exatamente à soma dos valores não vazios daquela coluna, verificável por conferência manual.
- **SC-004**: Um usuário sem nenhum compromisso recorrente cadastrado entende, em até 5 segundos de visualização, que não há dados a mostrar (estado vazio claro, não uma tabela em branco ambígua).

## Assumptions

- O relatório é restrito a despesas (`type = despesa`); receitas não fazem parte deste relatório.
- Apenas transações com `recurrence = installment` (parcelamentos) e `recurrence = fixed` (despesas fixas) compõem as linhas; transações `single` (avulsas) são projeções pontuais e não representam compromisso recorrente, portanto ficam fora do relatório.
- O relatório projeta compromissos independentemente do `status` (pendente ou pago) de cada ocorrência — o objetivo é mostrar o valor contratado/comprometido por mês, não apenas o que ainda falta pagar.
- "Mês atual selecionado no filtro global" reaproveita o filtro de período global já existente na aplicação; o relatório não introduz um seletor de mês próprio além do horizonte.
- O horizonte de meses selecionado é uma preferência de exibição da sessão do usuário (não precisa ser persistido entre sessões, a menos que uma decisão futura de produto exija isso).
- Parcelamentos e despesas fixas pertencem sempre a um único usuário dono; o relatório não cobre cadastros compartilhados/multiusuário.
- O valor de cada célula reflete o valor real daquela ocorrência (parcela ou instância mensal), permitindo variações entre meses quando o valor da transação de origem variar.

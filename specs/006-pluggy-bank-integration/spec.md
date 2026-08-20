# Feature Specification: Pluggy Bank Integration

**Feature Branch**: `006-pluggy-bank-integration`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "quero que crie um novo microservico, onde ele vai integrar com o Pluggy, https://docs.pluggy.ai/ ele deve permitir eu integrar com meus bancos, para ler informações de cartao de credito e conta (transacoes dos dois)"

## Clarifications

### Session 2026-08-19

- Q: When a user disconnects a bank/card connection, what happens to its already-synced accounts/cards/transactions? → A: Keep as read-only history — the connection is marked disconnected but previously-synced data remains visible, just frozen (no further syncing).
- Q: Should Pluggy-synced transactions merge into the app's existing manually-entered transaction list, or stay in a separate "connected banks" view? → A: Merge into the existing list, tagged by source so manual and synced entries stay distinguishable.
- Q: What security/retention posture should the Banking Integration MS apply to the synced-transaction history it stores? → A: Standard baseline (encrypt at rest via the environment's existing standard protection, no additional encryption layer; access restricted to the owning user), kept as the sync/reconciliation history with an explicit status per transaction (pending, processing, success, error) to support reconciliation and retry — no separate purge/retention-limit requirement beyond what's needed for that reconciliation.
- Q: What happens when a transaction's import into the Transactions MS keeps failing after retries are exhausted? → A: Reuse the existing "needs attention" connection status — the Bank Connection is flipped to "needs attention" so the user sees and can act on it, same signal already used for broken credentials/re-auth (US5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect a bank or credit card issuer (Priority: P1)

A user wants to link one of their financial institutions (bank or credit card issuer) to the app so its data can start flowing in, without having to hand their banking password to the app itself.

**Why this priority**: Nothing else in this feature works until a connection exists. This is the entry point and the minimum viable slice.

**Independent Test**: Can be fully tested by starting a new connection, completing the institution's consent/login flow through Pluggy, and confirming the institution now shows up as "connected" with a status the user can see.

**Acceptance Scenarios**:

1. **Given** the user has no connected institutions, **When** they choose to connect a bank and complete the consent flow successfully, **Then** the institution appears in their list of connections with an "active" status.
2. **Given** the user is mid-connection and enters invalid credentials, **When** the institution rejects them, **Then** the user sees a clear error and can retry without the app crashing or creating a partial/broken connection.
3. **Given** the user already has an active connection to a given institution with the same credentials, **When** they attempt to connect it again, **Then** the app tells them the institution is already connected instead of creating a duplicate.

---

### User Story 2 - View synced bank account transactions (Priority: P1)

A user wants to see the transaction history of their checking/savings accounts from a connected bank, without manually entering each one.

**Why this priority**: Reading account transactions is one of the two explicit data types the user asked for, and delivers value the moment a single account is connected.

**Independent Test**: Can be fully tested by connecting one bank account and confirming its recent transactions (description, date, amount, debit/credit) appear in the app, matching what the bank itself shows.

**Acceptance Scenarios**:

1. **Given** a newly connected bank account, **When** the initial sync completes, **Then** the account's available transaction history is retrieved and stored.
2. **Given** an already-connected bank account, **When** new transactions occur at the institution, **Then** those transactions appear in the app after the next sync without duplicating previously synced ones.
3. **Given** a connected account with multiple sub-accounts (e.g., checking and savings) at the same institution, **When** the user views synced data, **Then** transactions are attributed to the correct account.

---

### User Story 3 - View synced credit card transactions (Priority: P1)

A user wants to see the transaction history of their credit cards from a connected issuer, including installment purchases, without manually entering each one.

**Why this priority**: Reading credit card transactions is the other explicit data type the user asked for, and is equally core to the feature's value.

**Independent Test**: Can be fully tested by connecting a credit card and confirming its recent transactions (including installment details where applicable) appear in the app, matching the card issuer's own statement.

**Acceptance Scenarios**:

1. **Given** a newly connected credit card, **When** the initial sync completes, **Then** the card's available transaction history is retrieved and stored, including installment purchase details (installment number and total installments) where the institution provides them.
2. **Given** a connected credit card, **When** the user views its transactions, **Then** each transaction reflects whether it increases or reduces the card's balance, consistent with the issuer's statement.
3. **Given** a connected credit card with a pending (not-yet-posted) transaction, **When** that transaction later posts at the institution, **Then** the app's record is updated to reflect the posted state rather than showing a duplicate.

---

### User Story 4 - Stay in sync automatically (Priority: P2)

A user wants their connected banks and cards to refresh on their own, and wants a manual "refresh now" option for when they don't want to wait.

**Why this priority**: Automatic freshness is what makes the feature useful on an ongoing basis rather than a one-time import, but the app is still useful without it (via manual refresh) so it's not required for an MVP.

**Independent Test**: Can be fully tested by leaving a connection idle and confirming its data refreshes on its own within the defined window, and separately by triggering a manual refresh and confirming new data appears promptly.

**Acceptance Scenarios**:

1. **Given** an active connection, **When** the automatic sync window elapses, **Then** the app requests updated data from Pluggy without any user action.
2. **Given** an active connection, **When** the user manually requests a refresh, **Then** the app fetches the latest data on demand and reflects any changes.

---

### User Story 5 - Recover from a broken connection (Priority: P3)

A user wants to know, and be able to fix it, when a connection stops working (expired credentials, required re-authentication, institution-side error).

**Why this priority**: Important for long-term reliability and trust, but the core read-transactions value already exists without this; a broken connection degrades gracefully (stale data) rather than blocking the rest of the feature.

**Independent Test**: Can be fully tested by forcing a connection into a broken/needs-attention state and confirming the user is shown that state and can act on it (e.g., re-authenticate) directly in the app.

**Acceptance Scenarios**:

1. **Given** a connection whose credentials have expired or require re-authentication, **When** a sync attempt fails for that reason, **Then** the connection's status changes to "needs attention" and the user is informed.
2. **Given** a connection in "needs attention" status, **When** the user completes the re-authentication flow, **Then** the connection returns to "active" and syncing resumes.

---

### Edge Cases

- What happens when the user has no internet-banking access or the institution is temporarily down during initial connection? The connection attempt should fail clearly, without leaving a half-created connection behind.
- How does the system handle an institution that requires multi-factor authentication mid-connection or mid-sync? The user must be prompted to provide the additional factor rather than the sync silently failing.
- What happens when a transaction's amount, date, or description changes at the source after it was already synced (a correction from the institution)? The stored transaction must be updated to match, not duplicated.
- What happens when the same transaction's identity changes so much that it can no longer be matched to the previously synced record? The old record is treated as removed and a new one is added, rather than both existing side by side.
- What happens when a user disconnects an institution that still has synced transactions in the app? Its data stays visible as frozen, read-only history; it stops receiving new syncs.
- What happens when a connected institution offers products the user didn't ask for (e.g., investments, loans)? Only account and credit card data are in scope; other product types are not collected.
- What happens when a single connection covers multiple accounts and/or multiple cards? Each must be tracked and displayed as its own entity under that connection.
- What happens when a synced transaction's import into the Transactions microservice keeps failing after retries are exhausted? The transaction's synchronization status remains "error" and its Bank Connection is flipped to "needs attention," giving the user the same visibility and recovery path as a broken/expired connection (US5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user initiate connecting a financial institution through a guided consent flow (provided by Pluggy) without the app itself ever seeing or storing the user's bank credentials.
- **FR-002**: System MUST support connecting Brazilian financial institutions available through Pluggy.
- **FR-003**: System MUST record each successful connection with an identifying reference, the institution it belongs to, and a status (e.g., active, needs attention, error).
- **FR-004**: System MUST prevent creating a duplicate connection for an institution the user already has an active connection to with the same credentials.
- **FR-005**: System MUST retrieve and store bank account details (type, balance, currency) for every account exposed by a connection.
- **FR-006**: System MUST retrieve and store credit card details (limit, current balance, closing date, due date, brand) for every card exposed by a connection.
- **FR-007**: System MUST retrieve and store transaction history for every connected bank account, covering at least the range the institution/Pluggy makes available at connection time.
- **FR-008**: System MUST retrieve and store transaction history for every connected credit card, including installment metadata (installment number, total installments) when the institution provides it.
- **FR-009**: System MUST distinguish, for every synced transaction, whether it increases or decreases the balance of the account/card it belongs to, and whether it is pending or posted.
- **FR-010**: System MUST refresh connected institutions' data automatically on a recurring basis without requiring the user to act, and MUST also let the user trigger an on-demand refresh.
- **FR-011**: System MUST reconcile updates from the source: when a previously synced transaction changes at the institution, the stored copy is updated; when a transaction is removed at the source, the stored copy is removed; new transactions are added without duplicating existing ones.
- **FR-012**: System MUST detect when a connection can no longer sync (expired credentials, required re-authentication, institution error, or a synced transaction whose import into the Transactions microservice keeps failing after retries are exhausted) and change its status to reflect that it needs attention.
- **FR-013**: System MUST let the user complete a re-authentication flow for a connection that needs attention, returning it to an active state on success.
- **FR-014**: System MUST let the user remove a previously created connection. On removal, the connection is marked disconnected and stops syncing, but its already-synced accounts, cards, and transactions MUST remain visible as read-only history rather than being deleted.
- **FR-015**: System MUST associate every connection, account, credit card, and transaction with the single user who created it, and MUST NOT expose one user's connected-institution data to any other user.
- **FR-016**: System MUST merge synced account and credit card transactions into the same transaction list already used by the platform's existing dashboard and transactions views, tagging each transaction with its source (manually entered vs. synced from a connection) so the two remain distinguishable and are not double-counted.
- **FR-017**: System MUST support the user having multiple institutions connected at once, and multiple accounts and/or cards under a single connection.

### Key Entities *(include if feature involves data)*

- **Bank Connection**: Represents one consent-based link between the user and a specific financial institution. Key attributes: owning user, institution name, status (active / needs attention / error), created date, last successful sync time.
- **Linked Account**: A checking or savings account exposed by a Bank Connection. Key attributes: account type/subtype, display name, current balance, currency. Belongs to exactly one Bank Connection.
- **Linked Credit Card**: A credit card exposed by a Bank Connection. Key attributes: brand, last digits, credit limit, available limit, current balance, closing date, due date. Belongs to exactly one Bank Connection.
- **Synced Transaction**: A single movement on a Linked Account or Linked Credit Card. Key attributes: description, amount, date, direction (increases/decreases balance), status (pending/posted), and, for credit card transactions, installment number and total installments when available. Belongs to exactly one Linked Account or Linked Credit Card.

## Architecture and Service Boundaries

The new banking integration microservice is responsible exclusively for
communicating with Pluggy and maintaining the synchronization state and
historical record of data retrieved from Pluggy.

The integration microservice MUST NOT become the source of truth for
financial transactions used by the application.

All transactions discovered through Pluggy MUST be imported into the
existing Transactions microservice, which remains the source of truth for
application transactions.

The integration microservice MUST maintain its own historical record of
synced transactions independently from the Transactions microservice.

The synchronization flow MUST follow:

```
Pluggy
  -> Banking Integration MS
  -> Persist synced transaction/history
  -> Transactions MS
  -> Persist application transaction
```

The Banking Integration MS MUST persist the transaction received from Pluggy
before attempting to send/import it into the Transactions microservice.

Each synchronized transaction MUST have a synchronization status — pending,
processing, success, or error — that allows the integration service to track
where it stands in the import pipeline and to support reconciliation.

The integration service MUST be able to retry imports left in an error status
without creating duplicate transactions in the Transactions microservice. If
retries are exhausted and a transaction remains in error status, the owning
Bank Connection MUST be flagged "needs attention" (per FR-012) so the user
can see and act on it.

The Banking Integration MS's synced-transaction history (including each
transaction's synchronization status) MUST be retained as the durable
sync/reconciliation record — it is not a temporary buffer to be purged once a
transaction is successfully imported. Access to this history MUST remain
restricted to its owning user, consistent with the rest of the connection's
data (see FR-015). No encryption beyond the environment's standard
at-rest protection is required.

The Transactions microservice remains responsible for the final transaction
entity, categorization, editing, deletion, and presentation of transactions
within the application.

The Pluggy integration service MUST NOT directly write to the Transactions
microservice database. Communication MUST happen through the Transactions
microservice API or an explicitly defined messaging interface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from "no connection" to "seeing that institution's transactions in the app" in a single guided flow, in under 10 minutes for an account with up to 12 months of history.
- **SC-002**: After each sync, 100% of the transactions the institution reports for a connected account or card are represented in the app exactly once each (no missing and no duplicated transactions).
- **SC-003**: A connected institution's data refreshes automatically at least once per day without any user action.
- **SC-004**: When a connection needs attention, the user can identify which institution is affected and resolve it (or start resolving it) without needing to contact support.
- **SC-005**: A user can connect at least 5 institutions at once without any degradation in how quickly any single institution's transactions load.
- **SC-006**: Zero instances of one user seeing another user's connected-institution data.

## Assumptions

- This is a new, standalone microservice, separate from the existing `apps/web` frontend and its current backend-for-frontend, that owns the Pluggy integration and the data it produces.
- Pluggy performs the actual institution authentication/consent flow (e.g., via its Connect widget) and never exposes raw bank credentials to this system; the system only receives the resulting connection reference and the data products (accounts, cards, transactions).
- Only Brazilian financial institutions available through Pluggy's connectors are in scope, matching the rest of the app's current market.
- Only the "account" and "credit card" data products (and their transactions) are in scope; other Pluggy products (e.g., investments, loans, payroll data) are out of scope for this feature.
- Each connection belongs to exactly one app user; there is no shared/household connection in this feature's scope.
- The app already has a user identity/authentication system (per the existing app-shell login) that this feature reuses to attribute connections and data to the correct user.
- "Automatic" refresh means at least daily, matching Pluggy's own standard auto-sync cadence; near-real-time (webhook-driven, sub-hour) updates are not required for this feature.

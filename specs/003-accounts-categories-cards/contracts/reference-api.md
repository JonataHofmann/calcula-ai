# Contract — Reference Catalogs (BFF)

Catálogos estáticos internos curados, servidos pelo BFF a partir de `@finance/contracts/src/reference`. Somente leitura. Requer sessão autenticada (cookie httpOnly). Respostas cacheáveis (imutáveis por versão de app).

Base: BFF público. Todas as chamadas web usam `credentials: 'include'`.

## GET /reference/banks
Retorna o catálogo de bancos para o seletor de banco.

**200**
```json
{ "banks": [ { "id": "nubank", "name": "Nubank", "color": "#820AD1", "logo": "nubank" } ] }
```

## GET /reference/brands
Bandeiras de cartão.

**200**
```json
{ "brands": [ { "id": "visa", "name": "Visa", "color": "#1A1F71", "logo": "visa" } ] }
```

## GET /reference/icons
Chaves de ícone curadas (mapeadas a `lucide-react`) para o seletor de ícones.

**200**
```json
{ "icons": [ { "key": "wallet", "group": "finance" }, { "key": "piggy-bank", "group": "finance" } ] }
```

## GET /reference/colors
Paleta curada (tokens do design system) para o seletor de cor.

**200**
```json
{ "colors": [ { "token": "primary", "hex": "#2D60FF" }, { "token": "emerald", "hex": "#16A34A" } ] }
```

**Schemas** (`@finance/contracts`): `bankSchema`, `brandSchema`, `iconOptionSchema` (`iconKeySchema`), `colorOptionSchema` (`colorTokenSchema`). Os cadastros validam `bankId`/`brandId`/`icon`/`color` contra esses catálogos.

**Erros**: `401` sem sessão.

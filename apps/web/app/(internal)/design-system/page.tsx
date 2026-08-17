import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  CreditCardVisual,
  formatBRL,
  Input,
  MetricCard,
  SearchField,
  Select,
  Separator,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TransactionList,
} from '@finance/ui';
import { ThemeToggle } from '../../../components/theme-toggle';
import { metricSamples, selectOptions, tableSamples, transactionSamples } from './demo-data';

const colorTokens = [
  'background',
  'surface',
  'surface-strong',
  'primary',
  'accent',
  'text',
  'text-muted',
  'border',
  'success',
  'danger',
  'warning',
  'info',
] as const;

const radiusTokens = ['sm', 'md', 'lg', 'xl'] as const;
const shadowTokens = ['sm', 'md', 'lg'] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Design System</h1>
          <p className="text-text-muted text-sm">
            Tokens e componentes do @finance/ui — referência viva
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Tokens">
        <h3 className="text-text-muted text-sm font-medium">Cores</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {colorTokens.map((token) => (
            <div key={token} className="border-border flex items-center gap-2 rounded-md border p-2">
              <span
                className="border-border h-8 w-8 shrink-0 rounded-md border"
                style={{ backgroundColor: `var(--color-${token})` }}
              />
              <code className="text-xs break-all">--color-{token}</code>
            </div>
          ))}
        </div>
        <h3 className="text-text-muted text-sm font-medium">Tipografia</h3>
        <div className="flex flex-col gap-1">
          <p className="text-xs">text-xs — Corpo auxiliar 12px</p>
          <p className="text-sm">text-sm — Corpo 14px</p>
          <p className="text-base">text-base — Base 16px</p>
          <p className="text-lg">text-lg — Destaque 20px</p>
          <p className="text-2xl">text-2xl — Métricas 32px</p>
        </div>
        <h3 className="text-text-muted text-sm font-medium">Raios</h3>
        <div className="flex flex-wrap gap-4">
          {radiusTokens.map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <span
                className="bg-primary/20 border-border h-12 w-12 border"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <code className="text-xs">--radius-{r}</code>
            </div>
          ))}
        </div>
        <h3 className="text-text-muted text-sm font-medium">Sombras</h3>
        <div className="flex flex-wrap gap-6">
          {shadowTokens.map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <span
                className="bg-surface h-14 w-20 rounded-md"
                style={{ boxShadow: `var(--shadow-${s})` }}
              />
              <code className="text-xs">--shadow-{s}</code>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Separator />

      <Section title="Formulários">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Input label="Nome" placeholder="Seu nome" helpText="Como no documento" />
          <Input label="E-mail" placeholder="voce@exemplo.com" error="E-mail inválido" />
          <Input label="Desabilitado" placeholder="Sem edição" disabled />
          <Select label="Conta" options={selectOptions} placeholder="Selecione uma conta" />
          <Select
            label="Conta com erro"
            options={selectOptions}
            placeholder="Selecione"
            error="Campo obrigatório"
          />
          <SearchField placeholder="Buscar transações…" aria-label="Buscar transações" />
        </div>
      </Section>

      <Separator />

      <Section title="Conteúdo">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="success">Receita</Badge>
          <Badge variant="warning">Pendente</Badge>
          <Badge variant="danger">Despesa</Badge>
          <Badge variant="info">Informação</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar alt="Maria Silva" name="Maria Silva" size="sm" />
          <Avatar alt="Maria Silva" name="Maria Silva" />
          <Avatar alt="Maria Silva" name="Maria Silva" size="lg" />
          <Avatar alt="Sem nome" />
        </div>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Card de exemplo</CardTitle>
          </CardHeader>
          <CardContent className="text-text-muted text-sm">
            Superfície com borda e sombra via tokens.
          </CardContent>
        </Card>
      </Section>

      <Separator />

      <Section title="Dados">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableSamples.map((row) => (
              <TableRow key={row.receiver}>
                <TableCell>{row.receiver}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{formatBRL(row.amount.replace('-', ''))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <h3 className="text-text-muted text-sm font-medium">Tabela vazia</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recebedor</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty colSpan={2} />
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex w-48 flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Spinner size="sm" />
          <Spinner />
          <Spinner size="lg" />
        </div>
      </Section>

      <Separator />

      <Section title="Financeiro">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricSamples.map((metric, index) => (
            <MetricCard key={metric.title} {...metric} tone={index === 0 ? 'strong' : 'default'} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de transações</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionList items={transactionSamples} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sem transações</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionList items={[]} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-4">
          <CreditCardVisual
            brand="cloudcash"
            holderName="Mike Smith"
            maskedNumber="**** **** **** 5789"
            expiry="12/28"
          />
          <CreditCardVisual
            brand="Premium"
            holderName="Maria Silva"
            maskedNumber="**** **** **** 2847"
            expiry="04/27"
            tone="primary"
          />
        </div>
        <ChartContainer
          title="Estatísticas de saída"
          legend={[
            { label: 'Receita', colorToken: 'success' },
            { label: 'Despesa', colorToken: 'danger' },
            { label: 'Projeção', colorToken: 'info' },
          ]}
          actions={
            <Select
              aria-label="Período"
              options={[
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mês' },
              ]}
              defaultValue="week"
              className="h-8"
            />
          }
        >
          <div className="border-border text-text-muted flex h-40 items-center justify-center rounded-md border border-dashed text-sm">
            Slot do gráfico (injetado pelo consumidor)
          </div>
        </ChartContainer>
      </Section>
    </main>
  );
}

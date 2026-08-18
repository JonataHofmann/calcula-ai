import { Card, CreditCardVisual } from '@finance/ui';
import { CreditCard, KeyRound, Lock, Wallet, type LucideIcon } from 'lucide-react';
import { SectionHeader } from '../../../components/section-header';
import { AddCardForm } from '../../../features/cards/add-card-form';
import { cardList, walletCards, type CardListEntry } from '../../../features/cards/cards-data';

const listToneClasses: Record<CardListEntry['tone'], string> = {
  primary: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
};

const cardSettings: Array<{ icon: LucideIcon; title: string; subtitle: string; soft: string; fg: string }> = [
  { icon: Lock, title: 'Bloquear Cartão', subtitle: 'Bloqueia temporariamente o cartão', soft: 'bg-info-soft', fg: 'text-info' },
  { icon: KeyRound, title: 'Alterar PIN', subtitle: 'Defina um novo PIN de segurança', soft: 'bg-warning-soft', fg: 'text-warning' },
  { icon: Wallet, title: 'Adicionar à Carteira', subtitle: 'Adicione o cartão à carteira digital', soft: 'bg-success-soft', fg: 'text-success' },
  { icon: CreditCard, title: 'Substituir Cartão', subtitle: 'Solicite a emissão de um novo cartão', soft: 'bg-danger-soft', fg: 'text-danger' },
];

export default function CartoesPage() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader title="Meus Cartões" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {walletCards.map((card) => (
            <CreditCardVisual
              key={card.id}
              tone={card.tone}
              balance={card.balance}
              holderName={card.holderName}
              maskedNumber={card.maskedNumber}
              expiry={card.expiry}
              className="max-w-none"
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Lista de Cartões" />
          <Card className="divide-border divide-y p-2">
            {cardList.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 p-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${listToneClasses[entry.tone]}`}
                >
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="grid flex-1 gap-1 sm:grid-cols-3">
                  <div>
                    <p className="text-text-muted text-xs">Nome do Cartão</p>
                    <p className="text-text text-sm font-medium">{entry.bank}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-text-muted text-xs">Número</p>
                    <p className="text-text text-sm font-medium">{entry.maskedNumber}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-text-muted text-xs">Titular</p>
                    <p className="text-text text-sm font-medium">{entry.holderName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-primary focus-visible:ring-focus-ring rounded text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver detalhes
                </button>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <SectionHeader title="Configurações do Cartão" />
          <Card className="divide-border divide-y p-2">
            {cardSettings.map((setting) => {
              const Icon = setting.icon;
              return (
                <button
                  key={setting.title}
                  type="button"
                  className="hover:bg-background focus-visible:ring-focus-ring flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${setting.soft} ${setting.fg}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="text-text block text-sm font-medium">{setting.title}</span>
                    <span className="text-text-muted block text-xs">{setting.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </Card>
        </section>
      </div>

      <section>
        <SectionHeader title="Adicionar Novo Cartão" />
        <Card className="p-5">
          <p className="text-text-muted mb-5 text-sm">
            Preencha as informações abaixo para adicionar um novo cartão à sua conta.
          </p>
          <AddCardForm />
        </Card>
      </section>
    </div>
  );
}

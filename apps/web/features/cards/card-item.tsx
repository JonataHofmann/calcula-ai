'use client';

import { findCardBrand, type CreditCardDto } from '@finance/contracts';
import { CreditCardVisual } from '@finance/ui';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, CalendarX, Pencil, Trash2 } from 'lucide-react';

const TONES = ['dark', 'primary', 'light'] as const;

export interface CardItemProps {
  card: CreditCardDto;
  index: number;
  onEdit: (card: CreditCardDto) => void;
  onDelete: (card: CreditCardDto) => void;
}

export function CardItem({ card, index, onEdit, onDelete }: CardItemProps) {
  const reduce = useReducedMotion();
  const tone = TONES[index % TONES.length];
  const brand = findCardBrand(card.brandId);

  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="group relative w-full max-w-[20rem]"
    >
      <CreditCardVisual
        tone={tone}
        brand={brand?.name}
        brandId={card.brandId}
        holderName={card.name}
        maskedNumber={`•••• •••• •••• ${card.lastDigits}`}
        balance={card.limit}
        className="max-w-none"
      />

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(card)}
          aria-label={`Editar ${card.name}`}
          className="focus-visible:ring-focus-ring rounded-icon bg-black/25 p-2 text-white backdrop-blur transition-colors hover:bg-black/40 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(card)}
          aria-label={`Excluir ${card.name}`}
          className="focus-visible:ring-focus-ring rounded-icon bg-black/25 p-2 text-white backdrop-blur transition-colors hover:bg-danger focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="text-text-muted mt-2 flex items-center gap-4 px-1 text-xs">
        <span className="flex items-center gap-1">
          <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
          Fecha dia {card.closingDay}
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          Vence dia {card.dueDay}
        </span>
      </div>
    </motion.div>
  );
}

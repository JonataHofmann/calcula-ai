'use client';

import { Button, Input, Select } from '@finance/ui';
import { useState, type FormEvent } from 'react';
import { cardTypeOptions } from './cards-data';

export function AddCardForm() {
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Mock: nenhum backend de cartões conectado ainda.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <Select label="Tipo do Cartão" options={cardTypeOptions} defaultValue="classic" />
      <Input label="Nome no Cartão" placeholder="Ex.: Eddy Cusuma" defaultValue="" />
      <Input
        label="Número do Cartão"
        inputMode="numeric"
        placeholder="0000 0000 0000 0000"
        defaultValue=""
      />
      <Input label="Validade" placeholder="MM/AA" defaultValue="" />
      <div className="sm:col-span-2">
        <Button type="submit">{saved ? 'Cartão adicionado' : 'Adicionar Cartão'}</Button>
      </div>
    </form>
  );
}

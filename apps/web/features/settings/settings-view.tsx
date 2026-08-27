'use client';

import { useRef, useState } from 'react';
import type { BackupSnapshot, ImportMode } from '@finance/contracts';
import { backupSnapshotSchema } from '@finance/contracts';
import { Button, Card, Input, Modal } from '@finance/ui';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { useExportData, useImportData, useResetData } from './use-settings';

/** Word the user must type to arm an irreversible action (reset, or replace import). */
const CONFIRM_WORD = 'RESETAR';

export function SettingsView() {
  const reset = useResetData();
  const exportData = useExportData();
  const importData = useImportData();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Import mode modal: opened once a valid file is parsed.
  const [pending, setPending] = useState<BackupSnapshot | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [replaceTyped, setReplaceTyped] = useState('');

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;
  const replaceArmed = replaceTyped.trim().toUpperCase() === CONFIRM_WORD;
  const importArmed = mode === 'merge' || replaceArmed;

  function close() {
    setOpen(false);
    setTyped('');
    reset.reset();
  }

  async function confirm() {
    if (!armed) return;
    await reset.mutateAsync();
    setOpen(false);
    setTyped('');
  }

  async function handleExport() {
    const snapshot = await exportData.mutateAsync();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calcula-ai-backup-${snapshot.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setImportError(null);
    importData.reset();
    try {
      const parsed = backupSnapshotSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setImportError('Arquivo inválido ou de versão incompatível.');
        return;
      }
      // Não importa direto — abre o modal para escolher mesclar ou substituir.
      setPending(parsed.data);
      setMode('merge');
      setReplaceTyped('');
    } catch {
      setImportError('Não foi possível ler o arquivo.');
    }
  }

  function closeImport() {
    setPending(null);
    setReplaceTyped('');
  }

  async function confirmImport() {
    if (!pending || !importArmed) return;
    const snapshot = pending;
    const chosen = mode;
    setPending(null);
    setReplaceTyped('');
    await importData.mutateAsync({ snapshot, mode: chosen });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-text text-lg font-semibold">Configurações</h1>
        <p className="text-text-muted text-sm">Gerencie os dados da sua conta.</p>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="bg-info-soft text-info flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Download className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Exportar dados</p>
            <p className="text-text-muted text-sm">
              Baixa um arquivo JSON com todas as suas transações, contas, cartões e categorias
              personalizadas. Guarde como backup ou para migrar de conta.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleExport} loading={exportData.isPending}>
            Exportar dados
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="bg-success-soft text-success flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Importar dados</p>
            <p className="text-text-muted text-sm">
              Carrega um arquivo de backup. Ao selecionar, você escolhe entre mesclar com os dados
              atuais ou apagar tudo e importar.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0" role="status">
            {importData.isSuccess && importData.data ? (
              <p className="text-text-muted text-sm">
                Importado: {importData.data.transactions} transação(ões), {importData.data.accounts}{' '}
                conta(s), {importData.data.creditCards} cartão(ões), {importData.data.categories}{' '}
                categoria(s).
              </p>
            ) : importError || importData.isError ? (
              <p className="text-danger text-sm">
                {importError ?? 'Falha ao importar o arquivo.'}
              </p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            loading={importData.isPending}
          >
            Selecionar arquivo
          </Button>
        </div>
      </Card>

      <Card className="border-danger/40 flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="bg-danger-soft text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Resetar dados</p>
            <p className="text-text-muted text-sm">
              Apaga todas as suas transações, contas, cartões e categorias personalizadas.
              As categorias padrão do sistema e o seu login são mantidos. Esta ação não pode
              ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Resetar dados
          </Button>
        </div>
      </Card>

      {reset.isSuccess && reset.data ? (
        <p className="text-text-muted text-sm" role="status">
          Dados apagados: {reset.data.transactions} transação(ões), {reset.data.accounts}{' '}
          conta(s), {reset.data.creditCards} cartão(ões), {reset.data.categories}{' '}
          categoria(s).
        </p>
      ) : null}

      <Modal
        open={pending !== null}
        onClose={closeImport}
        title="Importar dados"
        description={
          pending
            ? `O arquivo tem ${pending.transactions.length} transação(ões), ${pending.accounts.length} conta(s), ${pending.creditCards.length} cartão(ões) e ${pending.categories.length} categoria(s).`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeImport}>
              Cancelar
            </Button>
            <Button
              variant={mode === 'replace' ? 'destructive' : 'primary'}
              disabled={!importArmed}
              loading={importData.isPending}
              onClick={confirmImport}
            >
              {mode === 'replace' ? 'Apagar tudo e importar' : 'Mesclar'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="border-border hover:bg-surface-hover flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="radio"
              name="import-mode"
              className="mt-1"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            <span>
              <span className="text-text block text-sm font-medium">Mesclar</span>
              <span className="text-text-muted block text-sm">
                Mantém os dados atuais e adiciona os do arquivo. Importar o mesmo arquivo duas vezes
                duplica os lançamentos.
              </span>
            </span>
          </label>

          <label className="border-border hover:bg-surface-hover flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="radio"
              name="import-mode"
              className="mt-1"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            <span>
              <span className="text-text block text-sm font-medium">Apagar tudo e importar</span>
              <span className="text-text-muted block text-sm">
                Apaga todas as suas transações, contas, cartões e categorias personalizadas antes de
                importar. Esta ação não pode ser desfeita.
              </span>
            </span>
          </label>

          {mode === 'replace' ? (
            <div className="flex flex-col gap-2">
              <p className="text-danger text-sm">
                Digite {CONFIRM_WORD} para confirmar que quer apagar tudo antes de importar.
              </p>
              <Input
                value={replaceTyped}
                onChange={(e) => setReplaceTyped(e.target.value)}
                placeholder={CONFIRM_WORD}
                aria-label="Confirmação"
                autoFocus
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={close}
        title="Resetar todos os dados"
        description={`Isto apaga tudo permanentemente. Digite ${CONFIRM_WORD} para confirmar.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!armed}
              loading={reset.isPending}
              onClick={confirm}
            >
              Apagar tudo
            </Button>
          </div>
        }
      >
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          aria-label="Confirmação"
          autoFocus
        />
      </Modal>
    </div>
  );
}

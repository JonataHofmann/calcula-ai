import Link from 'next/link';

const MESSAGES: Record<string, string> = {
  provider_unavailable: 'Serviço de login indisponível. Tente novamente em instantes.',
  invalid_callback: 'Não foi possível concluir o login.',
};

const GENERIC_MESSAGE = 'Ocorreu um erro de autenticação. Tente novamente.';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && MESSAGES[reason]) || GENERIC_MESSAGE;
  const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3032';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="bg-surface rounded-card shadow-card max-w-md flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Erro de autenticação</h1>
        <p className="text-text-muted text-sm">{message}</p>
        <Link
          href={`${bffUrl}/auth/login`}
          className="bg-primary text-primary-foreground focus-visible:ring-focus-ring inline-flex h-10 items-center justify-center rounded-btn px-4 text-sm font-medium transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
        >
          Tentar novamente
        </Link>
      </div>
    </main>
  );
}
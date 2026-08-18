import Link from 'next/link';

export interface SectionHeaderProps {
  title: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHeader({ title, href, linkLabel = 'Ver todos' }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-text text-lg font-semibold">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-primary focus-visible:ring-focus-ring rounded text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

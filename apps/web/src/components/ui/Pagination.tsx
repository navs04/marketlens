import type { PageMeta } from "../../api/types";

interface PaginationProps {
  meta: PageMeta;
  onPage: (page: number) => void;
}

export function Pagination({ meta, onPage }: PaginationProps) {
  const { page, pageSize, total, totalPages } = meta;
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const buttonClass =
    "rounded-md border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink transition-colors hover:bg-paper-sunken disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-paper-raised";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
      <p className="text-ink-muted">
        Showing <span className="font-mono text-ink">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="font-mono text-ink">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden text-ink-muted sm:inline">
          Page <span className="font-mono text-ink">{page}</span> of <span className="font-mono text-ink">{totalPages}</span>
        </span>
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

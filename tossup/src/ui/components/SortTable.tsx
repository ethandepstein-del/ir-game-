import { useMemo, useState, type ReactNode } from 'react';

export interface Col<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (a: T, b: T) => number;
  right?: boolean;
  nerd?: boolean;
  title?: string;
}

interface Props<T> {
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  initialSort?: string;
  initialDesc?: boolean;
  onRowClick?: (r: T) => void;
  selectedKey?: string | null;
  showNerd?: boolean;
  limit?: number;
  empty?: ReactNode;
}

export function SortTable<T>({ rows, cols, rowKey, initialSort, initialDesc = false, onRowClick, selectedKey, showNerd = true, limit, empty }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort);
  const [desc, setDesc] = useState(initialDesc);
  const [more, setMore] = useState(false);
  const visibleCols = cols.filter((c) => showNerd || !c.nerd);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sortKey);
    if (!c?.sort) return rows;
    const out = [...rows].sort(c.sort);
    return desc ? out.reverse() : out;
  }, [rows, cols, sortKey, desc]);
  const shown = limit && !more ? sorted.slice(0, limit) : sorted;
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  className={`${c.sort ? 'sortable' : ''} ${c.right ? 'r' : ''}`}
                  title={c.title}
                  aria-sort={sortKey === c.key ? (desc ? 'descending' : 'ascending') : undefined}
                  onClick={() => {
                    if (!c.sort) return;
                    if (sortKey === c.key) setDesc(!desc);
                    else {
                      setSortKey(c.key);
                      setDesc(false);
                    }
                  }}
                >
                  {c.label}
                  {sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={() => onRowClick?.(r)}
                style={{ cursor: onRowClick ? 'pointer' : undefined, background: selectedKey === rowKey(r) ? 'var(--surface-3)' : undefined }}
              >
                {visibleCols.map((c) => (
                  <td key={c.key} className={c.right ? 'r' : ''}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={visibleCols.length} className="faint" style={{ padding: 24, textAlign: 'center' }}>
                  {empty ?? 'Nothing matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {limit && sorted.length > limit && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button className="btn sm" onClick={() => setMore(!more)}>
            {more ? 'Show fewer' : `Show all ${sorted.length}`}
          </button>
        </div>
      )}
    </>
  );
}

import React from "react";
import { cn } from "@/lib/client/cn";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  // Shown as the title line of each row on phones.
  primary?: boolean;
  // Hidden from the phone layout (e.g. action columns rendered elsewhere).
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

// A table on wide screens and a stacked list on phones, from one set of
// column definitions, so no list scrolls sideways at 375px.
export function DataList<T>({
  rows,
  columns,
  rowKey,
  caption,
  actions,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  actions?: (row: T) => React.ReactNode;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cn("px-4 py-3 font-medium", c.align === "right" && "text-right", c.className)}>
                {c.header}
              </th>
            ))}
            {actions ? (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-middle hover:bg-sunken/60">
              {columns.map((c) => (
                <td key={c.header} className={cn("px-4 py-3", c.align === "right" && "text-right", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
              {actions ? (
                <td className="px-2 py-1 text-right">
                  <div className="flex justify-end gap-1">{actions(row)}</div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{primary.cell(row)}</div>
              {actions ? <div className="-mr-2 -mt-1 flex shrink-0 gap-1">{actions(row)}</div> : null}
            </div>
            {secondary.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {secondary.map((c) => (
                  <div key={c.header} className="contents">
                    <dt className="text-ink-soft">{c.header}</dt>
                    <dd className="min-w-0">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

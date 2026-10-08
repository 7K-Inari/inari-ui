import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Select, Button } from "7k-design-system/react";

export interface FilterBarTag {
  value: string;
  label: string;
  count?: number;
}

export interface FilterBarSelect {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
}

interface FilterBarProps {
  searchParam?: string;
  searchPlaceholder?: string;
  tags?: { param: string; items: FilterBarTag[] };
  selects?: FilterBarSelect[];
  children?: React.ReactNode;
}

export function FilterBar({
  searchParam = "q",
  searchPlaceholder = "Search…",
  tags,
  selects = [],
  children,
}: FilterBarProps) {
  const [params, setParams] = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const activeCount =
    (params.get(searchParam) ? 1 : 0) +
    (tags && params.get(tags.param) ? 1 : 0) +
    selects.filter((s) => params.get(s.param)).length;

  const clearAll = () => {
    const next = new URLSearchParams(params);
    next.delete(searchParam);
    if (tags) next.delete(tags.param);
    selects.forEach((s) => next.delete(s.param));
    setParams(next, { replace: true });
  };

  return (
    <div className="filter-bar">
      {tags && (
        <div className="tag-group" role="group" aria-label="Quick filters">
          {tags.items.map((t) => {
            const active = (params.get(tags.param) ?? "") === t.value;
            return (
              <button
                key={t.value}
                type="button"
                className={active ? "tag tag-outlined" : "tag"}
                aria-pressed={active}
                onClick={() => setParam(tags.param, active ? null : t.value)}
              >
                {t.label}
                {t.count != null && <span className="chip">{t.count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="input-group filter-bar-search">
        <span className="input-addon">
          <Search size={16} aria-hidden="true" />
        </span>
        <input
          className="input"
          value={params.get(searchParam) ?? ""}
          onChange={(e) => setParam(searchParam, e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </div>
      {selects.map((s) => (
        <Select
          key={s.param}
          value={params.get(s.param) ?? "all"}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setParam(s.param, e.target.value)
          }
          aria-label={s.label}
        >
          <option value="all">{s.allLabel ?? s.label}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
      {children}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X size={14} aria-hidden="true" /> Clear ({activeCount})
        </Button>
      )}
    </div>
  );
}

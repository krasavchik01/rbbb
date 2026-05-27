/**
 * Селекторы людей для опроса по проектам.
 *
 *   <PersonPicker />  — один человек (партнёр / руководитель)
 *   <TeamPicker />    — несколько (кого помню в команде)
 *
 * Логика:
 *   - Поиск по имени из списка сотрудников
 *   - Если ничего не нашлось, можно «добавить как есть» — сохранится только
 *     userName без userId. Это нужно, потому что в опросе бывают люди,
 *     которых уже нет в системе.
 *   - Управляемый компонент: value хранится снаружи.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, UserPlus } from 'lucide-react';
import type { Employee } from '@/lib/supabaseDataStore';
import type { RememberedPerson } from '@/lib/projectSurvey';

interface PickerCoreProps {
  employees: Employee[];
  excludeIds?: Set<string>;
  excludeNames?: Set<string>;  // нормализованные имена, которые уже выбраны
  onPick: (p: RememberedPerson) => void;
  placeholder?: string;
  disabled?: boolean;
}

function PickerCore({
  employees,
  excludeIds,
  excludeNames,
  onPick,
  placeholder,
  disabled,
}: PickerCoreProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) return [] as Employee[];
    return employees
      .filter((e) => {
        if (excludeIds?.has(e.id)) return false;
        return (e.name || '').toLowerCase().includes(needle);
      })
      .slice(0, 10);
  }, [employees, q, excludeIds]);

  const pickEmployee = (e: Employee) => {
    onPick({ userId: e.id, userName: e.name });
    setQ('');
    setOpen(false);
  };

  const pickFreeText = () => {
    const name = q.trim();
    if (!name) return;
    const norm = name.toLowerCase();
    if (excludeNames?.has(norm)) {
      setQ('');
      setOpen(false);
      return;
    }
    onPick({ userName: name });
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions[0]) pickEmployee(suggestions[0]);
              else pickFreeText();
            }
          }}
          placeholder={placeholder || 'Начните вводить имя…'}
          className="pl-8 h-9 text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && q.trim().length >= 1 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
          {suggestions.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => pickEmployee(e)}
              className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex items-center justify-between"
            >
              <span>{e.name}</span>
              <span className="text-xs text-muted-foreground">
                {e.position || e.department || ''}
              </span>
            </button>
          ))}
          {suggestions.length === 0 && (
            <button
              type="button"
              onClick={pickFreeText}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Добавить «{q.trim()}» как есть</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface PersonPickerProps {
  value?: RememberedPerson;
  onChange: (next: RememberedPerson | undefined) => void;
  employees: Employee[];
  placeholder?: string;
  disabled?: boolean;
}

export function PersonPicker({
  value,
  onChange,
  employees,
  placeholder,
  disabled,
}: PersonPickerProps) {
  if (value) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm h-9 px-3 gap-2">
          {value.userName}
          {!value.userId && <span className="text-xs opacity-70">(не в системе)</span>}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Очистить"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </Badge>
      </div>
    );
  }
  return (
    <PickerCore
      employees={employees}
      onPick={(p) => onChange(p)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

interface TeamPickerProps {
  value: RememberedPerson[];
  onChange: (next: RememberedPerson[]) => void;
  employees: Employee[];
  placeholder?: string;
  disabled?: boolean;
}

export function TeamPicker({
  value,
  onChange,
  employees,
  placeholder,
  disabled,
}: TeamPickerProps) {
  const excludeIds = useMemo(
    () => new Set(value.map((v) => v.userId).filter(Boolean) as string[]),
    [value],
  );
  const excludeNames = useMemo(
    () => new Set(value.map((v) => (v.userName || '').toLowerCase())),
    [value],
  );

  const add = (p: RememberedPerson) => {
    if (p.userId && excludeIds.has(p.userId)) return;
    if (!p.userId && excludeNames.has((p.userName || '').toLowerCase())) return;
    onChange([...value, p]);
  };

  const remove = (i: number) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p, i) => (
            <Badge key={`${p.userId || p.userName}-${i}`} variant="secondary" className="gap-2">
              {p.userName}
              {!p.userId && <span className="text-xs opacity-70">(не в системе)</span>}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <PickerCore
        employees={employees}
        excludeIds={excludeIds}
        excludeNames={excludeNames}
        onPick={add}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

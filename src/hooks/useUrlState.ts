import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Хук-обёртка над useSearchParams, повторяющий API useState<T>.
 *
 * Используется для того, чтобы состояние UI (фильтры, активный таб, поиск)
 * жило в URL — тогда:
 *  - обновление страницы НЕ сбрасывает фильтры
 *  - ссылку можно скинуть коллеге и она откроется с теми же фильтрами
 *
 * Дефолтные значения НЕ пишутся в URL — query-строка остаётся короткой.
 *
 * @param key   имя query-параметра
 * @param defaultValue  значение когда параметра нет в URL
 * @param parse parse(string|null) -> T  (для not-string значений: number/bool/enum)
 * @param serialize  T -> string  (опционально, по умолчанию String())
 */
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => parse(searchParams.get(key)), [searchParams, key, parse]);

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          // Не сериализуем дефолтное значение — query-строка остаётся чистой
          if (next === defaultValue || next === null || next === undefined || next === '') {
            params.delete(key);
          } else {
            params.set(key, serialize(next));
          }
          return params;
        },
        { replace: true }, // не плодим history-записи при наборе в поиске
      );
    },
    [key, defaultValue, serialize, setSearchParams],
  );

  return [value, setValue];
}

// Готовые парсеры для частых типов значений.
const parseStringRaw = (raw: string | null): string => raw ?? '';
const serializeBool = (v: boolean): string => (v ? '1' : '0');

/** URL-state со строкой и опциональным дефолтом. */
export function useStringUrlState(key: string, def = ''): [string, (v: string) => void] {
  const parse = useCallback((raw: string | null) => raw ?? def, [def]);
  return useUrlState<string>(key, def, parse);
}

/** URL-state с булевым значением (0/1 в URL). */
export function useBoolUrlState(key: string, def = false): [boolean, (v: boolean) => void] {
  const parse = useCallback((raw: string | null) => (raw === '1' || raw === 'true'), []);
  return useUrlState<boolean>(key, def, parse, serializeBool);
}

// Экспорт raw-парсера на случай если кто-то хочет напрямую useUrlState.
export const parseString = parseStringRaw;

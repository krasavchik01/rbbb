import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface CommandCenterColumnFilterProps {
  label: string;
  value: string;
  placeholder?: string;
  active?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function CommandCenterColumnFilter({
  label,
  value,
  placeholder = 'Поиск в колонке',
  active = false,
  onChange,
  onClear,
}: CommandCenterColumnFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={active ? 'default' : 'ghost'}
          size="icon"
          className="ml-1 h-6 w-6 align-middle"
          aria-label={`Фильтр колонки: ${label}`}
          title={`Фильтр колонки: ${label}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">{label}</div>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-9"
            aria-label={`Поиск по колонке ${label}`}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>OR внутри введённых слов, AND с другими колонками.</span>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
                <X className="mr-1 h-3.5 w-3.5" />
                Сброс
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

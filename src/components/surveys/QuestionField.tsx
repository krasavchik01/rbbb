import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PROJECT_ROLES, ROLE_LABELS } from '@/types/roles';
import type { Question } from '@/lib/surveyEngine';

interface Employee {
  id: string;
  name: string;
}

interface Props {
  question: Question;
  value: any;
  onChange: (v: any) => void;
  employees?: Employee[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3, CURRENT_YEAR - 4];

export function QuestionField({ question, value, onChange, employees = [] }: Props) {
  const { type } = question;

  if (type === 'role') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите роль…" />
        </SelectTrigger>
        <SelectContent>
          {PROJECT_ROLES.map((r) => (
            <SelectItem key={r.role} value={r.role}>
              {ROLE_LABELS[r.role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === 'year') {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {YEARS.map((y) => {
          const active = String(value) === String(y);
          return (
            <button
              key={y}
              type="button"
              onClick={() => onChange(y)}
              className={
                'px-3 py-1.5 rounded-md border text-xs ' +
                (active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent')
              }
            >
              {y}
            </button>
          );
        })}
        <Input
          type="number"
          min={2010}
          max={2100}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder="другой год"
          className="w-32"
        />
      </div>
    );
  }

  if (type === 'status_vote') {
    const opts = [
      { value: 'in_progress', label: 'Ещё в работе' },
      { value: 'completed', label: 'Завершён' },
      { value: 'cancelled', label: 'Отменён' },
    ];
    return (
      <RadioGroup value={value || ''} onValueChange={onChange} className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-accent/40 text-xs"
          >
            <RadioGroupItem value={o.value} />
            <span>{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }

  if (type === 'percent') {
    return (
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={0}
          max={100}
          value={value ?? ''}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-24"
        />
        <input
          type="range"
          min={0}
          max={100}
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-sm font-medium w-10 text-right">
          {typeof value === 'number' ? value : 0}%
        </span>
      </div>
    );
  }

  if (type === 'employees') {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {selected.map((uid) => {
            const emp = employees.find((e) => e.id === uid);
            return (
              <Badge key={uid} variant="secondary" className="text-xs">
                {emp?.name || uid}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== uid))}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
        <Select
          value=""
          onValueChange={(v) => {
            if (v && !selected.includes(v)) onChange([...selected, v]);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Добавить сотрудника…" />
          </SelectTrigger>
          <SelectContent>
            {employees
              .filter((e) => !selected.includes(e.id))
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'choice') {
    const opts = question.options || [];
    return (
      <RadioGroup value={value || ''} onValueChange={onChange} className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-accent/40 text-xs"
          >
            <RadioGroupItem value={o.value} />
            <span>{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }

  if (type === 'date') {
    return <Input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }

  if (type === 'text') {
    return (
      <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={2} />
    );
  }

  if (type === 'project_picker') {
    // отображение делается в самой странице (это «контейнер»), сюда не должно прийти
    return null;
  }

  return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />;
}

export function QuestionLabel({ q }: { q: Question }) {
  return (
    <div>
      <Label className="text-xs">
        {q.label}
        {q.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {q.hint && <div className="text-xs text-muted-foreground">{q.hint}</div>}
    </div>
  );
}

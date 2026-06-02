/**
 * Таб «Аналитика и табель» на /hr.
 *
 * Доступ: hr, ceo, deputy_director, admin.
 *
 * Что внутри:
 *  1. Переключатель месяца (← / →) + быстрые пресеты.
 *  2. KPI за месяц: всего часов, активные сотрудники, проекты с активностью,
 *     средний рабочий день.
 *  3. Графики (recharts):
 *     - Часы по месяцам (последние 12 мес, независимо от выбранного месяца).
 *     - Распределение по компаниям (donut, за выбранный месяц).
 *     - Топ-10 сотрудников по часам.
 *     - Топ-10 проектов по часам.
 *  4. Табель — матрица «сотрудник × день месяца» с heatmap-заливкой,
 *     суммой за месяц, нормой и diff'ом. Клик по ячейке → разбивка по
 *     проектам этого дня. Клик по имени → drill-down по сотруднику.
 *  5. Drill-down: модалка с детальной аналитикой одного человека.
 *  6. Экспорт в xlsx: матрица + сводка по сотрудникам + по проектам.
 *
 * Никаких новых таблиц в БД: всё считается из timesheet_entries + employees
 * + projects (уже загружены через useEmployees/useProjects/listTimesheets).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { listTimesheets, type TimesheetEntry } from '@/lib/timesheets';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FolderOpen,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
// xlsx ≈ 425 KB — динамический импорт только по клику «Excel».
// type-only импорт, чтобы пакет не попал в основной бандл.
import type * as XLSXNs from 'xlsx';
const loadXlsx = (): Promise<typeof XLSXNs> => import('xlsx');

// ─── helpers ─────────────────────────────────────────────────────────────────

interface MonthRange {
  year: number;
  month: number; // 0-11
  from: string;  // 'YYYY-MM-DD'
  to: string;    // 'YYYY-MM-DD' (last day)
  label: string; // 'Май 2026'
  daysInMonth: number;
}

function makeMonth(year: number, month: number): MonthRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year,
    month,
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(last.getDate())}`,
    label: format(first, 'LLLL yyyy', { locale: ru }),
    daysInMonth: last.getDate(),
  };
}

function shiftMonth(m: MonthRange, delta: number): MonthRange {
  const d = new Date(m.year, m.month + delta, 1);
  return makeMonth(d.getFullYear(), d.getMonth());
}

// Стандартная норма часов в месяц для KZ при 5-дневке (≈ 168). Считаем как
// «рабочих дней месяца × 8», чтобы было честно (фев — меньше, июль — больше).
function calcMonthlyNorm(m: MonthRange): number {
  let workdays = 0;
  for (let d = 1; d <= m.daysInMonth; d++) {
    const dow = new Date(m.year, m.month, d).getDay();
    if (dow !== 0 && dow !== 6) workdays++;
  }
  return workdays * 8;
}

function dateKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getCompanyOfProject(proj: any): string {
  return (
    proj?.companyName ||
    proj?.ourCompany ||
    proj?.notes?.companyName ||
    proj?.notes?.ourCompany ||
    'Без компании'
  );
}

// Цвет ячейки по часам — heatmap. 0 — почти прозрачно, 10+ — насыщенно.
function cellClass(hours: number, isWeekend: boolean): string {
  if (hours <= 0) {
    return isWeekend
      ? 'bg-muted/40 text-muted-foreground/40'
      : 'bg-background text-muted-foreground/30';
  }
  if (hours < 4) return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200';
  if (hours < 8) return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (hours < 10) return 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800/40 dark:text-emerald-100';
  return 'bg-blue-200 text-blue-900 dark:bg-blue-800/40 dark:text-blue-100';
}

// ─── component ───────────────────────────────────────────────────────────────

export default function TimesheetAnalyticsTab() {
  const { employees = [] } = useEmployees();
  const { projects = [] } = useProjects();

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<MonthRange>(() => makeMonth(today.getFullYear(), today.getMonth()));
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [trendEntries, setTrendEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState(false);

  // Норма за месяц — берём по рабочим дням × 8.
  const norm = useMemo(() => calcMonthlyNorm(month), [month]);

  // ── loading ──
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Загружаем за месяц для матрицы/KPI/частей графиков.
      const monthEntries = await listTimesheets({
        workDateFrom: month.from,
        workDateTo: month.to,
      });
      setEntries(monthEntries);

      // Параллельно — за последние 12 месяцев для тренд-графика.
      // Загружается отдельно, потому что период шире выбранного месяца.
      const trendFrom = (() => {
        const d = new Date(month.year, month.month - 11, 1);
        return dateKey(d);
      })();
      const trend = await listTimesheets({
        workDateFrom: trendFrom,
        workDateTo: month.to,
      });
      setTrendEntries(trend);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── derived: lookups ──
  const employeeById = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of employees as any[]) m.set(e.id, e);
    return m;
  }, [employees]);

  const projectById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of projects as any[]) m.set(p.id, p);
    return m;
  }, [projects]);

  // ── derived: month aggregations ──

  // Σ часов по сотруднику за месяц.
  const hoursByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.employeeId, (m.get(e.employeeId) || 0) + e.hours);
    return m;
  }, [entries]);

  // Дни активности по сотруднику.
  const daysByEmployee = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of entries) {
      let s = m.get(e.employeeId);
      if (!s) { s = new Set(); m.set(e.employeeId, s); }
      s.add(e.workDate);
    }
    return m;
  }, [entries]);

  // Σ часов по проекту за месяц.
  const hoursByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const key = e.projectId || `__noproj__:${e.projectName}`;
      m.set(key, (m.get(key) || 0) + e.hours);
    }
    return m;
  }, [entries]);

  // Матрица employee × day → часы.
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const e of entries) {
      let row = m.get(e.employeeId);
      if (!row) { row = new Map(); m.set(e.employeeId, row); }
      row.set(e.workDate, (row.get(e.workDate) || 0) + e.hours);
    }
    return m;
  }, [entries]);

  // Разбивка по проектам внутри одной ячейки employee+date.
  const cellBreakdown = useMemo(() => {
    const m = new Map<string, Map<string, number>>(); // 'empId|date' -> projName -> hours
    for (const e of entries) {
      const key = `${e.employeeId}|${e.workDate}`;
      let row = m.get(key);
      if (!row) { row = new Map(); m.set(key, row); }
      const projName = e.projectName || 'Без проекта';
      row.set(projName, (row.get(projName) || 0) + e.hours);
    }
    return m;
  }, [entries]);

  // ── derived: charts data ──

  // Часы по месяцам (для тренда — 12 мес).
  const hoursByMonthData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of trendEntries) {
      const ym = (e.workDate || '').slice(0, 7);
      m.set(ym, (m.get(ym) || 0) + e.hours);
    }
    // Заполняем все 12 месяцев нулями для ровного графика.
    const result: { month: string; hours: number; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(month.year, month.month - i, 1);
      const ym = format(d, 'yyyy-MM');
      result.push({
        month: ym,
        hours: Math.round(m.get(ym) || 0),
        label: format(d, 'LLL', { locale: ru }),
      });
    }
    return result;
  }, [trendEntries, month]);

  // Распределение по компаниям (donut) — за выбранный месяц.
  const hoursByCompanyData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const proj = e.projectId ? projectById.get(e.projectId) : null;
      const company = proj ? getCompanyOfProject(proj) : 'Без компании';
      m.set(company, (m.get(company) || 0) + e.hours);
    }
    return Array.from(m.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
      .sort((a, b) => b.hours - a.hours);
  }, [entries, projectById]);

  const COMPANY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#ec4899'];

  // Топ-10 сотрудников.
  const topEmployees = useMemo(() => {
    return Array.from(hoursByEmployee.entries())
      .map(([id, hours]) => ({
        id,
        name: employeeById.get(id)?.name || 'Неизвестный',
        hours: Math.round(hours),
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [hoursByEmployee, employeeById]);

  // Топ-10 проектов.
  const topProjects = useMemo(() => {
    return Array.from(hoursByProject.entries())
      .map(([key, hours]) => {
        const id = key.startsWith('__noproj__:') ? null : key;
        const proj = id ? projectById.get(id) : null;
        const name = proj?.name || (id ? 'Без названия' : key.replace('__noproj__:', ''));
        return { id: key, name, hours: Math.round(hours) };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [hoursByProject, projectById]);

  // ── derived: KPIs ──
  const totalHours = useMemo(
    () => Array.from(hoursByEmployee.values()).reduce((s, h) => s + h, 0),
    [hoursByEmployee],
  );
  const activeEmployees = hoursByEmployee.size;
  const activeProjects = hoursByProject.size;
  const totalDays = useMemo(() => {
    const days = new Set<string>();
    for (const e of entries) days.add(`${e.employeeId}|${e.workDate}`);
    return days.size;
  }, [entries]);
  const avgDay = totalDays > 0 ? totalHours / totalDays : 0;

  // ── список строк табеля (с фильтром по поиску) ──
  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Берём только тех, у кого есть часы за месяц — иначе строка пустая
    // и засоряет. Если HR хочет видеть всех — можно убрать фильтр позже.
    const withHours = Array.from(hoursByEmployee.keys())
      .map((id) => employeeById.get(id))
      .filter(Boolean) as any[];
    const filtered = q
      ? withHours.filter((e) => (e.name || '').toLowerCase().includes(q))
      : withHours;
    return filtered.sort((a, b) =>
      (hoursByEmployee.get(b.id) || 0) - (hoursByEmployee.get(a.id) || 0),
    );
  }, [hoursByEmployee, employeeById, search]);

  // Дни месяца (1..daysInMonth) с маркером выходного.
  const daysOfMonth = useMemo(() => {
    const out: { day: number; date: string; isWeekend: boolean }[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = 1; d <= month.daysInMonth; d++) {
      const dow = new Date(month.year, month.month, d).getDay();
      out.push({
        day: d,
        date: `${month.year}-${pad(month.month + 1)}-${pad(d)}`,
        isWeekend: dow === 0 || dow === 6,
      });
    }
    return out;
  }, [month]);

  // ── drill-down ──
  const drillEmployee = drilldownId ? employeeById.get(drilldownId) : null;
  const drillEntries = useMemo(
    () => (drilldownId ? entries.filter((e) => e.employeeId === drilldownId) : []),
    [entries, drilldownId],
  );

  // ── export ──
  const handleExport = useCallback(async () => {
    setBusyExport(true);
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.utils.book_new();

      // Лист 1: матрица табеля
      const matrixRows: any[][] = [];
      const header = ['Сотрудник', ...daysOfMonth.map((d) => d.day), 'Итого', 'Норма', 'Δ'];
      matrixRows.push(header);
      for (const emp of visibleEmployees) {
        const row: any[] = [emp.name];
        const empMatrix = matrix.get(emp.id) || new Map<string, number>();
        for (const d of daysOfMonth) {
          const v = empMatrix.get(d.date) || 0;
          row.push(v > 0 ? Number(v.toFixed(1)) : '');
        }
        const total = hoursByEmployee.get(emp.id) || 0;
        row.push(Number(total.toFixed(1)));
        row.push(norm);
        row.push(Number((total - norm).toFixed(1)));
        matrixRows.push(row);
      }
      const ws1 = XLSX.utils.aoa_to_sheet(matrixRows);
      // Ширина колонок: первая широкая, дни узкие, итог — средние.
      ws1['!cols'] = [
        { wch: 28 },
        ...daysOfMonth.map(() => ({ wch: 4 })),
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, `Табель ${month.label}`);

      // Лист 2: сводка по сотрудникам
      const empSummary: any[][] = [['Сотрудник', 'Часов', 'Дней', 'Ср.день', 'Норма', 'Δ']];
      for (const emp of visibleEmployees) {
        const h = hoursByEmployee.get(emp.id) || 0;
        const d = daysByEmployee.get(emp.id)?.size || 0;
        empSummary.push([
          emp.name,
          Number(h.toFixed(1)),
          d,
          d > 0 ? Number((h / d).toFixed(1)) : 0,
          norm,
          Number((h - norm).toFixed(1)),
        ]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(empSummary);
      ws2['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Сводка');

      // Лист 3: по проектам (все, отсортированы по убыванию часов)
      const projSummary: any[][] = [['Проект', 'Часов', 'Компания']];
      const allProjectsSorted = Array.from(hoursByProject.entries())
        .map(([key, hours]) => {
          const id = key.startsWith('__noproj__:') ? null : key;
          const proj = id ? projectById.get(id) : null;
          return {
            name: proj?.name || (id ? 'Без названия' : key.replace('__noproj__:', '')),
            hours: Number(hours.toFixed(1)),
            company: proj ? getCompanyOfProject(proj) : '—',
          };
        })
        .sort((a, b) => b.hours - a.hours);
      for (const p of allProjectsSorted) {
        projSummary.push([p.name, p.hours, p.company]);
      }
      const ws3 = XLSX.utils.aoa_to_sheet(projSummary);
      ws3['!cols'] = [{ wch: 50 }, { wch: 10 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Проекты');

      const fname = `Табель_${month.year}-${String(month.month + 1).padStart(2, '0')}.xlsx`;
      XLSX.writeFile(wb, fname);
    } finally {
      setBusyExport(false);
    }
  }, [
    daysOfMonth, visibleEmployees, matrix, hoursByEmployee, daysByEmployee,
    norm, hoursByProject, projectById, month,
  ]);

  // ── render ──
  return (
    <div className="space-y-4">
      {/* Шапка: переключатель месяца + поиск + экспорт */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="font-semibold text-lg min-w-[160px] text-center capitalize">
                {month.label}
              </div>
              <Button size="sm" variant="outline" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMonth(makeMonth(today.getFullYear(), today.getMonth()))}
              >
                Сегодня
              </Button>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Найти сотрудника…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </Button>
            <Button size="sm" onClick={handleExport} disabled={busyExport || loading || entries.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI карточки */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={<Clock className="w-5 h-5 text-primary" />} value={`${totalHours.toFixed(1)} ч`} label="Всего часов за месяц" />
        <KPICard icon={<Users className="w-5 h-5 text-emerald-600" />} value={String(activeEmployees)} label="Активных сотрудников" />
        <KPICard icon={<FolderOpen className="w-5 h-5 text-amber-600" />} value={String(activeProjects)} label="Проектов с активностью" />
        <KPICard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          value={`${avgDay.toFixed(1)} ч`}
          label="Средний рабочий день"
        />
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Часы по месяцам (последние 12)</CardTitle></CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hoursByMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Распределение по компаниям</CardTitle></CardHeader>
          <CardContent>
            {hoursByCompanyData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={hoursByCompanyData}
                    dataKey="hours"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={40}
                    label={(d: any) => `${d.name}: ${d.hours}ч`}
                  >
                    {hoursByCompanyData.map((_, i) => (
                      <Cell key={i} fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Топ-10 сотрудников</CardTitle></CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={Math.max(220, topEmployees.length * 24)}>
              <BarChart data={topEmployees} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="hours" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Топ-10 проектов</CardTitle></CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={Math.max(220, topProjects.length * 24)}>
              <BarChart data={topProjects} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="hours" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Табель — матрица */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              Табель {month.label} <span className="text-xs text-muted-foreground font-normal ml-2">
                ({visibleEmployees.length} сотр., норма {norm} ч)
              </span>
            </CardTitle>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <Legend2 color="bg-amber-100 dark:bg-amber-900/30" label="1–4 ч" />
              <Legend2 color="bg-emerald-100 dark:bg-emerald-900/30" label="4–8 ч" />
              <Legend2 color="bg-emerald-200 dark:bg-emerald-800/40" label="8–10 ч" />
              <Legend2 color="bg-blue-200 dark:bg-blue-800/40" label="10+ ч" />
              <Legend2 color="bg-muted/40" label="вых." />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Загрузка…</div>
          ) : visibleEmployees.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Нет данных за этот месяц</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    <th className="sticky left-0 bg-background z-20 text-left p-2 min-w-[200px]">Сотрудник</th>
                    {daysOfMonth.map((d) => (
                      <th
                        key={d.day}
                        className={`p-1 text-center w-9 ${d.isWeekend ? 'bg-muted/30 text-muted-foreground' : ''}`}
                      >
                        {d.day}
                      </th>
                    ))}
                    <th className="p-2 text-right min-w-[60px]">Σ</th>
                    <th className="p-2 text-right min-w-[60px]">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((emp) => {
                    const empMatrix = matrix.get(emp.id) || new Map<string, number>();
                    const total = hoursByEmployee.get(emp.id) || 0;
                    const diff = total - norm;
                    return (
                      <tr key={emp.id} className="border-b hover:bg-accent/30">
                        <td className="sticky left-0 bg-background z-10 p-2 truncate max-w-[200px]">
                          <button
                            className="text-left hover:text-primary hover:underline"
                            onClick={() => setDrilldownId(emp.id)}
                            title="Открыть детальную аналитику"
                          >
                            {emp.name}
                          </button>
                        </td>
                        {daysOfMonth.map((d) => {
                          const hours = empMatrix.get(d.date) || 0;
                          const klass = cellClass(hours, d.isWeekend);
                          const breakdown = cellBreakdown.get(`${emp.id}|${d.date}`);
                          const cellContent = (
                            <div className={`text-center font-medium text-[11px] py-1 ${klass} cursor-pointer rounded-sm`}>
                              {hours > 0 ? hours.toFixed(hours % 1 === 0 ? 0 : 1) : ''}
                            </div>
                          );
                          if (hours <= 0) {
                            return <td key={d.day} className="p-0.5">{cellContent}</td>;
                          }
                          return (
                            <td key={d.day} className="p-0.5">
                              <Popover>
                                <PopoverTrigger asChild>{cellContent}</PopoverTrigger>
                                <PopoverContent className="text-xs w-64">
                                  <div className="font-semibold mb-1">
                                    {emp.name}, {format(parseISO(d.date), 'd MMM', { locale: ru })}
                                  </div>
                                  <div className="text-muted-foreground mb-2">{hours.toFixed(1)} ч за день</div>
                                  {breakdown && (
                                    <div className="space-y-1">
                                      {Array.from(breakdown.entries())
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([projName, h]) => (
                                          <div key={projName} className="flex justify-between gap-2">
                                            <span className="truncate" title={projName}>{projName}</span>
                                            <span className="font-mono shrink-0">{h.toFixed(1)} ч</span>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </td>
                          );
                        })}
                        <td className="p-2 text-right font-semibold">{total.toFixed(1)}</td>
                        <td
                          className={`p-2 text-right font-semibold ${
                            diff >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down модалка */}
      <Dialog open={!!drilldownId} onOpenChange={(v) => !v && setDrilldownId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {drillEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>{drillEmployee.name}</DialogTitle>
                <DialogDescription>
                  Аналитика за {month.label} · {drillEntries.length} зап. ·
                  {' '}{(hoursByEmployee.get(drillEmployee.id) || 0).toFixed(1)} ч
                </DialogDescription>
              </DialogHeader>
              <EmployeeDrilldown
                entries={drillEntries}
                projectById={projectById}
                norm={norm}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── small subcomponents ─────────────────────────────────────────────────────

function KPICard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function EmployeeDrilldown({
  entries,
  projectById,
  norm,
}: {
  entries: TimesheetEntry[];
  projectById: Map<string, any>;
  norm: number;
}) {
  // По дням
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.workDate, (m.get(e.workDate) || 0) + e.hours);
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10, label: date.slice(8) }));
  }, [entries]);

  // По проектам
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const name = e.projectName || 'Без проекта';
      m.set(name, (m.get(name) || 0) + e.hours);
    }
    return Array.from(m.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
      .sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const total = entries.reduce((s, e) => s + e.hours, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPICard icon={<Clock className="w-5 h-5 text-primary" />} value={`${total.toFixed(1)}`} label="Часов" />
        <KPICard icon={<Users className="w-5 h-5 text-emerald-600" />} value={`${norm}`} label="Норма (ч)" />
        <KPICard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          value={`${(total - norm).toFixed(1)}`}
          label="Δ к норме"
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Часы по дням</CardTitle></CardHeader>
        <CardContent className="pl-2">
          {byDay.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="hours" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Распределение по проектам</CardTitle></CardHeader>
        <CardContent>
          {byProject.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Нет данных</div>
          ) : (
            <div className="space-y-1.5">
              {byProject.map((p, i) => {
                const pct = total > 0 ? (p.hours / total) * 100 : 0;
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="truncate" title={p.name}>{p.name}</span>
                      <span className="font-mono shrink-0">{p.hours} ч · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Все записи ({entries.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left p-2">Дата</th>
                  <th className="text-left p-2">Проект</th>
                  <th className="text-left p-2">Секция</th>
                  <th className="text-right p-2">Часы</th>
                </tr>
              </thead>
              <tbody>
                {entries
                  .slice()
                  .sort((a, b) => a.workDate.localeCompare(b.workDate))
                  .map((e) => (
                    <tr key={e.id} className="border-b hover:bg-accent/20">
                      <td className="p-2 font-mono">{format(parseISO(e.workDate), 'dd MMM', { locale: ru })}</td>
                      <td className="p-2 truncate max-w-[280px]" title={e.projectName}>{e.projectName}</td>
                      <td className="p-2 text-muted-foreground">{e.section || '—'}</td>
                      <td className="p-2 text-right font-mono">{e.hours.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

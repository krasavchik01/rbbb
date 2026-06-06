/**
 * Три виджета на дашборд, работающие на реальных данных из Supabase:
 *
 *   <MyHoursWidget>             — для всех; approved/pending/rejected за месяц.
 *   <PartnerApprovalWidget>     — для partner/deputy_director/ceo/admin;
 *                                 сколько строк ждёт МЕНЯ как партнёра.
 *   <BonusesOverviewWidget>     — для ceo/deputy_director/admin; пул бонусов
 *                                 2024-2025, выплачено, к выплате.
 *
 * Каждый виджет сам тянет данные и сам обновляется раз в 30 секунд
 * (мягкий polling — без realtime subscriptions, чтобы не тратить квоту
 * и не плодить хрупкие подписки). Цифры на дашборде «живые» — но не до
 * долей секунды.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle2, AlertTriangle, XCircle, Inbox, Coins, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { getProjectPartnerId } from '@/lib/timesheets';
import {
  computeAllProjects, aggregateTotals, BONUS_ROLES, type ProjectBonusRow,
} from '@/lib/bonusCalculation';

const REFRESH_MS = 30_000;

// Роли, у которых не бывает рабочих часов на проектах — им виджет
// «Мои часы» не нужен (будет вечный ноль и засирать дашборд).
const NON_EXECUTOR_ROLES = new Set([
  'ceo', 'deputy_director', 'company_director',
  'procurement', 'hr', 'accountant', 'admin_staff', 'admin',
]);

// ─── Hook: периодически перезапускает callback ──────────────────────────────
function useInterval(callback: () => void, ms: number) {
  useEffect(() => {
    callback();
    const id = setInterval(callback, ms);
    return () => clearInterval(id);
  }, [callback, ms]);
}

function fmtH(h: number): string {
  return `${h.toFixed(1)} ч`;
}

function fmtTenge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₸`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₸`;
  return `${Math.round(n)} ₸`;
}

// ─── 1. MyHoursWidget ───────────────────────────────────────────────────────

export function MyHoursWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ approved: 0, submitted: 0, rejected: 0, approvedHours: 0, submittedHours: 0, rejectedHours: 0 });
  const [loading, setLoading] = useState(true);

  // Окно «за текущий месяц»
  const { from, to } = useMemo(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }, []);

  const refresh = useMemo(() => async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('timesheet_entries')
      .select('status,hours')
      .eq('employee_id', user.id)
      .gte('work_date', from)
      .lte('work_date', to);
    const c = { approved: 0, submitted: 0, rejected: 0, approvedHours: 0, submittedHours: 0, rejectedHours: 0 };
    for (const r of data || []) {
      const h = Number(r.hours) || 0;
      if (r.status === 'approved') { c.approved++; c.approvedHours += h; }
      else if (r.status === 'submitted') { c.submitted++; c.submittedHours += h; }
      else if (r.status === 'rejected') { c.rejected++; c.rejectedHours += h; }
    }
    setCounts(c);
    setLoading(false);
  }, [user?.id, from, to]);

  useInterval(refresh, REFRESH_MS);

  if (!user) return null;
  if (NON_EXECUTOR_ROLES.has(user.role)) return null;

  return (
    <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Мои часы</h3>
              <p className="text-xs text-muted-foreground">за {from.slice(0, 7)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/timesheets')}>
            Открыть <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Утверждено
            </div>
            <div className="text-2xl font-bold">{loading ? '…' : fmtH(counts.approvedHours)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{counts.approved} зап.</div>
          </div>

          <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-medium mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> На утверждении
            </div>
            <div className="text-2xl font-bold">{loading ? '…' : fmtH(counts.submittedHours)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{counts.submitted} зап.</div>
          </div>

          <div className="rounded-lg p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-xs font-medium mb-1">
              <XCircle className="w-3.5 h-3.5" /> Отклонено
            </div>
            <div className="text-2xl font-bold">{loading ? '…' : fmtH(counts.rejectedHours)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{counts.rejected} зап.</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── 2. PartnerApprovalWidget ───────────────────────────────────────────────

export function PartnerApprovalWidget() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const navigate = useNavigate();
  const [pending, setPending] = useState<{ rows: number; hours: number; projects: number }>({ rows: 0, hours: 0, projects: 0 });
  const [loading, setLoading] = useState(true);

  // Те проекты, где user — партнёр (или все, для зам.дир/admin).
  // CEO специально исключён — он не апрувает таймщиты, это не его задача.
  // Апрув: partner по своим проектам; deputy_director как fallback по проектам
  // без партнёра. admin оставлен для отладки.
  const myProjectIds = useMemo(() => {
    if (!user) return null;
    const isPrivileged = ['deputy_director', 'admin'].includes(user.role);
    if (isPrivileged) return null;     // null = «все проекты»
    if (user.role !== 'partner') return [];
    return (projects as any[])
      .filter((p) => getProjectPartnerId(p) === user.id)
      .map((p) => p.id);
  }, [user, projects]);

  const refresh = useMemo(() => async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from('timesheet_entries')
      .select('hours,project_id', { count: 'exact' })
      .eq('status', 'submitted');
    if (myProjectIds !== null) {
      if (myProjectIds.length === 0) {
        setPending({ rows: 0, hours: 0, projects: 0 });
        setLoading(false);
        return;
      }
      q = q.in('project_id', myProjectIds);
    }
    const { data, count } = await q.limit(10000);
    let hours = 0;
    const projSet = new Set<string>();
    for (const r of data || []) {
      hours += Number(r.hours) || 0;
      if (r.project_id) projSet.add(r.project_id);
    }
    setPending({ rows: count || 0, hours, projects: projSet.size });
    setLoading(false);
  }, [user, myProjectIds]);

  useInterval(refresh, REFRESH_MS);

  if (!user) return null;
  // CEO исключён намеренно — апрув часов это не его уровень.
  const isPrivileged = ['deputy_director', 'admin'].includes(user.role);
  const isPartner = user.role === 'partner';
  if (!isPrivileged && !isPartner) return null;

  const empty = pending.rows === 0;

  return (
    <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {isPartner ? 'Ждут моего апрува' : 'Ждут апрува'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isPrivileged ? 'по всей системе' : 'по моим проектам'}
              </p>
            </div>
          </div>
          {!empty && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => navigate('/timesheet-approval')}
            >
              Утвердить <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : empty ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">Ничего не ждёт — все часы апрувнуты.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Записей</div>
              <div className="text-2xl font-bold">{pending.rows}</div>
            </div>
            <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Часов</div>
              <div className="text-2xl font-bold">{pending.hours.toFixed(0)}</div>
            </div>
            <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Проектов</div>
              <div className="text-2xl font-bold">{pending.projects}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── 3. BonusesOverviewWidget ───────────────────────────────────────────────

export function BonusesOverviewWidget() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const navigate = useNavigate();

  if (!user) return null;
  const visible = ['ceo', 'deputy_director', 'admin'].includes(user.role);
  if (!visible) return null;

  // Фильтр: только completed проекты с end_date / deadline в 2024-2025.
  // Проще: status='completed' (после нашего скрипта закрытия 2024-2025
  // эти проекты — те самые) + по start_date в окне.
  const filtered = useMemo(() => {
    return (projects as any[]).filter((p) => {
      if (p.status !== 'completed' && p.status !== 'closed') return false;
      const start = p.start_date || p.notes?.start_date;
      const deadline = p.deadline || p.notes?.deadline;
      const inWindow = (d: string | null | undefined) => !!d && d >= '2024-01-01' && d <= '2025-12-31';
      return inWindow(start) || inWindow(deadline);
    });
  }, [projects]);

  const rows: ProjectBonusRow[] = useMemo(() => computeAllProjects(filtered), [filtered]);
  const totals = useMemo(() => aggregateTotals(rows), [rows]);

  // Сколько помечено выплаченным в notes.finances.teamBonuses[].paidAt.
  // Не блокируем виджет если нет — просто покажем 0.
  const paidTotal = useMemo(() => {
    let s = 0;
    for (const r of rows) {
      const tb = r.project?.finances?.teamBonuses || r.project?.notes?.finances?.teamBonuses;
      if (!tb || typeof tb !== 'object') continue;
      for (const k of Object.keys(tb)) {
        if (tb[k]?.paidAt) s += Number(tb[k]?.amount) || 0;
      }
    }
    return s;
  }, [rows]);

  const toPay = Math.max(0, totals.totalBonuses - paidTotal);

  return (
    <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Бонусы 2024-2025</h3>
              <p className="text-xs text-muted-foreground">
                по {rows.length} закрытым проектам
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/bonuses')}>
            Детально <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Нет закрытых проектов 2024-2025 — после закрытия и заполнения финансов цифры появятся.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
              <div className="rounded-lg p-3 bg-secondary/40 border">
                <div className="text-xs text-muted-foreground font-medium mb-1">Бонусный фонд</div>
                <div className="text-xl font-bold">{fmtTenge(totals.bonusPool)}</div>
              </div>
              <div className="rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Выплачено</div>
                <div className="text-xl font-bold">{fmtTenge(paidTotal)}</div>
              </div>
              <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50">
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">К выплате</div>
                <div className="text-xl font-bold">{fmtTenge(toPay)}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">По ролям</div>
              {BONUS_ROLES
                .filter((r) => (totals.roleBonuses[r.role] || 0) > 0)
                .sort((a, b) => (totals.roleBonuses[b.role] || 0) - (totals.roleBonuses[a.role] || 0))
                .slice(0, 6)
                .map((r) => {
                  const amount = totals.roleBonuses[r.role] || 0;
                  const pct = totals.totalBonuses > 0 ? (amount / totals.totalBonuses) * 100 : 0;
                  return (
                    <div key={r.role} className="flex items-center gap-2 text-xs">
                      <span className="w-32 truncate" title={r.label}>{r.label}</span>
                      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 font-mono">
                        {fmtTenge(amount)}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTasks, Task } from '@/hooks/useTasks';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addNotification } from '@/lib/notifications';
import { deriveProjectStatusFromTasks, isTaskDoneStatus } from '@/lib/projectWorkflow';
import {
  CheckSquare, Search, Clock, User, CheckCircle2, Circle,
  Briefcase, ListChecks, Plus, Trash2, Edit, Kanban,
  List, GripVertical, AlertTriangle, CalendarDays, X, Eye,
  Paperclip, Users, Upload, Download, FileText,
} from 'lucide-react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_LEVELS = [
  { val: 1, key: 'low'      as Task['priority'], label: 'Низкий',    dot: 'bg-slate-400',  text: 'text-slate-400',  bar: 'bg-slate-400'  },
  { val: 2, key: 'med'      as Task['priority'], label: 'Средний',   dot: 'bg-yellow-400', text: 'text-yellow-500', bar: 'bg-yellow-400' },
  { val: 3, key: 'high'     as Task['priority'], label: 'Высокий',   dot: 'bg-orange-500', text: 'text-orange-500', bar: 'bg-orange-500' },
  { val: 4, key: 'critical' as Task['priority'], label: 'Критичный', dot: 'bg-red-500',    text: 'text-red-500',    bar: 'bg-red-500'    },
];
const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-slate-400', todo: 'bg-slate-500', in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500', done: 'bg-green-500', blocked: 'bg-red-500',
};
const STATUS_LABELS: Record<string, string> = {
  backlog: 'Бэклог', todo: 'К выполнению', in_progress: 'В работе',
  in_review: 'На проверке', done: 'Готово', blocked: 'Заблокировано',
};
const priorityToVal = (p: string) => ({ low: 1, med: 2, high: 3, critical: 4 }[p] || 2);
const valToPriority = (v: number): Task['priority'] =>
  ({ 1: 'low', 2: 'med', 3: 'high', 4: 'critical' }[v] as Task['priority']) || 'med';
const getReviewerId = (task: Task) =>
  task.labels?.find(l => l.startsWith('reviewer:'))?.replace('reviewer:', '') || '';

function initials(name: string) {
  return (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
function EmpAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const sz = size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ─── Searchable employee input ─────────────────────────────────────────────────
function EmpSearch({ value, onChange, employees, placeholder = 'Поиск по имени...', exclude = [] }: {
  value: string; onChange: (id: string) => void;
  employees: any[]; placeholder?: string; exclude?: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = employees.find((e: any) => e.id === value);
  const filtered = employees
    .filter((e: any) => !exclude.includes(e.id))
    .filter((e: any) => !query || (e.name || e.email || '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg bg-muted/20 cursor-pointer hover:border-muted-foreground/40 transition-colors" onClick={() => { setOpen(true); setQuery(''); }}>
        <EmpAvatar name={selected.name || selected.email} size="xs" />
        <span className="flex-1 text-sm">{selected.name || selected.email}</span>
        <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground" onClick={e => { e.stopPropagation(); onChange(''); }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg focus-within:border-primary transition-colors bg-background">
        <Search className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 border border-border rounded-lg bg-popover shadow-lg overflow-hidden">
          {filtered.length === 0
            ? <p className="px-3 py-3 text-sm text-muted-foreground">Не найдено</p>
            : filtered.map((e: any) => (
              <button key={e.id} type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/60 text-sm text-left transition-colors"
                onMouseDown={() => { onChange(e.id); setQuery(''); setOpen(false); }}>
                <EmpAvatar name={e.name || e.email} size="xs" />
                <div className="min-w-0">
                  <p className="font-medium leading-none">{e.name || e.email}</p>
                  {e.role && <p className="text-[11px] text-muted-foreground mt-0.5">{e.role}</p>}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Co-assignee chips ────────────────────────────────────────────────────────
function CoAssigneesPicker({ employees, selected, onChange, exclude = [] }: {
  employees: any[]; selected: string[]; onChange: (ids: string[]) => void; exclude?: string[];
}) {
  const [query, setQuery] = useState('');
  const available = employees.filter((e: any) => !exclude.includes(e.id));
  const filtered = available.filter((e: any) =>
    !query || (e.name || e.email || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(id => {
            const e = employees.find((emp: any) => emp.id === id);
            return e ? (
              <span key={id} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                <EmpAvatar name={e.name || e.email} size="xs" />
                {e.name || e.email}
                <button type="button" onClick={() => toggle(id)}><X className="w-3 h-3 opacity-60 hover:opacity-100" /></button>
              </span>
            ) : null;
          })}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg focus-within:border-primary transition-colors bg-background">
        <Search className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
          placeholder="Добавить соисполнителя..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {query && (
        <div className="border border-border rounded-lg bg-popover shadow-sm overflow-hidden">
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm text-muted-foreground">Не найдено</p>
            : filtered.map((e: any) => (
              <button key={e.id} type="button"
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${selected.includes(e.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}
                onClick={() => { toggle(e.id); setQuery(''); }}>
                <EmpAvatar name={e.name || e.email} size="xs" />
                <span>{e.name || e.email}</span>
                {selected.includes(e.id) && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Checkbox row (toggles optional section) ──────────────────────────────────
function OptionalToggle({ checked, onChange, label, icon: Icon }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; icon: any;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'}`}
        onClick={() => onChange(!checked)}
      >
        {checked && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
      </div>
      <Icon className={`w-3.5 h-3.5 ${checked ? 'text-primary' : 'text-muted-foreground/50'}`} />
      <span className={`text-sm transition-colors ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </label>
  );
}

// ─── Task attachment metadata ──────────────────────────────────────────────────
export interface TaskAttachment {
  type: 'file';
  id: string;
  name: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// ─── Form state ───────────────────────────────────────────────────────────────
interface TaskForm {
  title: string;
  description: string;
  project_id: string;
  mainAssignee: string;
  coAssignees: string[];
  reviewer: string;
  priorityVal: number;
  due_at: string;
  // optional toggles
  wantCoAssignees: boolean;
  wantReviewer: boolean;
  wantAttachment: boolean;
  pendingFiles: File[];
}
const defaultForm: TaskForm = {
  title: '', description: '', project_id: '',
  mainAssignee: '', coAssignees: [], reviewer: '',
  priorityVal: 2, due_at: '',
  wantCoAssignees: false, wantReviewer: false, wantAttachment: false,
  pendingFiles: [],
};

// ─── Task card ────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task; employees: any[]; projects: any[];
  onEdit: (t: Task) => void; onDelete: (t: Task) => void;
  canDelete: boolean;
  dragHandleListeners?: any; dragHandleAttributes?: any;
}
function TaskCard({ task, employees, projects, onEdit, onDelete, canDelete, dragHandleListeners, dragHandleAttributes }: TaskCardProps) {
  const mainEmp    = employees.find((e: any) => e.id === task.assignees?.[0]) as any;
  const reviewerEmp = employees.find((e: any) => e.id === getReviewerId(task)) as any;
  const project    = task.project_id ? projects.find((p: any) => p.id === task.project_id) : null;
  const isOverdue  = task.due_at && task.status !== 'done' && isPast(parseISO(task.due_at));
  const isDueToday = task.due_at && isToday(parseISO(task.due_at));
  const pl = PRIORITY_LEVELS.find(p => p.key === task.priority) || PRIORITY_LEVELS[1];
  const hasAttachment = task.labels?.includes('requires_attachment');

  return (
    <Card className={`p-3 border-0 shadow-sm hover:shadow-md transition-all select-none group ${task.status === 'done' ? 'opacity-55' : ''}`}>
      <div className="flex items-start gap-2">
        {dragHandleListeners && (
          <div {...dragHandleListeners} {...dragHandleAttributes}
            className="cursor-grab active:cursor-grabbing mt-0.5 text-muted-foreground/25 hover:text-muted-foreground/60 flex-shrink-0 touch-none">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`h-0.5 rounded-full mb-2 ${pl.bar}`} />
          <div className="flex items-start justify-between gap-1">
            <p className={`font-medium text-sm leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(task)}><Edit className="w-3 h-3" /></Button>
              {canDelete && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(task)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          </div>
          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {project && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Briefcase className="w-2.5 h-2.5" /><span className="truncate max-w-[80px]">{project.name}</span></span>}
            {task.due_at && (
              <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : isDueToday ? 'text-orange-500' : 'text-muted-foreground'}`}>
                <Clock className="w-2.5 h-2.5" />{format(parseISO(task.due_at), 'dd MMM', { locale: ru })}{isOverdue && ' ⚠'}
              </span>
            )}
            {hasAttachment && <Paperclip className="w-2.5 h-2.5 text-muted-foreground/50" />}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/40">
            {mainEmp
              ? <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <EmpAvatar name={mainEmp.name || mainEmp.email} size="xs" />
                  <span className="text-[10px] text-muted-foreground truncate">{mainEmp.name || mainEmp.email}</span>
                  {(task.assignees?.length || 0) > 1 && <span className="text-[10px] text-muted-foreground">+{task.assignees.length - 1}</span>}
                </div>
              : <span className="flex-1 text-[10px] text-muted-foreground/50">Не назначен</span>}
            {reviewerEmp && <div className="flex items-center gap-1 flex-shrink-0" title={`Проверяющий: ${reviewerEmp.name}`}><Eye className="w-2.5 h-2.5 text-muted-foreground/50" /><EmpAvatar name={reviewerEmp.name || reviewerEmp.email} size="xs" /></div>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DraggableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: props.task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, zIndex: 999 } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-40' : ''}>
      <TaskCard {...props} dragHandleListeners={listeners} dragHandleAttributes={attributes} />
    </div>
  );
}

function DroppableColumn({ id, label, color, count, emptyText, children }: {
  id: string; label: string; color: string; count: number; emptyText: string; children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex flex-col rounded-xl p-2 min-h-[200px] transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/30' : 'bg-muted/20'}`}>
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge variant="secondary" className="ml-auto text-xs h-5">{count}</Badge>
      </div>
      <div className="flex-1 space-y-2">
        {children}
        {count === 0 && <div className="border-2 border-dashed border-muted rounded-xl p-5 text-center text-xs text-muted-foreground/50">{emptyText}</div>}
      </div>
    </div>
  );
}

const KANBAN_COLS = [
  { id: 'todo',        label: 'К выполнению', color: 'bg-slate-400',  emptyText: 'Перетащите задачи сюда' },
  { id: 'in_progress', label: 'В работе',     color: 'bg-blue-500',   emptyText: 'Нет активных задач' },
  { id: 'in_review',   label: 'На проверке',  color: 'bg-purple-500', emptyText: 'Нет задач на проверке' },
  { id: 'done',        label: 'Готово',       color: 'bg-green-500',  emptyText: 'Нет выполненных задач' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Tasks({ projectId, embedded }: { projectId?: string; embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks();
  const { employees = [] } = useEmployees();
  const { projects = [], updateProject: updateProjectRecord } = useProjects();

  const [searchTerm, setSearchTerm]         = useState('');
  const [filterStatus, setFilterStatus]     = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProject, setFilterProject]   = useState(projectId || 'all');
  const [showMyTasks, setShowMyTasks]       = useState(false);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editingTask, setEditingTask]       = useState<Task | null>(null);
  const [form, setForm]                     = useState<TaskForm>({ ...defaultForm });
  const [saving, setSaving]                 = useState(false);
  const [taskToDelete, setTaskToDelete]     = useState<Task | null>(null);
  const [activeTaskId, setActiveTaskId]     = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const canAssignToOthers = user && ['ceo','admin','deputy_director','partner','manager_1','manager_2','manager_3'].includes(user.role);
  const canDeleteAnyTask  = user && ['ceo','admin','deputy_director'].includes(user.role);
  const myEmployee = useMemo(() => (employees as any[]).find(e => e.email === user?.email || e.id === user?.id), [employees, user]);
  const selectableEmps = useMemo(() => {
    if (!canAssignToOthers) return myEmployee ? [myEmployee] : [];
    if (user?.role === 'ceo' || user?.role === 'admin') return employees;
    return (employees as any[]).filter(e => !['ceo','deputy_director'].includes(e.role));
  }, [canAssignToOthers, employees, myEmployee, user?.role]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (showMyTasks && myEmployee && !t.assignees.includes(myEmployee.id)) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterProject === '__none__' && t.project_id) return false;
    if (filterProject !== 'all' && filterProject !== '__none__' && t.project_id !== filterProject) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const names = (t.assignees || []).map(id => { const e = (employees as any[]).find(e => e.id === id); return e?.name || ''; });
      return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || names.some(n => n.toLowerCase().includes(q));
    }
    return true;
  }), [tasks, searchTerm, filterStatus, filterPriority, filterProject, showMyTasks, myEmployee, employees]);

  const tasksByStatus = useMemo(() => ({
    todo:        filteredTasks.filter(t => t.status === 'todo' || t.status === 'backlog'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    in_review:   filteredTasks.filter(t => t.status === 'in_review'),
    done:        filteredTasks.filter(t => t.status === 'done'),
  }), [filteredTasks]);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo' || t.status === 'backlog').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    myTasks: myEmployee ? tasks.filter(t => t.assignees.includes(myEmployee.id)).length : 0,
  }), [tasks, myEmployee]);

  const openCreate = useCallback(() => {
    setEditingTask(null);
    setForm({ ...defaultForm, mainAssignee: myEmployee?.id || '', project_id: projectId || '' });
    setDialogOpen(true);
  }, [myEmployee, projectId]);

  const openEdit = useCallback((task: Task) => {
    setEditingTask(task);
    const reviewerId = getReviewerId(task);
    const coIds = task.assignees?.slice(1) || [];
    setForm({
      title:        task.title,
      description:  task.description || '',
      project_id:   task.project_id || '',
      mainAssignee: task.assignees?.[0] || '',
      coAssignees:  coIds,
      reviewer:     reviewerId,
      priorityVal:  priorityToVal(task.priority),
      due_at:       task.due_at ? task.due_at.split('T')[0] : '',
      wantCoAssignees: coIds.length > 0,
      wantReviewer:    !!reviewerId,
      wantAttachment:  !!task.labels?.includes('requires_attachment'),
      pendingFiles:    [],
    });
    setDialogOpen(true);
  }, []);

  const getTaskActionUrl = useCallback((targetProjectId?: string | null) => (
    targetProjectId ? `/project/${targetProjectId}` : '/tasks'
  ), []);

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: '❌ Укажите название задачи', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const allAssignees = [
        ...(form.mainAssignee ? [form.mainAssignee] : []),
        ...(form.wantCoAssignees ? form.coAssignees.filter(id => id !== form.mainAssignee) : []),
      ];
      const labels: string[] = [];
      if (form.wantReviewer && form.reviewer) labels.push(`reviewer:${form.reviewer}`);
      if (form.wantAttachment) labels.push('requires_attachment');

      const payload: Partial<Task> = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        project_id:  form.project_id || null,
        assignees:   allAssignees,
        labels,
        priority:    valToPriority(form.priorityVal),
        status:      editingTask?.status || 'todo',
        due_at:      form.due_at ? new Date(form.due_at).toISOString() : null,
      };

      if (editingTask) {
        const updatedTask = await updateTask(editingTask.id, payload);
        const prev = new Set([...(editingTask.assignees || []), getReviewerId(editingTask)].filter(Boolean));
        for (const id of [...allAssignees, form.reviewer].filter(id => id && !prev.has(id))) {
          if (id !== myEmployee?.id) await addNotification({ user_id: id, title: '📝 Вас назначили на задачу', message: `${user?.name} назначил вас на задачу «${form.title}»`, type: 'info', action_url: getTaskActionUrl(updatedTask.project_id) });
        }
        await syncProjectStatus(updatedTask.project_id, tasks.map((task) => task.id === updatedTask.id ? updatedTask : task));
        toast({ title: '✅ Задача обновлена' });
      } else {
        const createdTask = await createTask(payload);
        const dl = form.due_at ? `. Дедлайн: ${format(new Date(form.due_at), 'dd MMM yyyy', { locale: ru })}` : '';
        for (const id of [...allAssignees, form.wantReviewer ? form.reviewer : ''].filter(id => id && id !== myEmployee?.id)) {
          await addNotification({ user_id: id, title: '📋 Вам назначена задача', message: `${user?.name} назначил вам задачу «${form.title}»${dl}`, type: 'info', action_url: getTaskActionUrl(createdTask.project_id) });
        }
        await syncProjectStatus(createdTask.project_id, [createdTask, ...tasks]);
        toast({ title: '✅ Задача создана' });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: '❌ Ошибка', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete.id);
      await syncProjectStatus(taskToDelete.project_id, tasks.filter((task) => task.id !== taskToDelete.id));
      setTaskToDelete(null);
      toast({ title: '✅ Задача удалена' });
    }
    catch (err: any) { toast({ title: '❌ Ошибка', description: err.message, variant: 'destructive' }); }
  };

  const canDeleteTask = (task: Task) => !!canDeleteAnyTask || task.reporter === myEmployee?.id;

  const handleDragStart = ({ active }: DragStartEvent) => setActiveTaskId(active.id as string);
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTaskId(null);
    if (!over) return;
    const s = over.id as Task['status'];
    if (!['todo','in_progress','in_review','done'].includes(s)) return;
    const task = tasks.find(t => t.id === (active.id as string));
    if (task && task.status !== s) {
      const updatedTask = await updateTask(task.id, { status: s });
      await syncProjectStatus(updatedTask.project_id, tasks.map((item) => item.id === updatedTask.id ? updatedTask : item));
    }
  };
  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const currentPL = PRIORITY_LEVELS.find(p => p.val === form.priorityVal) || PRIORITY_LEVELS[1];

  const syncProjectStatus = useCallback(async (targetProjectId: string | null | undefined, nextTasks: Task[]) => {
    if (!targetProjectId) return;

    const project = (projects as any[]).find((item) => item.id === targetProjectId);
    if (!project) return;

    const projectTasks = nextTasks.filter((task) => task.project_id === targetProjectId);
    const currentStatus = project?.notes?.status || project?.status;
    const derivedStatus = deriveProjectStatusFromTasks(currentStatus, projectTasks);

    if (derivedStatus === currentStatus) return;

    await updateProjectRecord(targetProjectId, {
      status: derivedStatus,
      completionPercent: projectTasks.length > 0
        ? Math.round((projectTasks.filter((task) => isTaskDoneStatus(task.status)).length / projectTasks.length) * 100)
        : 0,
    });

    if (derivedStatus === 'pending_payment_approval') {
      const approvers = (employees as any[]).filter((employee) => ['ceo', 'admin'].includes(employee.role));
      await Promise.all(approvers.map((employee) => addNotification({
        user_id: employee.id,
        title: 'Проект готов к финальному утверждению',
        message: `Все задачи по проекту «${project.name || 'Без названия'}» выполнены. Проверьте бонусы и закройте проект.`,
        type: 'success',
        action_url: '/bonuses',
      })));
    }
  }, [employees, projects, updateProjectRecord]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 page-enter">
      {/* Header */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><CheckSquare className="w-5 h-5 text-primary" /></span>
              Задачи
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {stats.total > 0 ? `${stats.inProgress} в работе · ${stats.todo} ожидают · ${stats.done} выполнено` : 'Нет задач'}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 self-start sm:self-auto"><Plus className="w-4 h-4" />Новая задача</Button>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {stats.total > 0 ? `${stats.inProgress} в работе · ${stats.todo} ожидают · ${stats.done} выполнено` : 'Задач пока нет'}
          </p>
          <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />Новая задача</Button>
        </div>
      )}

      {/* Stats */}
      {!embedded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Всего',    value: stats.total,      icon: ListChecks,   color: 'text-primary',   bg: 'bg-primary/10' },
            { label: 'Ожидают', value: stats.todo,        icon: Circle,       color: 'text-slate-500', bg: 'bg-slate-500/10' },
            { label: 'В работе',value: stats.inProgress,  icon: Clock,        color: 'text-blue-500',  bg: 'bg-blue-500/10' },
            { label: 'Готово',  value: stats.done,        icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Мои',     value: stats.myTasks,     icon: User,         color: 'text-purple-500',bg: 'bg-purple-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="p-4 border-0 shadow-sm bg-card">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${color}`} /></div>
                <div><p className="text-2xl font-bold leading-none">{value}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-3 sm:p-4 border-0 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Поиск по задачам и исполнителям..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-muted/40 border-0 focus-visible:ring-1" />
            {searchTerm && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm('')}><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-muted/40 border-0 text-sm w-[140px] h-9"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="todo">К выполнению</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="in_review">На проверке</SelectItem>
                <SelectItem value="done">Готово</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="bg-muted/40 border-0 text-sm w-[130px] h-9"><SelectValue placeholder="Приоритет" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="critical">🔴 Критичный</SelectItem>
                <SelectItem value="high">🟠 Высокий</SelectItem>
                <SelectItem value="med">🟡 Средний</SelectItem>
                <SelectItem value="low">⚪ Низкий</SelectItem>
              </SelectContent>
            </Select>
            {!embedded && (
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="bg-muted/40 border-0 text-sm w-[140px] h-9"><SelectValue placeholder="Проект" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  <SelectItem value="__none__">Без проекта</SelectItem>
                  {(projects as any[]).slice(0, 30).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{(p.name || 'Без названия').slice(0, 40)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant={showMyTasks ? 'default' : 'outline'} size="sm" className="gap-1.5 h-9" onClick={() => setShowMyTasks(v => !v)}>
              <User className="w-3.5 h-3.5" />Мои
            </Button>
          </div>
        </div>
      </Card>

      {/* Views */}
      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="list"   className="gap-1.5"><List   className="w-3.5 h-3.5" />Список</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5"><Kanban className="w-3.5 h-3.5" />Канбан</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-2">
          {loading ? <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
          : filteredTasks.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-sm">
              <CheckSquare className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">Задачи не найдены</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Создайте задачу или измените фильтры</p>
              <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="w-4 h-4" />Создать задачу</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => {
                const mainEmp = employees.find((e: any) => e.id === task.assignees?.[0]) as any;
                const reviewerEmp = employees.find((e: any) => e.id === getReviewerId(task)) as any;
                const project = task.project_id ? (projects as any[]).find(p => p.id === task.project_id) : null;
                const isOverdue = task.due_at && task.status !== 'done' && isPast(parseISO(task.due_at));
                const pl = PRIORITY_LEVELS.find(p => p.key === task.priority) || PRIORITY_LEVELS[1];
                return (
                  <Card key={task.id} className="border-0 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                    <div className={`h-0.5 ${pl.bar}`} />
                    <div className="p-4 flex items-start gap-3">
                      <div className={`w-1 self-stretch min-h-[40px] rounded-full flex-shrink-0 ${STATUS_COLORS[task.status] || 'bg-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-semibold text-sm leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(task)}><Edit className="w-3.5 h-3.5" /></Button>
                            {canDeleteTask(task) && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setTaskToDelete(task)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                          </div>
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                        <div className="flex items-center gap-3 flex-wrap mt-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[11px] text-white font-medium ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${pl.text}`}><span className={`w-2 h-2 rounded-full ${pl.dot}`} />{pl.label}</span>
                          {project && <span className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /><span className="truncate max-w-[100px]">{project.name}</span></span>}
                          {task.due_at && <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}><CalendarDays className="w-3 h-3" />{format(parseISO(task.due_at), 'dd MMM yyyy', { locale: ru })}{isOverdue && ' ⚠'}</span>}
                          {mainEmp && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <EmpAvatar name={mainEmp.name || mainEmp.email} size="xs" />
                              <span className="text-xs text-muted-foreground">{mainEmp.name}</span>
                              {reviewerEmp && <><Eye className="w-3 h-3 text-muted-foreground/50 ml-1" /><EmpAvatar name={reviewerEmp.name} size="xs" /></>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-2">
          {loading ? <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div> : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {KANBAN_COLS.map(col => {
                  const colTasks = (tasksByStatus as any)[col.id] || [];
                  return (
                    <DroppableColumn key={col.id} id={col.id} label={col.label} color={col.color} count={colTasks.length} emptyText={col.emptyText}>
                      {colTasks.map((task: Task) => (
                        <DraggableTaskCard key={task.id} task={task} employees={employees} projects={projects} onEdit={openEdit} onDelete={setTaskToDelete} canDelete={canDeleteTask(task)} />
                      ))}
                    </DroppableColumn>
                  );
                })}
              </div>
              <DragOverlay>
                {activeTask && <div className="shadow-2xl rotate-1 opacity-95 pointer-events-none"><TaskCard task={activeTask} employees={employees} projects={projects} onEdit={() => {}} onDelete={() => {}} canDelete={false} /></div>}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>

      {/* ── DIALOG ─────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <DialogTitle className="text-sm font-semibold text-muted-foreground">
              {editingTask ? 'Редактировать задачу' : 'Новая задача'}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">

            {/* Title */}
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Название задачи..."
              autoFocus
              className="w-full text-[17px] font-semibold bg-transparent outline-none placeholder:text-muted-foreground/40 border-0"
            />

            {/* Description */}
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Описание..."
              rows={2}
              className="resize-none text-sm border-0 bg-transparent p-0 focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/30 min-h-0"
            />

            <div className="h-px bg-border/50" />

            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Исполнитель</label>
              <EmpSearch
                value={form.mainAssignee}
                onChange={v => setForm(f => ({ ...f, mainAssignee: v }))}
                employees={selectableEmps}
                placeholder="Начните вводить имя..."
                exclude={[form.reviewer]}
              />
            </div>

            {/* Deadline + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Дедлайн</label>
                <Input type="date" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Приоритет</label>
                <div className="flex gap-1">
                  {PRIORITY_LEVELS.map(pl => (
                    <button key={pl.val} type="button" title={pl.label}
                      onClick={() => setForm(f => ({ ...f, priorityVal: pl.val }))}
                      className={`flex-1 h-9 rounded-lg border-2 transition-all flex items-center justify-center ${form.priorityVal === pl.val ? `${pl.dot} border-transparent` : 'border-border hover:border-muted-foreground/40 bg-transparent'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${form.priorityVal === pl.val ? 'bg-white' : pl.dot}`} />
                    </button>
                  ))}
                </div>
                <p className={`text-xs font-medium text-center ${currentPL.text}`}>{currentPL.label}</p>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Optional toggles */}
            <div className="space-y-3">
              {/* Co-assignees */}
              <div>
                <OptionalToggle
                  checked={form.wantCoAssignees}
                  onChange={v => setForm(f => ({ ...f, wantCoAssignees: v, coAssignees: v ? f.coAssignees : [] }))}
                  label="Добавить соисполнителей"
                  icon={Users}
                />
                {form.wantCoAssignees && (
                  <div className="mt-2 ml-6">
                    <CoAssigneesPicker
                      employees={selectableEmps}
                      selected={form.coAssignees}
                      onChange={ids => setForm(f => ({ ...f, coAssignees: ids }))}
                      exclude={[form.mainAssignee, form.reviewer].filter(Boolean)}
                    />
                  </div>
                )}
              </div>

              {/* Reviewer */}
              <div>
                <OptionalToggle
                  checked={form.wantReviewer}
                  onChange={v => setForm(f => ({ ...f, wantReviewer: v, reviewer: v ? f.reviewer : '' }))}
                  label="Назначить проверяющего"
                  icon={Eye}
                />
                {form.wantReviewer && (
                  <div className="mt-2 ml-6">
                    <EmpSearch
                      value={form.reviewer}
                      onChange={v => setForm(f => ({ ...f, reviewer: v }))}
                      employees={selectableEmps}
                      placeholder="Кто проверяет результат..."
                      exclude={[form.mainAssignee]}
                    />
                  </div>
                )}
              </div>

              {/* Attachment */}
              <OptionalToggle
                checked={form.wantAttachment}
                onChange={v => setForm(f => ({ ...f, wantAttachment: v }))}
                label="Требуется вложение / результат"
                icon={Paperclip}
              />
            </div>

            {/* Project (collapsed by default in optional) */}
            {canAssignToOthers && (
              <>
                <div className="h-px bg-border/50" />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Проект (необязательно)</label>
                  <Select value={form.project_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, project_id: v === '__none__' ? '' : v }))}>
                    <SelectTrigger className="h-9 text-sm border-border/50"><SelectValue placeholder="— Без проекта —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Без проекта —</SelectItem>
                      {(projects as any[]).slice(0, 40).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{(p.name || 'Без названия').slice(0, 50)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border/50 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Создаём...' : editingTask ? 'Сохранить' : 'Создать задачу'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>Задача «{taskToDelete?.title}» будет удалена безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

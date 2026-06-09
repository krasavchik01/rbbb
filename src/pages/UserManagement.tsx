import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Pencil, UserPlus, Users, Shield, Search, FileText, Briefcase, Clock3, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserRole, ROLE_LABELS, normalizeUserRole, getLevelForUserRole, getEmployeeDbRoleForUserRole } from "@/types/roles";
import { Database } from "@/integrations/supabase/types";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";

type DbAppRole = Database['public']['Enums']['app_role'];
type DbEmployeeLevel = Database['public']['Enums']['employee_level'];

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: DbAppRole;
  level: DbEmployeeLevel;
  whatsapp: string | null;
  created_at: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: DbAppRole;
  department: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface AttendanceRow {
  id: string;
  employee_id: string | null;
  date: string | null;
  status: string | null;
  location_type: string | null;
  notes: string | null;
  project_name: string | null;
  project_id: string | null;
  created_at: string | null;
}

const ALL_ROLES: { value: UserRole; label: string; adminOnly?: boolean }[] = [
  // Административные роли (только админ может назначать)
  { value: 'ceo', label: ROLE_LABELS.ceo, adminOnly: true },
  { value: 'deputy_director', label: ROLE_LABELS.deputy_director, adminOnly: true },
  { value: 'company_director', label: ROLE_LABELS.company_director, adminOnly: true },
  { value: 'procurement', label: ROLE_LABELS.procurement, adminOnly: true },
  { value: 'partner', label: ROLE_LABELS.partner, adminOnly: true },
  { value: 'hr', label: ROLE_LABELS.hr, adminOnly: true },
  { value: 'admin', label: ROLE_LABELS.admin, adminOnly: true },
  // Рабочие роли
  { value: 'manager_1', label: ROLE_LABELS.manager_1 },
  { value: 'manager_2', label: ROLE_LABELS.manager_2 },
  { value: 'manager_3', label: ROLE_LABELS.manager_3 },
  { value: 'supervisor_1', label: ROLE_LABELS.supervisor_1 },
  { value: 'supervisor_2', label: ROLE_LABELS.supervisor_2 },
  { value: 'supervisor_3', label: ROLE_LABELS.supervisor_3 },
  { value: 'assistant_1', label: ROLE_LABELS.assistant_1 },
  { value: 'assistant_2', label: ROLE_LABELS.assistant_2 },
  { value: 'assistant_3', label: ROLE_LABELS.assistant_3 },
  { value: 'tax_specialist_1', label: ROLE_LABELS.tax_specialist_1 },
  { value: 'tax_specialist_2', label: ROLE_LABELS.tax_specialist_2 },
  { value: 'accountant', label: ROLE_LABELS.accountant },
  { value: 'contractor', label: ROLE_LABELS.contractor },
];

function normalizeText(value: unknown): string {
  return String(value || '').toLowerCase();
}

function getEmployeeRoleLabel(employee: Employee): string {
  return getRoleLabel(employee.role, employee.level);
}

function employeeSearchText(employee: Employee): string {
  return [
    employee.name,
    employee.email,
    employee.whatsapp,
    employee.role,
    employee.level,
    getEmployeeRoleLabel(employee),
  ].map(normalizeText).join(' ');
}

function statusLabel(status: string | null | undefined): string {
  const value = normalizeText(status);
  const map: Record<string, string> = {
    in_office: 'В офисе',
    remote: 'Удалённо',
    on_project: 'На проекте',
    vacation: 'Отпуск',
    sick_leave: 'Больничный',
    day_off: 'Выходной',
    present: 'На работе',
    late: 'Опоздание',
    absent: 'Отсутствует',
  };
  return map[value] || (status || '—');
}

function attendancePriority(row: AttendanceRow): number {
  const raw = normalizeText(row.status || row.location_type);
  if (raw.includes('vacation')) return 5;
  if (raw.includes('sick')) return 4;
  if (raw.includes('day_off')) return 3;
  if (raw.includes('project') || raw.includes('on_project')) return 2;
  if (raw.includes('remote')) return 1;
  return 0;
}


export default function UserManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("employees");
  const { projects = [] } = useProjects();
  const { tasks = [] } = useTasks();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "assistant_1" as UserRole,
    level: "1" as DbEmployeeLevel,
    phone: "",
    department: "",
    password: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchProfiles();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить сотрудников",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!selectedEmployeeId) {
      setAttendanceRows([]);
      return;
    }

    const loadEmployeeAttendance = async () => {
      setAttendanceLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('id, employee_id, date, status, location_type, notes, project_name, project_id, created_at')
          .eq('employee_id', selectedEmployeeId)
          .order('date', { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!cancelled) setAttendanceRows((data || []) as AttendanceRow[]);
      } catch (err) {
        console.error('Error loading employee attendance:', err);
        if (!cancelled) setAttendanceRows([]);
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    };

    void loadEmployeeAttendance();
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  const handleCreateEmployee = async () => {

    if (!formData.name || !formData.email) {
      setError("Заполните ФИО и Email");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Проверяем уникальность email
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', formData.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        setError("Сотрудник с таким email уже существует");
        setLoading(false);
        return;
      }

      // Определяем уровень из роли
      const level = getLevelForUserRole(formData.role) as DbEmployeeLevel;

      const dbRole = getEmployeeDbRoleForUserRole(formData.role) as DbAppRole;

      const insertPayload: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: dbRole,
        level: level,
        whatsapp: formData.phone || null,
      };
      if (formData.password.trim()) insertPayload.password = formData.password.trim();

      const { error: insertError } = await supabase
        .from('employees')
        .insert(insertPayload);

      if (insertError) throw insertError;

      toast({
        title: "Сотрудник создан",
        description: `${formData.name} успешно добавлен в систему`,
      });

      resetForm();
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !formData.name) {
      setError("Заполните ФИО");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Определяем уровень из роли
      const level = getLevelForUserRole(formData.role) as DbEmployeeLevel;

      const dbRole = getEmployeeDbRoleForUserRole(formData.role) as DbAppRole;

      const updatePayload: any = {
        name: formData.name.trim(),
        email: formData.email?.trim().toLowerCase() || null,
        role: dbRole,
        level: level,
        whatsapp: formData.phone || null,
      };
      if (formData.password.trim()) updatePayload.password = formData.password.trim();

      const { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', editingEmployee.id);

      if (error) throw error;

      toast({
        title: "Сотрудник обновлён",
        description: "Данные успешно изменены",
      });

      resetForm();
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Удалить сотрудника ${employee.name}?`)) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: "Сотрудник удалён",
        description: `${employee.name} удалён из системы`,
      });

      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "assistant_1" as UserRole,
      level: "1" as DbEmployeeLevel,
      phone: "",
      department: "",
      password: "",
    });
    setEditingEmployee(null);
    setError("");
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);

    // Пытаемся определить роль из БД роли и уровня
    let appRole: UserRole = normalizeUserRole(employee.role, employee.level);
    const dbRole = employee.role as string;

    // Прямые роли (сохраняются как есть)
    if (dbRole === 'ceo') {
      appRole = 'ceo';
    } else if (dbRole === 'deputy_director') {
      appRole = 'deputy_director';
    } else if (dbRole === 'hr') {
      appRole = 'hr';
    } else if (dbRole === 'procurement') {
      appRole = 'procurement';
    } else if (dbRole === 'partner') {
      appRole = 'partner';
    } else if (dbRole === 'admin') {
      appRole = 'admin';
    } else if (dbRole === 'accountant') {
      appRole = 'accountant';
    } else if (dbRole === 'contractor') {
      appRole = 'contractor';
    // Роли с уровнями
    } else if (dbRole === 'assistant') {
      appRole = `assistant_${employee.level}` as UserRole;
    } else if (dbRole === 'manager') {
      appRole = `manager_${employee.level}` as UserRole;
    } else if (dbRole === 'supervisor') {
      appRole = `supervisor_${employee.level}` as UserRole;
    } else if (dbRole === 'tax_specialist') {
      appRole = `tax_specialist_${employee.level}` as UserRole;
    }

    setFormData({
      name: employee.name,
      email: employee.email || "",
      role: appRole,
      level: employee.level,
      phone: employee.whatsapp || "",
      department: "",
      password: "",
    });
    setIsDialogOpen(true);
  };

  const getRoleLabel = (dbRole: string, level: string) => {
    // Прямые роли без уровня
    const directRoles: Record<string, string> = {
      'ceo': 'CEO / Генеральный директор',
      'deputy_director': 'Заместитель директора',
      'hr': 'HR специалист',
      'procurement': 'Отдел закупок',
      'partner': 'Партнер',
      'admin': 'Администратор',
      'accountant': 'Бухгалтер',
      'contractor': 'ГПХ (Подрядчик)',
    };

    if (directRoles[dbRole]) {
      return directRoles[dbRole];
    }

    // Роли с уровнями
    const roleKey = `${dbRole}_${level}`;
    const found = ALL_ROLES.find(r => r.value === roleKey);
    if (found) return found.label;

    // Если не нашли с уровнем, ищем без
    const foundSimple = ALL_ROLES.find(r => r.value === dbRole);
    if (foundSimple) return foundSimple.label;

    return dbRole;
  };

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) => employeeSearchText(employee).includes(q));
  }, [employees, searchTerm]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  const selectedEmployeeTasks = useMemo(() => {
    if (!selectedEmployee) return [];
    return tasks.filter((task: any) => Array.isArray(task.assignees) && task.assignees.includes(selectedEmployee.id));
  }, [tasks, selectedEmployee]);

  const selectedEmployeeProjects = useMemo(() => {
    const ids = new Set<string>();
    const list: Array<{ id: string; name: string; status: string | null }> = [];
    for (const task of selectedEmployeeTasks as any[]) {
      if (!task.project_id || ids.has(task.project_id)) continue;
      ids.add(task.project_id);
      const project = projects.find((p: any) => p.id === task.project_id);
      list.push({
        id: task.project_id,
        name: project?.name || task.project?.name || 'Проект без названия',
        status: project?.status || null,
      });
    }
    return list;
  }, [projects, selectedEmployeeTasks]);

  const latestAttendance = useMemo(() => {
    return [...attendanceRows]
      .sort((a, b) => {
        const aDate = String(a.date || a.created_at || '');
        const bDate = String(b.date || b.created_at || '');
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return attendancePriority(b) - attendancePriority(a);
      })[0] || null;
  }, [attendanceRows]);

  const taskBuckets = useMemo(() => {
    const summary = { in_progress: 0, in_review: 0, todo: 0, blocked: 0, done: 0 } as Record<string, number>;
    for (const task of selectedEmployeeTasks as any[]) {
      const status = String(task.status || '').toLowerCase();
      if (summary[status] !== undefined) summary[status] += 1;
    }
    return summary;
  }, [selectedEmployeeTasks]);

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    if (role === 'ceo' || role === 'deputy_director') return 'destructive';
    if (role === 'admin' || role === 'partner') return 'destructive';
    if (role === 'hr' || role === 'procurement') return 'secondary';
    if (role === 'manager' || role === 'supervisor') return 'default';
    if (role === 'tax_specialist') return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Управление пользователями</h1>
          <p className="text-muted-foreground">Создание, редактирование и назначение ролей</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient" onClick={resetForm}>
              <UserPlus className="w-4 h-4 mr-2" />
              Добавить сотрудника
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Редактировать сотрудника' : 'Создать сотрудника'}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Изменение данных и роли сотрудника' : 'Добавление нового сотрудника в систему'}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">ФИО *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@rbpartners.com"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Роль / Должность *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                      Административные роли
                    </div>
                    {ALL_ROLES.filter(r => r.adminOnly).map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3 text-red-500" />
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted mt-1">
                      Рабочие роли
                    </div>
                    {ALL_ROLES.filter(r => !r.adminOnly).map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Роли с иконкой <Shield className="w-3 h-3 inline text-red-500" /> - административные
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон (WhatsApp)</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+7 (xxx) xxx-xx-xx"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                <Label htmlFor="password">{editingEmployee ? 'Новый пароль' : 'Пароль'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingEmployee ? 'Оставьте пустым, если пароль не меняется' : 'Задайте пароль для входа'}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {editingEmployee
                    ? 'Если заполнить поле и нажать «Сохранить», пароль сотрудника будет заменён.'
                    : 'Если оставить пустым, сотрудник будет создан без отдельного пароля в employees.password.'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>
                Отмена
              </Button>
              <Button
                onClick={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
                disabled={loading}
                className="btn-gradient"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEmployee ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="w-4 h-4" />
            Сотрудники ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-2">
            <Shield className="w-4 h-4" />
            Профили Supabase ({profiles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Сотрудники системы</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Поиск, фильтрация и быстрый переход в карточку сотрудника.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[360px]">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Поиск: ФИО, email, телефон, роль..."
                        className="pl-9"
                      />
                    </div>
                    <Badge variant="secondary" className="justify-center whitespace-nowrap px-3 py-2">
                      {filteredEmployees.length} / {employees.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading && employees.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    {employees.length === 0 ? 'Нет сотрудников. Добавьте первого сотрудника.' : 'По запросу ничего не найдено.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ФИО</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Роль</TableHead>
                          <TableHead>Уровень</TableHead>
                          <TableHead>Телефон</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => {
                          const isSelected = selectedEmployeeId === employee.id;
                          return (
                            <TableRow
                              key={employee.id}
                              className={isSelected ? 'bg-primary/5' : 'cursor-pointer hover:bg-muted/50'}
                              onClick={() => setSelectedEmployeeId(employee.id)}
                            >
                              <TableCell className="font-medium">{employee.name}</TableCell>
                              <TableCell>{employee.email || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(employee.role)}>
                                  {getRoleLabel(employee.role, employee.level)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">Уровень {employee.level}</Badge>
                              </TableCell>
                              <TableCell>{employee.whatsapp || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEmployeeId(employee.id);
                                    }}
                                    title="Открыть карточку"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(employee);
                                    }}
                                    title="Редактировать"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEmployee(employee);
                                    }}
                                    title="Удалить"
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card h-fit">
              <CardHeader>
                <CardTitle>Личное дело</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedEmployee ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Выберите сотрудника в таблице слева, чтобы увидеть его загрузку, проекты и последние отметки.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedEmployee.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedEmployee.email || 'Email не указан'}</p>
                        </div>
                        <Badge variant={getRoleBadgeVariant(selectedEmployee.role)}>
                          {getRoleLabel(selectedEmployee.role, selectedEmployee.level)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-background p-3">
                          <p className="text-xs text-muted-foreground">Уровень</p>
                          <p className="font-semibold">{selectedEmployee.level}</p>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <p className="text-xs text-muted-foreground">Телефон</p>
                          <p className="font-semibold">{selectedEmployee.whatsapp || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-background p-3 col-span-2">
                          <p className="text-xs text-muted-foreground">Создан</p>
                          <p className="font-semibold">{selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleString('ru-RU') : '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Задач в работе</p>
                        <p className="text-2xl font-bold">{taskBuckets.in_progress + taskBuckets.in_review}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Всего задач</p>
                        <p className="text-2xl font-bold">{selectedEmployeeTasks.length}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Проектов</p>
                        <p className="text-2xl font-bold">{selectedEmployeeProjects.length}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Сегодня</p>
                        <p className="text-sm font-semibold">{attendanceLoading ? 'Загрузка...' : latestAttendance ? statusLabel(latestAttendance.status || latestAttendance.location_type) : 'Нет отметки'}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4" />
                        Сейчас занят
                      </div>
                      {selectedEmployeeTasks.filter((task: any) => ['in_progress', 'in_review', 'todo'].includes(String(task.status || '').toLowerCase())).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Нет активных задач.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedEmployeeTasks
                            .filter((task: any) => ['in_progress', 'in_review', 'todo'].includes(String(task.status || '').toLowerCase()))
                            .slice(0, 4)
                            .map((task: any) => (
                              <div key={task.id} className="rounded-lg border p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <Badge variant="outline">{task.status}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {task.project_id ? (projects.find((p: any) => p.id === task.project_id)?.name || 'Проект') : 'Без проекта'}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Briefcase className="h-4 w-4" />
                        Проекты
                      </div>
                      {selectedEmployeeProjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Пока не привязан к активным проектам через задачи.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedEmployeeProjects.slice(0, 6).map((project) => (
                            <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate">{project.name}</span>
                              {project.status ? <Badge variant="secondary">{project.status}</Badge> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Clock3 className="h-4 w-4" />
                        Последние отметки
                      </div>
                      {attendanceLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Загружаем...
                        </div>
                      ) : attendanceRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Нет данных посещаемости.</p>
                      ) : (
                        <div className="space-y-2">
                          {attendanceRows.slice(0, 5).map((row) => (
                            <div key={row.id} className="rounded-lg border p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{row.date || '—'}</span>
                                <Badge variant="outline">{statusLabel(row.status || row.location_type)}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{row.notes || row.project_name || 'Без примечаний'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="profiles">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Профили Supabase Auth</CardTitle>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет профилей Supabase Auth
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Отдел</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.display_name}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(profile.role)}>
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{profile.department || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={profile.is_active ? "default" : "secondary"}>
                            {profile.is_active ? 'Активен' : 'Заблокирован'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}

import { useState, useEffect } from "react";
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
import { Loader2, Pencil, UserPlus, Users, Shield, Eye, EyeOff, Key, Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserRole, ROLE_LABELS } from "@/types/roles";
import { Database } from "@/integrations/supabase/types";

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

// Все роли системы для админки
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

// Маппинг ролей приложения на роли БД (теперь сохраняем точные роли)
const roleToDbRole: Record<string, DbAppRole> = {
  'ceo': 'ceo' as DbAppRole,
  'deputy_director': 'deputy_director' as DbAppRole,
  'company_director': 'partner',
  'procurement': 'procurement' as DbAppRole,
  'partner': 'partner',
  'hr': 'hr' as DbAppRole,
  'admin': 'admin',
  'manager_1': 'manager',
  'manager_2': 'manager',
  'manager_3': 'manager',
  'supervisor_1': 'supervisor' as DbAppRole,
  'supervisor_2': 'supervisor' as DbAppRole,
  'supervisor_3': 'supervisor' as DbAppRole,
  'assistant_1': 'assistant',
  'assistant_2': 'assistant',
  'assistant_3': 'assistant',
  'tax_specialist_1': 'tax_specialist',
  'tax_specialist_2': 'tax_specialist',
  'accountant': 'accountant' as DbAppRole,
  'contractor': 'contractor' as DbAppRole,
};


export default function UserManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("employees");
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

  // Управление паролями
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Демо-пароли (в реальном приложении это было бы в базе данных)
  const [demoPasswords, setDemoPasswords] = useState<Record<string, string>>({
    'ceo@rbpartners.com': 'ceo',
    'deputy@mak.kz': 'deputy',
    'procurement@rbpartners.com': 'procurement',
    'partner@rbpartners.com': 'partner',
    'manager@rbpartners.com': 'manager',
    'manager2@rbpartners.com': 'manager2',
    'manager3@rbpartners.com': 'manager3',
    'supervisor@rbpartners.com': 'supervisor',
    'supervisor1@rbpartners.com': 'supervisor1',
    'supervisor2@rbpartners.com': 'supervisor2',
    'assistant@rbpartners.com': 'assistant',
    'assistant1@rbpartners.com': 'assistant1',
    'assistant2@rbpartners.com': 'assistant2',
    'tax@rbpartners.com': 'tax',
    'admin': 'admin',
  });

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
      let level: DbEmployeeLevel = '1';
      if (formData.role.includes('_1')) level = '1';
      else if (formData.role.includes('_2')) level = '2';
      else if (formData.role.includes('_3')) level = '3';

      const dbRole = roleToDbRole[formData.role] || 'employee';

      const { error: insertError } = await supabase
        .from('employees')
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: dbRole,
          level: level,
          whatsapp: formData.phone || null,
        });

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
      let level: DbEmployeeLevel = '1';
      if (formData.role.includes('_1')) level = '1';
      else if (formData.role.includes('_2')) level = '2';
      else if (formData.role.includes('_3')) level = '3';

      const dbRole = roleToDbRole[formData.role] || 'employee';

      const { error } = await supabase
        .from('employees')
        .update({
          name: formData.name.trim(),
          email: formData.email?.trim().toLowerCase() || null,
          role: dbRole,
          level: level,
          whatsapp: formData.phone || null,
        })
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

  // Функции для управления паролями
  const getPasswordForEmail = (email: string | null): string => {
    if (!email) return '—';
    return demoPasswords[email] || demoPasswords[email.toLowerCase()] || '—';
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast({
      title: "Скопировано",
      description: "Пароль скопирован в буфер обмена",
    });
  };

  const openPasswordDialog = (employee: Employee) => {
    setSelectedEmployeeForPassword(employee);
    setNewPassword(getPasswordForEmail(employee.email));
    setPasswordDialogOpen(true);
  };

  const handleChangePassword = () => {
    if (!selectedEmployeeForPassword || !newPassword.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите новый пароль",
        variant: "destructive",
      });
      return;
    }

    const email = selectedEmployeeForPassword.email;
    if (email) {
      setDemoPasswords(prev => ({ ...prev, [email]: newPassword.trim() }));
      toast({
        title: "Пароль изменён",
        description: `Пароль для ${selectedEmployeeForPassword.name} успешно изменён`,
      });
    }

    setPasswordDialogOpen(false);
    setSelectedEmployeeForPassword(null);
    setNewPassword("");
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);

    // Пытаемся определить роль из БД роли и уровня
    let appRole: UserRole = 'assistant_1';
    const dbRole = employee.role;

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
      password: getPasswordForEmail(employee.email),
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

        <TabsContent value="employees">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Сотрудники системы</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && employees.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет сотрудников. Добавьте первого сотрудника.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ФИО</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Пароль</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Уровень</TableHead>
                      <TableHead>Телефон</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => {
                      const password = getPasswordForEmail(employee.email);
                      const isPasswordVisible = showPasswords[employee.id];
                      return (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.email || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                {isPasswordVisible ? password : '••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePasswordVisibility(employee.id)}
                                title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                                className="h-7 w-7 p-0"
                              >
                                {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              {password !== '—' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyPassword(password)}
                                  title="Копировать пароль"
                                  className="h-7 w-7 p-0"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
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
                                onClick={() => openPasswordDialog(employee)}
                                title="Изменить пароль"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(employee)}
                                title="Редактировать"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteEmployee(employee)}
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
              )}
            </CardContent>
          </Card>
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

      {/* Диалог изменения пароля */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Изменение пароля
            </DialogTitle>
            <DialogDescription>
              {selectedEmployeeForPassword && (
                <>Изменение пароля для сотрудника: <strong>{selectedEmployeeForPassword.name}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Новый пароль</Label>
              <div className="flex gap-2">
                <Input
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Введите новый пароль"
                />
                <Button
                  variant="outline"
                  onClick={generateRandomPassword}
                  title="Сгенерировать пароль"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Текущий пароль: <code className="bg-muted px-1 rounded">{selectedEmployeeForPassword ? getPasswordForEmail(selectedEmployeeForPassword.email) : '—'}</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleChangePassword} className="btn-gradient">
              Сохранить пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
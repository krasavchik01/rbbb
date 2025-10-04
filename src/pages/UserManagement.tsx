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
import { Loader2, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'partner' | 'project_manager' | 'assistant' | 'tax_specialist' | 'designer' | 'it_auditor' | 'admin' | 'manager' | 'employee' | 'it_admin';
  department: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLES = [
  { value: 'it_admin', label: 'IT Администратор' },
  { value: 'admin', label: 'Администратор' },
  { value: 'partner', label: 'Партнёр' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'project_manager', label: 'Проект-менеджер' },
  { value: 'tax_specialist', label: 'Налоговый специалист' },
  { value: 'it_auditor', label: 'IT Аудитор' },
  { value: 'assistant', label: 'Ассистент' },
  { value: 'employee', label: 'Сотрудник' },
];

const DEPARTMENTS = [
  'Налоговое консультирование',
  'IT Аудит',
  'Финансовый аудит',
  'Управление проектами',
  'IT Отдел',
  'Администрация'
];

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    display_name: "",
    role: "employee" as Profile['role'],
    department: "",
    phone: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить пользователей",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.display_name) {
      setError("Заполните все обязательные поля");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        user_metadata: {
          display_name: formData.display_name,
          role: formData.role,
        },
        email_confirm: true, // Auto-confirm email
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            department: formData.department || null,
            phone: formData.phone || null,
          })
          .eq('user_id', authData.user.id);

        if (profileError) throw profileError;

        toast({
          title: "Пользователь создан",
          description: `${formData.display_name} успешно добавлен в систему`,
        });

        resetForm();
        setIsDialogOpen(false);
        fetchProfiles();
      }
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

  const handleUpdateProfile = async () => {
    if (!editingProfile || !formData.display_name) {
      setError("Заполните все обязательные поля");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          role: formData.role,
          department: formData.department || null,
          phone: formData.phone || null,
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      toast({
        title: "Профиль обновлён",
        description: "Данные пользователя успешно изменены",
      });

      resetForm();
      setIsDialogOpen(false);
      fetchProfiles();
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

  const handleToggleUserStatus = async (profile: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !profile.is_active })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: profile.is_active ? "Пользователь деактивирован" : "Пользователь активирован",
        description: `${profile.display_name} ${profile.is_active ? 'заблокирован' : 'разблокирован'}`,
      });

      fetchProfiles();
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
      email: "",
      password: "",
      display_name: "",
      role: "employee" as Profile['role'],
      department: "",
      phone: "",
    });
    setEditingProfile(null);
    setError("");
  };

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      email: profile.email,
      password: "",
      display_name: profile.display_name,
      role: profile.role,
      department: profile.department || "",
      phone: profile.phone || "",
    });
    setIsDialogOpen(true);
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'it_admin':
      case 'admin':
        return 'destructive';
      case 'partner':
        return 'default';
      case 'manager':
      case 'project_manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Управление пользователями</h1>
          <p className="text-muted-foreground">Создание и редактирование учётных записей</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient" onClick={resetForm}>
              <UserPlus className="w-4 h-4 mr-2" />
              Добавить пользователя
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Редактировать пользователя' : 'Создать пользователя'}
              </DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Изменение данных пользователя' : 'Создание нового пользователя в системе'}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Имя *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Полное имя"
                  disabled={loading}
                />
              </div>

              {!editingProfile && (
                <>
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
                    <Label htmlFor="password">Пароль *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Минимум 6 символов"
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Роль</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: Profile['role']) => setFormData(prev => ({ ...prev, role: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Отдел</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите отдел" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
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
                onClick={editingProfile ? handleUpdateProfile : handleCreateUser} 
                disabled={loading}
                className="btn-gradient"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProfile ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Пользователи системы</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && profiles.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
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
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.display_name}</TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(profile.role)}>
                        {getRoleLabel(profile.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>{profile.department || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={profile.is_active ? "default" : "secondary"}>
                        {profile.is_active ? 'Активен' : 'Заблокирован'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(profile)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={profile.is_active ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleToggleUserStatus(profile)}
                        >
                          {profile.is_active ? 'Заблокировать' : 'Разблокировать'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
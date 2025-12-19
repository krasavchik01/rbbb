import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, UserRole } from '@/types/roles';
import { Copy, Eye, EyeOff, Zap, AlertTriangle, CheckCircle, Lock } from 'lucide-react';

interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  enabled: boolean;
  description: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'ceo@demo.local',
    password: 'ceo123demo',
    role: 'ceo',
    name: 'Генеральный директор',
    enabled: true,
    description: 'Полный доступ ко всем функциям системы',
  },
  {
    email: 'deputy@demo.local',
    password: 'deputy123demo',
    role: 'deputy_director',
    name: 'Заместитель директора',
    enabled: true,
    description: 'Управление проектами, утверждение задач',
  },
  {
    email: 'partner@demo.local',
    password: 'partner123demo',
    role: 'partner',
    name: 'Партнер',
    enabled: true,
    description: 'Управление своим проектом',
  },
  {
    email: 'manager@demo.local',
    password: 'manager123demo',
    role: 'manager_1',
    name: 'Менеджер',
    enabled: true,
    description: 'Распределение задач в команде',
  },
  {
    email: 'procurement@demo.local',
    password: 'procurement123demo',
    role: 'procurement',
    name: 'Отдел закупок',
    enabled: true,
    description: 'Управление закупками и тендерами',
  },
  {
    email: 'hr@demo.local',
    password: 'hr123demo',
    role: 'hr',
    name: 'HR специалист',
    enabled: true,
    description: 'Управление сотрудниками и кадрами',
  },
  {
    email: 'supervisor@demo.local',
    password: 'supervisor123demo',
    role: 'supervisor_1',
    name: 'Супервайзер',
    enabled: true,
    description: 'Контроль выполнения задач',
  },
  {
    email: 'assistant@demo.local',
    password: 'assistant123demo',
    role: 'assistant_1',
    name: 'Ассистент',
    enabled: true,
    description: 'Вспомогательные функции',
  },
  {
    email: 'admin@demo.local',
    password: 'admin123demo',
    role: 'admin',
    name: 'Администратор',
    enabled: false,
    description: 'Система администрирования (отключено по умолчанию)',
  },
];

export default function DemoUsersManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [demoUsers, setDemoUsers] = useState<DemoUser[]>(DEMO_USERS);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('enabled');

  // Только админ может управлять демо-пользователями
  const isAdmin = user?.role === 'admin';

  const filteredUsers = demoUsers.filter(u => {
    if (activeTab === 'enabled') return u.enabled;
    if (activeTab === 'disabled') return !u.enabled;
    return true;
  });

  const toggleUserStatus = (email: string, enabled: boolean) => {
    setDemoUsers(demoUsers.map(u => (u.email === email ? { ...u, enabled } : u)));

    toast({
      title: enabled ? 'Демо-пользователь включен' : 'Демо-пользователь отключен',
      description: `${email} ${enabled ? 'теперь доступен' : 'больше не доступен'} для входа`,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: `${label} скопирован в буфер обмена`,
    });
  };

  const togglePasswordVisibility = (email: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [email]: !prev[email],
    }));
  };

  const stats = {
    total: demoUsers.length,
    enabled: demoUsers.filter(u => u.enabled).length,
    disabled: demoUsers.filter(u => !u.enabled).length,
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Управление демо-пользователями</h1>
          <p className="text-muted-foreground">Только администратор может управлять демо-пользователями</p>
        </div>
        <Alert>
          <Lock className="w-4 h-4" />
          <AlertTitle>Доступ запрещён</AlertTitle>
          <AlertDescription>
            Эта страница доступна только администраторам системы.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="w-8 h-8 text-yellow-600" />
          Управление демо-пользователями
        </h1>
        <p className="text-muted-foreground mt-1">
          Включайте/отключайте демо-пользователей для тестирования различных ролей
        </p>
      </div>

      {/* Warning Alert */}
      <Alert className="border-yellow-500 bg-yellow-50">
        <AlertTriangle className="w-4 h-4 text-yellow-700" />
        <AlertTitle className="text-yellow-900">Демо-режим</AlertTitle>
        <AlertDescription className="text-yellow-800">
          Демо-пользователи предназначены исключительно для тестирования и демонстрации системы.
          Не используйте их для реальной работы. Отключайте неиспользуемые демо-аккаунты для безопасности.
        </AlertDescription>
      </Alert>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Всего пользователей</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{stats.enabled}</p>
              <p className="text-xs text-muted-foreground">Включены</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{stats.disabled}</p>
              <p className="text-xs text-muted-foreground">Отключены</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="enabled">
            Включены ({stats.enabled})
          </TabsTrigger>
          <TabsTrigger value="disabled">
            Отключены ({stats.disabled})
          </TabsTrigger>
          <TabsTrigger value="all">Все ({stats.total})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {filteredUsers.map(demoUser => (
            <Card key={demoUser.email} className={`p-6 ${!demoUser.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{demoUser.name}</h3>
                      <Badge className={demoUser.enabled ? 'bg-green-500' : 'bg-gray-500'}>
                        {demoUser.enabled ? 'Включен' : 'Отключен'}
                      </Badge>
                      <Badge variant="outline">{ROLE_LABELS[demoUser.role]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{demoUser.description}</p>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`toggle-${demoUser.email}`} className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm">{demoUser.enabled ? 'Вкл' : 'Выкл'}</span>
                    </Label>
                    <Switch
                      id={`toggle-${demoUser.email}`}
                      checked={demoUser.enabled}
                      onCheckedChange={(enabled) => toggleUserStatus(demoUser.email, enabled)}
                    />
                  </div>
                </div>

                {/* Credentials */}
                {demoUser.enabled && (
                  <div className="pt-4 border-t space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Электронная почта</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono">
                            {demoUser.email}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(demoUser.email, 'Email')}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Пароль</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono">
                            {showPasswords[demoUser.email] ? demoUser.password : '••••••••••••'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePasswordVisibility(demoUser.email)}
                          >
                            {showPasswords[demoUser.email] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(demoUser.password, 'Пароль')
                            }
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-900">
                        <strong>Инструкция входа:</strong> Используйте эти учётные данные на странице входа для
                        тестирования функций под этой ролью.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {filteredUsers.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет пользователей в этой категории</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Start Guide */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">Быстрый старт для тестирования</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Шаг 1:</strong> Выберите роль, которую хотите протестировать (включена ли она)
          </p>
          <p>
            <strong>Шаг 2:</strong> Скопируйте email и пароль демо-пользователя
          </p>
          <p>
            <strong>Шаг 3:</strong> Перейдите на страницу входа и введите учётные данные
          </p>
          <p>
            <strong>Шаг 4:</strong> Тестируйте функции, доступные для этой роли
          </p>
          <p className="pt-2">
            <strong>Совет:</strong> Отключайте демо-пользователей, когда не используете их, для безопасности
            системы.
          </p>
        </div>
      </Card>

      {/* Role Permissions Info */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Описание ролей и их функции</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { role: 'ceo', features: ['Полный доступ', 'Утверждение проектов', 'Управление всеми функциями'] },
            { role: 'deputy_director', features: ['Управление проектами', 'Утверждение', 'Посещаемость'] },
            { role: 'partner', features: ['Свой проект', 'Команду', 'Отчёты'] },
            { role: 'manager_1', features: ['Распределение задач', 'Оценка команды', 'Отчёты'] },
            { role: 'procurement', features: ['Закупки', 'Тендеры', 'Утверждение'] },
            { role: 'hr', features: ['Управление кадрами', 'Зарплата', 'Документы'] },
            { role: 'supervisor_1', features: ['Контроль задач', 'Отчёты', 'Комментарии'] },
            { role: 'assistant_1', features: ['Базовые функции', 'Документы', 'Уведомления'] },
          ].map(info => (
            <div key={info.role} className="p-3 bg-gray-50 rounded-lg border">
              <p className="font-medium mb-2">{ROLE_LABELS[info.role as UserRole]}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {info.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

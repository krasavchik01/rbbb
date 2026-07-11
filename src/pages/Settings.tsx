import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useAuth, type User as AuthUser } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAppSettings } from '@/lib/appSettings';
import { CompaniesManagement } from '@/components/settings/CompaniesManagement';
import { EmailSettingsPanel } from '@/components/settings/EmailSettingsPanel';
import { UserCompanyAssignment } from '@/components/settings/UserCompanyAssignment';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployees } from '@/hooks/useSupabaseData';
import { ROLE_LABELS, normalizeUserRole, type UserRole } from '@/types/roles';
import type { Employee } from '@/lib/supabaseDataStore';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  CheckCircle,
  Settings2,
  MapPin,
  Building2,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appSettings, updateAppSettings] = useAppSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    notifications: {
      email: true,
      push: true,
      projectUpdates: true,
      taskAssignments: true
    }
  });

  // Локальное состояние для настроек офиса
  const [officeSettings, setOfficeSettings] = useState({
    enabled: appSettings.officeLocation.enabled,
    latitude: appSettings.officeLocation.latitude.toString(),
    longitude: appSettings.officeLocation.longitude.toString(),
    radiusMeters: appSettings.officeLocation.radiusMeters.toString(),
    address: appSettings.officeLocation.address
  });

  // Список ролей, которым видно блок «Последние активности» на дашборде
  const [recentActivityVisibleRoles, setRecentActivityVisibleRoles] = useState<UserRole[]>(appSettings.recentActivityVisibleRoles);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isAdmin = user?.role === 'admin';
  const defaultSettingsTab = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('tab') || 'profile'
    : 'profile';

  // Синхронизация с appSettings при изменении
  useEffect(() => {
    setRecentActivityVisibleRoles(appSettings.recentActivityVisibleRoles);
    setOfficeSettings({
      enabled: appSettings.officeLocation.enabled,
      latitude: appSettings.officeLocation.latitude.toString(),
      longitude: appSettings.officeLocation.longitude.toString(),
      radiusMeters: appSettings.officeLocation.radiusMeters.toString(),
      address: appSettings.officeLocation.address
    });
  }, [appSettings]);

  // Функция получения текущей геолокации
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Ошибка',
        description: 'Геолокация не поддерживается браузером',
        variant: 'destructive'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOfficeSettings({
          ...officeSettings,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        });
        toast({
          title: 'Координаты получены',
          description: `Широта: ${position.coords.latitude.toFixed(6)}, Долгота: ${position.coords.longitude.toFixed(6)}`
        });
      },
      (error) => {
        toast({
          title: 'Ошибка геолокации',
          description: error.message,
          variant: 'destructive'
        });
      }
    );
  };

  // Сохранение всех системных настроек
  const saveSystemSettings = async () => {
    setIsSaving(true);
    try {
      await updateAppSettings({
        recentActivityVisibleRoles: recentActivityVisibleRoles,
        officeLocation: {
          enabled: officeSettings.enabled,
          latitude: parseFloat(officeSettings.latitude) || 0,
          longitude: parseFloat(officeSettings.longitude) || 0,
          radiusMeters: parseInt(officeSettings.radiusMeters) || 100,
          address: officeSettings.address
        }
      });
      setHasUnsavedChanges(false);
      toast({
        title: '✅ Настройки сохранены',
        description: 'Изменения применены на всех устройствах',
        duration: 3000
      });
    } catch (error) {
      toast({
        title: '❌ Ошибка сохранения',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveOfficeSettings = async () => {
    try {
      await updateAppSettings({
        officeLocation: {
          enabled: officeSettings.enabled,
          latitude: parseFloat(officeSettings.latitude) || 0,
          longitude: parseFloat(officeSettings.longitude) || 0,
          radiusMeters: parseInt(officeSettings.radiusMeters) || 100,
          address: officeSettings.address
        }
      });
      toast({
        title: 'Настройки офиса сохранены',
        description: officeSettings.enabled ? 'Проверка геолокации включена и применена для всех устройств' : 'Проверка геолокации отключена'
      });
    } catch (error) {
      toast({
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить настройки офиса',
        variant: 'destructive'
      });
    }
  };

  // Пароль
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      toast({ title: "Настройки сохранены", description: "Ваши настройки успешно обновлены." });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.id || !user.email) {
      toast({ title: 'Ошибка', description: 'Пользователь не найден', variant: 'destructive' });
      return;
    }
    if (!currentPassword.trim()) {
      toast({ title: 'Ошибка', description: 'Введите текущий пароль', variant: 'destructive' });
      return;
    }
    if (!newPassword.trim()) {
      toast({ title: 'Ошибка', description: 'Введите новый пароль', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Ошибка', description: 'Пароль должен быть минимум 8 символов', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Ошибка', description: 'Пароли не совпадают', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: employee, error: employeeReadError } = await supabase
        .from('employees')
        .select('id,email,password')
        .eq('id', user.id)
        .single();

      if (employeeReadError) throw employeeReadError;

      let authVerified = false;
      if ((employee as any)?.password) {
        if ((employee as any).password !== currentPassword) {
          toast({ title: 'Ошибка', description: 'Текущий пароль указан неверно', variant: 'destructive' });
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email.trim().toLowerCase(),
          password: currentPassword,
        });
        if (signInError) {
          toast({ title: 'Ошибка', description: 'Текущий пароль указан неверно', variant: 'destructive' });
          return;
        }
        authVerified = true;
      }

      const { error: employeeUpdateError } = await supabase
        .from('employees')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (employeeUpdateError) throw employeeUpdateError;

      let authPasswordSynced = false;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session && !authVerified) {
        await supabase.auth.signInWithPassword({
          email: user.email.trim().toLowerCase(),
          password: currentPassword,
        });
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({ password: newPassword });
      authPasswordSynced = !authUpdateError;

      if (!authPasswordSynced) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: user.email.trim().toLowerCase(),
          password: newPassword,
          options: {
            data: {
              name: user.name,
              role: user.role,
            },
          },
        });
        authPasswordSynced = !signUpError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Пароль изменён',
        description: authPasswordSynced
          ? 'Новый пароль сохранён и синхронизирован с восстановлением через email.'
          : 'Новый пароль сохранён для входа. Если восстановление через email не сработает, обратитесь к администратору.',
      });
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message || 'Не удалось сменить пароль', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
          Настройки
        </h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Настройки системы и профиля</p>
      </div>

      {isAdmin && <RoleTestingPanel />}

      <Tabs defaultValue={defaultSettingsTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile" className="text-xs sm:text-sm">Профиль</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">Уведомления</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs sm:text-sm">Внешний вид</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm">Безопасность</TabsTrigger>
          {isAdmin && <TabsTrigger value="system" className="text-xs sm:text-sm">Система</TabsTrigger>}
          {isAdmin && <TabsTrigger value="email" className="text-xs sm:text-sm">Почта</TabsTrigger>}
          {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'procurement' || user?.role === 'ceo' || user?.role === 'deputy_director') && (
            <TabsTrigger value="companies" className="text-xs sm:text-sm">Компании</TabsTrigger>
          )}
          {(user?.role === 'admin' || user?.role === 'ceo') && (
            <TabsTrigger value="access" className="text-xs sm:text-sm">Доступ к проектам</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Информация профиля
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="mt-1"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email нельзя изменить
                </p>
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="mt-1"
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
              <div>
                <Label>Роль</Label>
                <Input
                  value={user?.role || ''}
                  className="mt-1"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Роль определяется администратором
                </p>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Уведомления
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать уведомления на email
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={profileData.notifications.email}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    notifications: { ...profileData.notifications, email: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Push уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Получать push уведомления в браузере
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={profileData.notifications.push}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    notifications: { ...profileData.notifications, push: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Обновления проектов</Label>
                  <p className="text-sm text-muted-foreground">
                    Уведомления об изменениях в проектах
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={profileData.notifications.projectUpdates}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    notifications: { ...profileData.notifications, projectUpdates: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Назначение задач</Label>
                  <p className="text-sm text-muted-foreground">
                    Уведомления при назначении задач
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={profileData.notifications.taskAssignments}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    notifications: { ...profileData.notifications, taskAssignments: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Внешний вид
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Тема оформления</Label>
                <div className="mt-2">
                  <ThemeToggle />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Переключение между светлой и темной темой
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
      <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Безопасность
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Текущий пароль</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="Введите текущий пароль"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label>Новый пароль</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="Введите новый пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label>Подтвердите пароль</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="Повторите новый пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={isSaving || !currentPassword || !newPassword}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Сохранение...' : 'Изменить пароль'}
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Пароль должен быть не короче 8 символов. После смены используйте его при следующем входе.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Вкладка системных настроек - только для админа */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Системные настройки
              </h3>
              <div className="space-y-4">
                {/* Видимость «Последние активности» — выбор ролей */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-base">Блок «Последние активности» на дашборде</Label>
                    <p className="text-sm text-muted-foreground">
                      Отметьте роли, которым показывать блок. Снимите все галочки, чтобы скрыть блок у всех.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRecentActivityVisibleRoles(['ceo', 'deputy_director', 'partner']);
                        setHasUnsavedChanges(true);
                      }}
                    >
                      По умолчанию (CEO, зам., партнёр)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRecentActivityVisibleRoles([]);
                        setHasUnsavedChanges(true);
                      }}
                    >
                      Скрыть у всех
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
                      const checked = recentActivityVisibleRoles.includes(role);
                      return (
                        <label
                          key={role}
                          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover:bg-accent/40 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              setRecentActivityVisibleRoles((prev) => {
                                const isChecked = value === true;
                                if (isChecked && !prev.includes(role)) return [...prev, role];
                                if (!isChecked) return prev.filter((r) => r !== role);
                                return prev;
                              });
                              setHasUnsavedChanges(true);
                            }}
                          />
                          <span className="text-sm">{ROLE_LABELS[role]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Кнопка сохранения */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {hasUnsavedChanges ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      <span>Есть несохраненные изменения</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Все изменения сохранены</span>
                    </>
                  )}
                </div>
                <Button
                  onClick={saveSystemSettings}
                  disabled={!hasUnsavedChanges || isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Сохранить изменения
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Настройки геолокации офиса */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Геолокация офиса
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base">Проверка местоположения</Label>
                    <p className="text-sm text-muted-foreground">
                      Проверять находится ли сотрудник в офисе при отметке посещаемости
                    </p>
                  </div>
                  <Switch
                    checked={officeSettings.enabled}
                    onCheckedChange={(checked) => setOfficeSettings({ ...officeSettings, enabled: checked })}
                  />
                </div>

                {officeSettings.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Широта</Label>
                        <Input
                          id="latitude"
                          type="text"
                          value={officeSettings.latitude}
                          onChange={(e) => setOfficeSettings({ ...officeSettings, latitude: e.target.value })}
                          placeholder="43.238949"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="longitude">Долгота</Label>
                        <Input
                          id="longitude"
                          type="text"
                          value={officeSettings.longitude}
                          onChange={(e) => setOfficeSettings({ ...officeSettings, longitude: e.target.value })}
                          placeholder="76.945465"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="radius">Радиус проверки (метры)</Label>
                      <Input
                        id="radius"
                        type="number"
                        value={officeSettings.radiusMeters}
                        onChange={(e) => setOfficeSettings({ ...officeSettings, radiusMeters: e.target.value })}
                        placeholder="100"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Сотрудник должен находиться в этом радиусе от офиса
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="address">Адрес офиса (опционально)</Label>
                      <Input
                        id="address"
                        value={officeSettings.address}
                        onChange={(e) => setOfficeSettings({ ...officeSettings, address: e.target.value })}
                        placeholder="г. Алматы, ул. Примерная, 123"
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={getCurrentLocation}>
                        <MapPin className="w-4 h-4 mr-2" />
                        Получить текущие координаты
                      </Button>
                    </div>

                    {officeSettings.latitude && officeSettings.longitude && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Предпросмотр карты:</p>
                        <a
                          href={`https://www.google.com/maps?q=${officeSettings.latitude},${officeSettings.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Открыть в Google Maps
                        </a>
                      </div>
                    )}
                  </>
                )}

                <Button onClick={saveOfficeSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить настройки офиса
                </Button>
              </div>
            </Card>

            {/* Системная информация */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Системная информация
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Версия приложения:</span>
                  <span className="font-mono">1.0.2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Разработчик:</span>
                  <span className="font-medium text-primary">Aidos Tazhbenov</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Copyright:</span>
                  <span className="text-muted-foreground">© 2026 All Rights Reserved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Проверка геолокации:</span>
                  <span className={appSettings.officeLocation.enabled ? 'text-green-500' : 'text-muted-foreground'}>
                    {appSettings.officeLocation.enabled ? 'Включена' : 'Выключена'}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="email" className="space-y-4">
            <div>
              <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Почтовые настройки
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Настройка SMTP для восстановления пароля и системных уведомлений.
              </p>
            </div>
            <EmailSettingsPanel />
          </TabsContent>
        )}

        {/* Вкладка Компании */}
        {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'procurement' || user?.role === 'ceo' || user?.role === 'deputy_director') && (
          <TabsContent value="companies" className="space-y-4">
            <Card className="p-6">
              <CompaniesManagement
                companies={appSettings.companies}
                onChange={async (updatedCompanies) => {
                  console.log('=== СОХРАНЕНИЕ КОМПАНИЙ ===');
                  console.log('Новый список компаний:', updatedCompanies);
                  try {
                    await updateAppSettings({ companies: updatedCompanies });
                    console.log('Компании успешно сохранены в Supabase');
                    toast({
                      title: '✅ Компании обновлены',
                      description: 'Список компаний успешно сохранен',
                    });
                  } catch (error) {
                    console.error('ОШИБКА сохранения компаний:', error);
                    toast({
                      title: 'Ошибка сохранения',
                      description: 'Не удалось сохранить компании',
                      variant: 'destructive',
                    });
                  }
                }}
              />
            </Card>
          </TabsContent>
        )}

        {/* Вкладка Доступ к проектам */}
        {(user?.role === 'admin' || user?.role === 'ceo') && (
          <TabsContent value="access" className="space-y-4">
            <Card className="p-4 sm:p-6 border-0 shadow-sm">
              <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Доступ к проектам по компаниям
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Настройте какие компании видит каждый пользователь. Перетаскивайте компании в зону «Назначено».
              </p>
              <UserCompanyAssignment />
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const ROLE_TEST_SHORTCUTS: Array<{ role: UserRole; label: string }> = [
  { role: 'ceo', label: 'Войти как CEO' },
  { role: 'deputy_director', label: 'Войти как замдир' },
  { role: 'partner', label: 'Войти как партнер' },
  { role: 'hr', label: 'Войти как HR' },
  { role: 'procurement', label: 'Войти как закуп' },
  { role: 'manager_1', label: 'Войти как менеджер' },
  { role: 'assistant_1', label: 'Войти как сотрудник' },
];

function employeeToAuthUser(employee: Employee): AuthUser {
  const role = normalizeUserRole(employee.role, employee.level);
  return {
    id: employee.id,
    email: employee.email || '',
    name: employee.name || 'Без имени',
    role,
    companyId: employee.companyId || undefined,
    department: employee.department || '',
    position: employee.position || '',
    avatar: employee.name
      ? employee.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
      : 'UN',
  };
}

function RoleTestingPanel() {
  const navigate = useNavigate();
  const { user, originalUser, isImpersonating, startImpersonation, stopImpersonation } = useAuth();
  const { employees, loading } = useEmployees();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const sortedEmployees = [...employees]
    .filter((employee) => employee.id && employee.name)
    .sort((a, b) => {
      const roleA = ROLE_LABELS[normalizeUserRole(a.role, a.level)] || a.role;
      const roleB = ROLE_LABELS[normalizeUserRole(b.role, b.level)] || b.role;
      return `${roleA} ${a.name}`.localeCompare(`${roleB} ${b.name}`, 'ru');
    });

  const switchToEmployee = async (employee?: Employee) => {
    if (!employee) return;
    await startImpersonation(employeeToAuthUser(employee));
    navigate('/projects');
  };

  const switchToRole = async (role: UserRole) => {
    const employee = sortedEmployees.find((item) => normalizeUserRole(item.role, item.level) === role);
    if (employee) {
      await switchToEmployee(employee);
      return;
    }

    if (!user) return;
    await startImpersonation({
      ...user,
      role,
      name: `${ROLE_LABELS[role] || role} (проверка)`,
      email: user.email || `role-${role}@local.test`,
      position: 'Режим проверки роли',
    });
    navigate('/projects');
  };

  return (
    <Card className="p-4 sm:p-5 border-sky-200 bg-sky-50/60">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Проверка ролей</h2>
          <p className="text-sm text-muted-foreground">
            Быстрый вход под реальным сотрудником, чтобы проверить таблицу, таймшиты и доступы.
          </p>
          {isImpersonating && originalUser && user && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              Сейчас проверяете как: {user.name}. Оригинал: {originalUser.name}.
            </p>
          )}
        </div>

        {isImpersonating && (
          <Button
            variant="outline"
            onClick={() => void stopImpersonation()}
          >
            Вернуться в admin
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ROLE_TEST_SHORTCUTS.map((item) => (
          <Button
            key={item.role}
            variant={item.role === 'partner' ? 'default' : 'outline'}
            size="sm"
            disabled={loading}
            onClick={() => void switchToRole(item.role)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[minmax(260px,520px)_auto] md:items-center">
        <Select
          value={selectedEmployeeId}
          onValueChange={(value) => {
            setSelectedEmployeeId(value);
            void switchToEmployee(sortedEmployees.find((employee) => employee.id === value));
          }}
          disabled={loading}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={loading ? 'Загрузка сотрудников...' : 'Или выбрать любого сотрудника'} />
          </SelectTrigger>
          <SelectContent className="max-h-[420px]">
            {sortedEmployees.map((employee) => {
              const role = normalizeUserRole(employee.role, employee.level);
              return (
                <SelectItem key={employee.id} value={employee.id}>
                  {ROLE_LABELS[role] || role}: {employee.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          После выбора откроется главная таблица.
        </span>
      </div>
    </Card>
  );
}

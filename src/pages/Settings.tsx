import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAppSettings } from '@/lib/appSettings';
import { CompaniesManagement } from '@/components/settings/CompaniesManagement';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  CheckCircle,
  Settings2,
  MapPin,
  Users,
  Eye,
  EyeOff,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
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

  // Локальное состояние для демо-аккаунтов
  const [showDemoUsers, setShowDemoUsers] = useState(appSettings.showDemoUsers);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Синхронизация с appSettings при изменении
  useEffect(() => {
    setShowDemoUsers(appSettings.showDemoUsers);
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
        showDemoUsers: showDemoUsers,
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Здесь должна быть логика сохранения
      // await updateUser(profileData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Имитация запроса
      
      toast({
        title: "Настройки сохранены",
        description: "Ваши настройки успешно обновлены.",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
        <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8" />
          Настройки
        </h1>
        <p className="text-muted-foreground mt-2">Настройки системы и профиля</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="notifications">Уведомления</TabsTrigger>
          <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
          {isAdmin && <TabsTrigger value="system">Система</TabsTrigger>}
          {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'procurement' || user?.role === 'ceo') && (
            <TabsTrigger value="companies">Компании</TabsTrigger>
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
                />
              </div>
              <div>
                <Label>Новый пароль</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="Введите новый пароль"
                />
              </div>
              <div>
                <Label>Подтвердите пароль</Label>
                <Input
                  type="password"
                  className="mt-1"
                  placeholder="Повторите новый пароль"
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Сохранение...' : 'Изменить пароль'}
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Рекомендуется использовать пароль длиной не менее 8 символов
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Вкладка системных настроек - только для админа */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-4">
            {/* Демо-пользователи */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Демо-пользователи
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base">Показывать демо-аккаунты</Label>
                    <p className="text-sm text-muted-foreground">
                      Отображать список демо-пользователей на странице входа для тестирования
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {showDemoUsers ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={showDemoUsers}
                      onCheckedChange={(checked) => {
                        setShowDemoUsers(checked);
                        setHasUnsavedChanges(true);
                      }}
                    />
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
                  <span className="text-muted-foreground">Демо-режим:</span>
                  <span className={appSettings.showDemoUsers ? 'text-green-500' : 'text-muted-foreground'}>
                    {appSettings.showDemoUsers ? 'Включен' : 'Выключен'}
                  </span>
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

        {/* Вкладка Компании */}
        {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'procurement' || user?.role === 'ceo') && (
          <TabsContent value="companies" className="space-y-4">
            <Card className="p-6">
              <CompaniesManagement
                companies={appSettings.companies}
                onChange={async (updatedCompanies) => {
                  try {
                    await updateAppSettings({ companies: updatedCompanies });
                    toast({
                      title: '✅ Компании обновлены',
                      description: 'Список компаний успешно сохранен',
                    });
                  } catch (error) {
                    console.error('Error saving companies:', error);
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
      </Tabs>
    </div>
  );
}

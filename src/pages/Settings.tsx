import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  User,
  Bell,
  Shield,
  Palette,
  Mail,
  Phone,
  Save,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
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
      </Tabs>
    </div>
  );
}

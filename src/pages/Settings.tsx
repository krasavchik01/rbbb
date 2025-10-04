import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Settings as SettingsIcon,
  Users,
  FileSpreadsheet,
  Webhook,
  MessageSquare,
  Mail,
  Phone,
  Shield,
  Bell,
  Palette,
  Database,
  Plus,
  Edit,
  Trash2
} from "lucide-react";

export default function Settings() {
  const roles = [
    { id: 1, name: "👤 Партнёр", permissions: ["Просмотр всех проектов", "Управление командой", "Финансы"], count: 8 },
    { id: 2, name: "🧑‍💼 Руководитель проекта", permissions: ["Управление проектом", "Команда проекта"], count: 12 },
    { id: 3, name: "🧱 Ассистент", permissions: ["Просмотр назначенных задач", "Тайм-щиты"], count: 15 },
    { id: 4, name: "💼 Бухгалтер", permissions: ["Бонусы", "Финансовые отчёты"], count: 5 }
  ];

  const integrations = [
    { name: "Google Sheets", icon: FileSpreadsheet, status: "connected", description: "Импорт данных проектов" },
    { name: "Webhook n8n", icon: Webhook, status: "disconnected", description: "Автоматизация процессов" },
    { name: "WhatsApp", icon: MessageSquare, status: "disconnected", description: "Уведомления в мессенджер" },
    { name: "Telegram", icon: MessageSquare, status: "connected", description: "Уведомления в Telegram" },
    { name: "Email", icon: Mail, status: "connected", description: "Email-уведомления" }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Настройки
          </h1>
          <p className="text-muted-foreground mt-1">Конфигурация системы и интеграций</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Roles Management */}
        <Card className="glass-card">
          <div className="p-6 border-b border-glass-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary/20 to-warning/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Управление ролями</h3>
                  <p className="text-sm text-muted-foreground">Настройка прав доступа</p>
                </div>
              </div>
              <Button 
                size="sm" 
                className="btn-gradient"
                onClick={() => {
                  // TODO: Implement add role functionality
                  console.log('Add role clicked');
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить роль
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="p-4 rounded-lg border border-glass-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{role.name}</h4>
                    <p className="text-sm text-muted-foreground">{role.count} сотрудников</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-8 h-8 p-0"
                      onClick={() => {
                        // TODO: Implement edit role functionality
                        console.log('Edit role clicked:', role.id);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-8 h-8 p-0 text-destructive"
                      onClick={() => {
                        // TODO: Implement delete role functionality
                        console.log('Delete role clicked:', role.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {role.permissions.map((permission, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      <span className="text-sm text-muted-foreground">{permission}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Integrations */}
        <Card className="glass-card">
          <div className="p-6 border-b border-glass-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-success/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
                <Webhook className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Интеграции</h3>
                <p className="text-sm text-muted-foreground">Подключение внешних сервисов</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {integrations.map((integration, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-glass-border bg-secondary/20">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    integration.status === 'connected' 
                      ? 'bg-success/20' 
                      : 'bg-secondary/30'
                  }`}>
                    <integration.icon className={`w-5 h-5 ${
                      integration.status === 'connected' 
                        ? 'text-success' 
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-medium">{integration.name}</h4>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-2 px-2 py-1 rounded-full text-xs ${
                    integration.status === 'connected'
                      ? 'bg-success/20 text-success'
                      : 'bg-secondary/30 text-muted-foreground'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      integration.status === 'connected' ? 'bg-success' : 'bg-muted-foreground'
                    }`} />
                    <span>{integration.status === 'connected' ? 'Подключено' : 'Отключено'}</span>
                  </div>
                  <Switch checked={integration.status === 'connected'} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* System Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications */}
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-warning/20 to-yellow-500/20 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Уведомления</h3>
              <p className="text-sm text-muted-foreground">Настройка алертов</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Email уведомления</p>
                <p className="text-xs text-muted-foreground">Отправка на почту</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Push уведомления</p>
                <p className="text-xs text-muted-foreground">В браузере</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">SMS уведомления</p>
                <p className="text-xs text-muted-foreground">Критичные события</p>
              </div>
              <Switch />
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-destructive/20 to-red-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Безопасность</h3>
              <p className="text-sm text-muted-foreground">Защита данных</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Двухфакторная аутентификация</p>
                <p className="text-xs text-muted-foreground">Дополнительная защита</p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Автовыход</p>
                <p className="text-xs text-muted-foreground">Через 30 минут</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Логирование действий</p>
                <p className="text-xs text-muted-foreground">Аудит системы</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        {/* Backup */}
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-secondary/20 to-purple-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Резервное копирование</h3>
              <p className="text-sm text-muted-foreground">Сохранность данных</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Автоматический бэкап</p>
                <p className="text-xs text-muted-foreground">Ежедневно в 3:00</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="space-y-2">
              <p className="font-medium text-sm">Последний бэкап</p>
              <p className="text-xs text-muted-foreground">14 дек 2024, 03:00</p>
            </div>
            
            <Button 
              size="sm" 
              className="btn-glass w-full"
              onClick={() => {
                // TODO: Implement create backup functionality
                console.log('Create backup clicked');
              }}
            >
              Создать бэкап сейчас
            </Button>
          </div>
        </Card>
      </div>

      {/* API Configuration */}
      <Card className="glass-card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-primary/20 to-warning/20 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">API и Webhook настройки</h3>
            <p className="text-sm text-muted-foreground">Настройка внешних интеграций</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Webhook URL (n8n)</label>
              <Input 
                placeholder="https://your-n8n-instance.com/webhook/..." 
                className="mt-1 glass border-glass-border"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input 
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                className="mt-1 glass border-glass-border"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Google Sheets ID</label>
              <Input 
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="mt-1 glass border-glass-border"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Telegram Bot Token</label>
              <Input 
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                className="mt-1 glass border-glass-border"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <Button 
            variant="outline" 
            className="btn-glass"
            onClick={() => {
              // TODO: Implement test connection functionality
              console.log('Test connection clicked');
            }}
          >
            Тестировать подключение
          </Button>
          <Button 
            className="btn-gradient"
            onClick={() => {
              // TODO: Implement save settings functionality
              console.log('Save settings clicked');
            }}
          >
            Сохранить настройки
          </Button>
        </div>
      </Card>
    </div>
  );
}
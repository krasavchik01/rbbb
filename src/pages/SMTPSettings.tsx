import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, CheckCircle2, XCircle, Loader2, Save, TestTube } from 'lucide-react';
import { loadSMTPConfig, saveSMTPConfig, testSMTPConnection, type SMTPConfig } from '@/lib/emailService';
import { toast } from 'sonner';

export default function SMTPSettings() {
  const [config, setConfig] = useState<SMTPConfig>({
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    from: '',
    fromName: 'RB Partners'
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSMTPConfig().then(saved => {
      if (saved) setConfig(saved);
    });
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testSMTPConnection(config);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Подключение успешно!');
      } else {
        toast.error('Ошибка подключения');
      }
    } catch (error) {
      setTestResult({ success: false, message: `Ошибка: ${error}` });
      toast.error('Ошибка тестирования');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSMTPConfig(config);
      toast.success('Настройки SMTP сохранены в базу данных!');
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            SMTP Настройки
          </h1>
          <p className="text-muted-foreground mt-2">
            Настройка почтового сервера для отправки уведомлений
          </p>
        </div>
      </div>

      {/* Status Badge */}
      {testResult && (
        <Alert className={testResult.success ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'}>
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <AlertDescription>
              {testResult.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* SMTP Configuration Form */}
      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🔧 Конфигурация SMTP
          </h2>

          {/* Host */}
          <div className="space-y-2">
            <Label htmlFor="host">SMTP Хост *</Label>
            <Input
              id="host"
              placeholder="mail.example.com"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Адрес вашего Mailcow сервера
            </p>
          </div>

          {/* Port & Secure */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">Порт *</Label>
              <Select
                value={config.port.toString()}
                onValueChange={(value) => {
                  const port = parseInt(value);
                  setConfig({ 
                    ...config, 
                    port,
                    secure: port === 465 || port === 993 // 587 и 25 используют STARTTLS
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите порт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="465">465 (SSL/TLS)</SelectItem>
                  <SelectItem value="993">993 (IMAP SSL)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ⚠️ Если Vercel не может подключиться - проверь firewall на сервере
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secure" className="flex items-center gap-2">
                SSL/TLS
                <Badge variant={config.secure ? 'default' : 'secondary'} className="ml-2">
                  {config.secure ? 'Включено' : 'Выключено'}
                </Badge>
              </Label>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="secure"
                  checked={config.secure}
                  onCheckedChange={(checked) => setConfig({ ...config, secure: checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {config.secure ? `Порт ${config.port} (SSL/TLS)` : `Порт ${config.port} (STARTTLS)`}
                </span>
              </div>
            </div>
          </div>

          {/* User */}
          <div className="space-y-2">
            <Label htmlFor="user">Email/Логин *</Label>
            <Input
              id="user"
              type="email"
              placeholder="noreply@example.com"
              value={config.user}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Пароль *</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
            />
          </div>

          {/* From Email */}
          <div className="space-y-2">
            <Label htmlFor="from">Email отправителя *</Label>
            <Input
              id="from"
              type="email"
              placeholder="noreply@example.com"
              value={config.from}
              onChange={(e) => setConfig({ ...config, from: e.target.value })}
            />
          </div>

          {/* From Name */}
          <div className="space-y-2">
            <Label htmlFor="fromName">Имя отправителя</Label>
            <Input
              id="fromName"
              placeholder="RB Partners"
              value={config.fromName}
              onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={handleTest}
            disabled={testing || !config.host || !config.user || !config.password}
            variant="outline"
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Тест подключения
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !config.host || !config.user || !config.password}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Сохранить настройки
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-secondary/20">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          💡 Настройка Mailcow
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Создайте почтовый ящик в вашем Mailcow сервере</p>
          <p>2. Используйте следующие настройки:</p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li><strong>Хост:</strong> адрес вашего Mailcow сервера (например: mail.example.com)</li>
            <li><strong>Порт:</strong> <span className="text-primary font-semibold">465 (SSL/TLS)</span> или <span className="text-primary font-semibold">993 (IMAP SSL)</span></li>
            <li><strong>Логин:</strong> полный email адрес (например: noreply@example.com)</li>
            <li><strong>Пароль:</strong> пароль от почтового ящика</li>
          </ul>
          <p className="pt-2 text-warning">⚠️ <strong>Важно:</strong> Для Mailcow используйте порты <strong>465</strong> или <strong>993</strong> с включенным SSL/TLS</p>
          <p>3. После настройки нажмите "Тест подключения"</p>
          <p>4. Если тест успешен, сохраните настройки</p>
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm font-semibold text-destructive mb-2">❌ Ошибка ETIMEDOUT?</p>
            <ul className="text-xs space-y-1">
              <li>• Проверь что сервер доступен из интернета (не только локально)</li>
              <li>• Открой порты 465/993 в firewall (iptables, ufw)</li>
              <li>• Проверь что Mailcow слушает на 0.0.0.0, а не 127.0.0.1</li>
              <li>• Возможно Vercel заблокирован в твоей стране/провайдере</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}


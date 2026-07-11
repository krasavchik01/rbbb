import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Save, Send, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { loadSMTPConfig, saveSMTPConfig, testSMTPConnection, type SMTPConfig } from '@/lib/emailService';
import { useToast } from '@/hooks/use-toast';

const emptyConfig: SMTPConfig = {
  host: '',
  port: 465,
  secure: true,
  user: '',
  password: '',
  from: '',
  fromName: 'SUITE-A',
};

function getCurrentUserEmail(): string {
  try {
    const saved = localStorage.getItem('user');
    if (!saved) return '';
    const user = JSON.parse(saved);
    return String(user?.email || '').trim();
  } catch {
    return '';
  }
}

export function EmailSettingsPanel() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SMTPConfig>(emptyConfig);
  const [testRecipient, setTestRecipient] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    loadSMTPConfig().then((saved) => {
      if (!mounted) return;
      if (saved) {
        setConfig({ ...emptyConfig, ...saved, password: '' });
        setTestRecipient((current) => current || getCurrentUserEmail() || saved.from || saved.user || '');
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const isReadyToSave = useMemo(() => {
    return Boolean(config.host && config.port && config.user && config.from && config.fromName && (config.password || config.hasPassword));
  }, [config]);

  const updateConfig = (updates: Partial<SMTPConfig>) => {
    setConfig((current) => ({ ...current, ...updates }));
    setResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const saved = await saveSMTPConfig(config);
      if (saved) {
        setConfig({ ...emptyConfig, ...saved, password: '' });
        setTestRecipient((current) => current || getCurrentUserEmail() || saved.from || saved.user || '');
      }
      toast({
        title: 'Почта сохранена',
        description: 'Все системные письма будут уходить через эти SMTP-настройки.',
      });
    } catch (error) {
      toast({
        title: 'Не удалось сохранить почту',
        description: error instanceof Error ? error.message : 'Проверьте SMTP-настройки',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const recipient = testRecipient.trim();
    if (!recipient) {
      const message = 'Укажите email, куда отправить тестовое письмо.';
      setResult({ success: false, message });
      toast({ title: 'Нужен получатель теста', description: message, variant: 'destructive' });
      return;
    }

    setTesting(true);
    setResult(null);
    try {
      const test = await testSMTPConnection(config, recipient);
      setResult(test);
      toast({
        title: test.success ? 'SMTP работает' : 'SMTP не прошёл проверку',
        description: test.message,
        variant: test.success ? 'default' : 'destructive',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка проверки SMTP';
      setResult({ success: false, message });
      toast({ title: 'SMTP не прошёл проверку', description: message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаем почтовые настройки
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="h-5 w-5 text-primary" />
              Почта системы
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Один SMTP для восстановления пароля, приветственных писем и уведомлений.
            </p>
          </div>
          <Badge variant={config.hasPassword ? 'default' : 'secondary'} className="w-fit">
            {config.hasPassword ? 'настроено' : 'не настроено'}
          </Badge>
        </div>

        {result && (
          <Alert className={result.success ? 'mb-5 border-emerald-500/50 bg-emerald-500/10' : 'mb-5 border-destructive/50 bg-destructive/10'}>
            {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">SMTP сервер</Label>
            <Input
              id="smtp-host"
              placeholder="mail.example.kz"
              value={config.host}
              onChange={(event) => updateConfig({ host: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label>Порт</Label>
              <Select
                value={String(config.port)}
                onValueChange={(value) => {
                  const port = Number(value);
                  updateConfig({ port, secure: port === 465 });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="465">465 SSL/TLS</SelectItem>
                  <SelectItem value="587">587 STARTTLS</SelectItem>
                  <SelectItem value="25">25 STARTTLS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-secure">SSL</Label>
              <div className="flex h-10 items-center rounded-md border px-3">
                <Switch
                  id="smtp-secure"
                  checked={config.secure}
                  onCheckedChange={(secure) => updateConfig({ secure })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-user">Логин / email ящика</Label>
            <Input
              id="smtp-user"
              type="email"
              placeholder="no-reply@example.kz"
              value={config.user}
              onChange={(event) => {
                const user = event.target.value;
                updateConfig({ user, from: config.from || user });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-password">Пароль ящика</Label>
            <Input
              id="smtp-password"
              type="password"
              placeholder={config.hasPassword ? 'оставьте пустым, чтобы не менять' : 'пароль SMTP'}
              value={config.password}
              onChange={(event) => updateConfig({ password: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-from">Email отправителя</Label>
            <Input
              id="smtp-from"
              type="email"
              placeholder="no-reply@example.kz"
              value={config.from}
              onChange={(event) => updateConfig({ from: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-from-name">Имя отправителя</Label>
            <Input
              id="smtp-from-name"
              placeholder="SUITE-A"
              value={config.fromName}
              onChange={(event) => updateConfig({ fromName: event.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 border-t pt-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="smtp-test-recipient">Куда отправить тест</Label>
              <Input
                id="smtp-test-recipient"
                type="email"
                placeholder="admin@example.kz"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-auto"
              onClick={handleTest}
              disabled={testing || !isReadyToSave || !testRecipient.trim()}
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Проверить
            </Button>

            <Button
              type="button"
              className="mt-auto"
              onClick={handleSave}
              disabled={saving || !isReadyToSave}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Сохранить
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h4 className="mb-2 flex items-center gap-2 font-semibold">
          <Send className="h-4 w-4 text-primary" />
          Что будет отправляться
        </h4>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="rounded-md border p-3">Восстановление пароля</div>
          <div className="rounded-md border p-3">Данные входа новым сотрудникам</div>
          <div className="rounded-md border p-3">Системные уведомления</div>
        </div>
      </Card>
    </div>
  );
}

export default EmailSettingsPanel;

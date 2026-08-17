import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle, Loader2, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordResetEmail } from '@/lib/emailService';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSent(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Введите корректный email');
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordResetEmail(normalizedEmail);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось отправить письмо восстановления');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">HUB</h1>
          </div>

          <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
                <Mail className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl text-white">Восстановление пароля</CardTitle>
              <CardDescription className="text-slate-400">
                Введите рабочий email. Мы отправим ссылку для нового пароля.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-900/20">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {sent && (
                <Alert className="mb-4 border-emerald-500/50 bg-emerald-900/20">
                  <CheckCircle className="h-4 w-4 text-emerald-300" />
                  <AlertDescription className="text-emerald-200">
                    Если такой аккаунт есть, письмо уже отправлено. Проверьте почту и спам.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-slate-200">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="your@email.com"
                    disabled={isLoading}
                    className="h-11 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-blue-600 font-semibold text-white hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Отправить ссылку
                </Button>
              </form>

              <div className="mt-5 border-t border-slate-700 pt-4 text-center">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
                  <ArrowLeft className="h-4 w-4" />
                  Вернуться ко входу
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

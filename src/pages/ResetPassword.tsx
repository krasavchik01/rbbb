import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const recoverSessionFromHash = async () => {
      if (typeof window === 'undefined' || !window.location.hash) return false;
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return false;

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      return !!data.session;
    };

    const recoverSessionFromTokenHash = async () => {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash') || params.get('token');
      if (!tokenHash) return false;

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;

      window.history.replaceState(null, document.title, window.location.pathname);
      return !!data.session;
    };

    const checkSession = async () => {
      try {
        const recoveredFromTokenHash = await recoverSessionFromTokenHash();
        if (recoveredFromTokenHash && mounted) {
          setHasRecoverySession(true);
          setIsCheckingSession(false);
          return;
        }

        const recovered = await recoverSessionFromHash();
        if (recovered && mounted) {
          setHasRecoverySession(true);
          setIsCheckingSession(false);
          return;
        }
      } catch (sessionError) {
        console.error('Password recovery session error:', sessionError);
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(!!data.session);
      setIsCheckingSession(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    void checkSession();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const validate = () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
    if (newPassword !== confirmPassword) return 'Пароли не совпадают';
    return '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (email) {
        const { error: employeeError } = await supabase
          .from('employees')
          .update({ password: newPassword })
          .ilike('email', email);

        if (employeeError) throw employeeError;
      }

      setSuccess('Пароль обновлен. Сейчас вернем вас на вход.');
      setNewPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
      window.setTimeout(() => navigate('/'), 1800);
    } catch (err: any) {
      setError(err?.message || 'Не удалось обновить пароль');
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
                <KeyRound className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl text-white">Новый пароль</CardTitle>
              <CardDescription className="text-slate-400">
                Задайте новый пароль для входа в систему.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-900/20">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mb-4 border-emerald-500/50 bg-emerald-900/20">
                  <CheckCircle className="h-4 w-4 text-emerald-300" />
                  <AlertDescription className="text-emerald-200">{success}</AlertDescription>
                </Alert>
              )}

              {!isCheckingSession && !hasRecoverySession && !success && (
                <Alert className="mb-4 border-amber-500/50 bg-amber-900/20">
                  <AlertDescription className="text-amber-100">
                    Ссылка восстановления не активна или устарела. Запросите новую ссылку.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-200">Новый пароль</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={isLoading || !hasRecoverySession}
                    className="h-11 border-slate-700 bg-slate-800/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-200">Повторите пароль</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={isLoading || !hasRecoverySession}
                    className="h-11 border-slate-700 bg-slate-800/50 text-white"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-blue-600 font-semibold text-white hover:bg-blue-700"
                  disabled={isLoading || !hasRecoverySession}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить пароль
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

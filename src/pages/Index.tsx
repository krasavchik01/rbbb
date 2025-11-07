import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';

const Index = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Неверный email или пароль');
      }
    } catch (error) {
      setError('Произошла ошибка при входе');
    } finally {
      setIsLoading(false);
    }
  };

  // Демо-аккаунты для быстрого входа
  const demoAccounts = [
    { email: "ceo@rbpartners.com", password: "ceo", role: "CEO", icon: "👔" },
    { email: "deputy@mak.kz", password: "deputy", role: "Зам. директора", icon: "🏢" },
    { email: "procurement@rbpartners.com", password: "procurement", role: "Отдел закупок", icon: "📦" },
    { email: "partner@rbpartners.com", password: "partner", role: "Партнер", icon: "🤝" },
    { email: "admin", password: "admin", role: "Админ", icon: "🔑" },
  ];

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsLoading(true);
    setError("");

    try {
      const success = await login(demoEmail, demoPassword);
      if (success) {
        navigate("/dashboard");
      } else {
        setError("Ошибка входа");
      }
    } catch (error: any) {
      setError(error.message || "Произошла ошибка при входе");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
      
      <div className="w-full max-w-[1400px] mx-auto grid md:grid-cols-2 gap-6 relative z-10">
        {/* Форма входа */}
        <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50">
              <LogIn className="w-10 h-10 text-white" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">RB Partners Suite</CardTitle>
              <CardDescription className="text-slate-400 text-lg">
                Система управления группой компаний
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-900/20">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email / Логин</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="admin или your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  'Войти'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Демо-аккаунты */}
        <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <CardTitle className="text-2xl text-white">Быстрый вход</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Выберите роль для входа в систему (демо)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoAccounts.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3 bg-slate-800/30 border-slate-700 hover:bg-blue-900/20 hover:border-blue-500/50 transition-all"
                onClick={() => quickLogin(account.email, account.password)}
                disabled={isLoading}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-2xl">{account.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{account.role}</div>
                    <div className="text-xs text-slate-400">
                      {account.email.length > 25 ? account.email.substring(0, 25) + '...' : account.email}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-mono bg-slate-800/50 px-2 py-1 rounded">
                    {account.password}
                  </div>
                </div>
              </Button>
            ))}

            <div className="pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-400 text-center">
                💡 Полный список учетных данных в файле <code className="bg-slate-800/50 px-2 py-1 rounded text-blue-400">DEMO_USERS.md</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;

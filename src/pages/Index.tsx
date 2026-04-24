import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, LogIn, Sparkles, UserPlus, Building2, Users, FolderKanban, BarChart3 } from 'lucide-react';
import { useAppSettings } from '@/lib/appSettings';

const Index = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [appSettings] = useAppSettings();

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
  type DemoAccount = {
    email: string;
    password: string;
    role: string;
    icon: string;
    category: string;
  };

  const demoAccounts: DemoAccount[] = [
    { email: "ceo@rbpartners.com", password: "ceo", role: "CEO", icon: "👔", category: "Руководство" },
    { email: "deputy@mak.kz", password: "deputy", role: "Зам. директора", icon: "🏢", category: "Руководство" },
    { email: "procurement@rbpartners.com", password: "procurement", role: "Отдел закупок", icon: "📦", category: "Отдел закупок" },
    { email: "partner@rbpartners.com", password: "partner", role: "Партнер", icon: "🤝", category: "Партнеры" },
    { email: "manager@rbpartners.com", password: "manager", role: "Менеджер 1", icon: "👨‍💼", category: "Менеджеры" },
    { email: "manager2@rbpartners.com", password: "manager2", role: "Менеджер 2", icon: "👨‍💼", category: "Менеджеры" },
    { email: "manager3@rbpartners.com", password: "manager3", role: "Менеджер 3", icon: "👨‍💼", category: "Менеджеры" },
    { email: "supervisor1@rbpartners.com", password: "supervisor1", role: "Супервайзер 1", icon: "👨‍🔬", category: "Супервайзеры" },
    { email: "supervisor2@rbpartners.com", password: "supervisor2", role: "Супервайзер 2", icon: "👨‍🔬", category: "Супервайзеры" },
    { email: "supervisor@rbpartners.com", password: "supervisor", role: "Супервайзер 3", icon: "👨‍🔬", category: "Супервайзеры" },
    { email: "assistant1@rbpartners.com", password: "assistant1", role: "Ассистент 1", icon: "👨‍💻", category: "Ассистенты" },
    { email: "assistant2@rbpartners.com", password: "assistant2", role: "Ассистент 2", icon: "👨‍💻", category: "Ассистенты" },
    { email: "assistant@rbpartners.com", password: "assistant", role: "Ассистент 3", icon: "👨‍💻", category: "Ассистенты" },
    { email: "tax@rbpartners.com", password: "tax", role: "Налоговик", icon: "📊", category: "Специалисты" },
    { email: "admin", password: "admin", role: "Админ", icon: "🔑", category: "Администраторы" },
  ];

  const groupedAccounts = demoAccounts.reduce((acc, account) => {
    const category = account.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(account);
    return acc;
  }, {} as Record<string, DemoAccount[]>);

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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="flex min-h-screen">
        {/* Левая часть - Информация о системе */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center p-8 xl:p-16 bg-gradient-to-br from-blue-900/50 to-slate-900/50">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">SUITE-A</h1>
                <p className="text-blue-300">Group Management Platform</p>
              </div>
            </div>

            <p className="text-xl text-slate-300 mb-12">
              Комплексная система управления группой компаний с полным циклом проектной работы
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <FolderKanban className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Управление проектами</h3>
                <p className="text-slate-400 text-sm">Полный цикл от создания до завершения проекта с контролем этапов</p>
              </div>
              <div className="bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <Users className="w-10 h-10 text-green-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Команда и роли</h3>
                <p className="text-slate-400 text-sm">20+ ролей с гибкой системой разрешений и бонусов</p>
              </div>
              <div className="bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <BarChart3 className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Аналитика</h3>
                <p className="text-slate-400 text-sm">Детальная статистика и отчеты по всем направлениям</p>
              </div>
              <div className="bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <Sparkles className="w-10 h-10 text-yellow-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Автоматизация</h3>
                <p className="text-slate-400 text-sm">Автоматический расчет бонусов и уведомления</p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая часть - Форма входа */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col justify-center p-4 sm:p-8">
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Мобильный логотип */}
            <div className="lg:hidden text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">SUITE-A</h1>
            </div>

            {/* Форма входа */}
            <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg">
              <CardHeader className="space-y-2 text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                  <LogIn className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-white">Вход в систему</CardTitle>
                <CardDescription className="text-slate-400">
                  Введите свои учетные данные
                </CardDescription>
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
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11"
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
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10 h-11"
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

                  <div className="text-center pt-4 border-t border-slate-700">
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Нет аккаунта? Зарегистрироваться
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Демо-вход - показывается только если включено в настройках */}
            {appSettings.showDemoUsers && (
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg hover:border-blue-500/40 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-yellow-400" />
                          <span className="text-white font-medium text-sm">Демо-аккаунты</span>
                        </div>
                        <div className="text-slate-400 group-open:rotate-180 transition-transform text-sm">▼</div>
                      </div>
                    </CardContent>
                  </Card>
                </summary>
                <Card className="border-blue-500/20 bg-slate-900/80 backdrop-blur-lg mt-2">
                  <CardContent className="space-y-2 max-h-[300px] overflow-y-auto pt-4">
                    {Object.entries(groupedAccounts).map(([category, accounts]) => (
                      <div key={category} className="space-y-1">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                          {category}
                        </div>
                        {accounts.map((account) => (
                          <Button
                            key={account.email}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-left h-auto py-1.5 bg-slate-800/30 border-slate-700 hover:bg-blue-900/20 hover:border-blue-500/50 transition-all"
                            onClick={() => quickLogin(account.email, account.password)}
                            disabled={isLoading}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-base flex-shrink-0">{account.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white text-xs truncate">{account.role}</div>
                              </div>
                              <div className="text-xs text-slate-500 font-mono bg-slate-800/50 px-1.5 py-0.5 rounded flex-shrink-0">
                                {account.password}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

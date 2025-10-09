import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login } = useAuth();

  useEffect(() => {
    // Если пользователь уже залогинен, перенаправляем на главную
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const success = await login(email, password);

      if (success) {
        toast({
          title: "Вход выполнен",
          description: "Добро пожаловать в RB Partners Suite!",
        });
        navigate("/");
      } else {
        setError("Неверный email или пароль");
      }
    } catch (error: any) {
      setError(error.message || "Произошла ошибка при входе");
    } finally {
      setIsLoading(false);
    }
  };

  // Демо-аккаунты для быстрого входа
  const demoAccounts = [
    { email: "ceo@rbpartners.com", password: "ceo", role: "CEO - Генеральный директор", icon: "👔" },
    { email: "deputy@mak.kz", password: "deputy", role: "Заместитель ген. директора", icon: "🏢" },
    { email: "procurement@rbpartners.com", password: "procurement", role: "Отдел закупок", icon: "📦" },
    { email: "partner@rbpartners.com", password: "partner", role: "Партнер", icon: "🤝" },
    { email: "admin", password: "admin", role: "Администратор", icon: "🔑" },
  ];

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsLoading(true);
    setError("");

    try {
      const success = await login(demoEmail, demoPassword);

      if (success) {
        toast({
          title: "Вход выполнен",
          description: "Добро пожаловать в RB Partners Suite!",
        });
        navigate("/");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6">
        {/* Форма входа */}
        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              RB Partners Suite
            </CardTitle>
            <CardDescription>
              Система управления проектами группы компаний
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email / Логин</Label>
                <Input
                  id="signin-email"
                  type="text"
                  placeholder="admin или your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full btn-gradient" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Демо-аккаунты */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">🚀 Быстрый вход (Демо)</CardTitle>
            <CardDescription>
              Выберите роль для входа в систему
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoAccounts.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3 hover:bg-primary/10 hover:border-primary transition-all"
                onClick={() => quickLogin(account.email, account.password)}
                disabled={isLoading}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-2xl">{account.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{account.role}</div>
                    <div className="text-xs text-muted-foreground">
                      {account.email} / {account.password}
                    </div>
                  </div>
                </div>
              </Button>
            ))}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                💡 Все учетные данные находятся в файле <code className="bg-muted px-1 py-0.5 rounded">DEMO_USERS.md</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

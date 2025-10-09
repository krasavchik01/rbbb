import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, RefreshCw, Database, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'checking';
  message: string;
  details?: string;
}

export default function SupabaseDiagnostics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // 1. Проверка подключения к Supabase
    results.push({ name: "Подключение к Supabase", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      const { error } = await supabase.from('project_data').select('id').limit(1);
      
      if (error) {
        if (error.message.includes('does not exist')) {
          results[0] = {
            name: "Подключение к Supabase",
            status: 'warning',
            message: "Подключение работает, но таблица не создана",
            details: "Нужно применить SQL миграцию через Supabase Dashboard"
          };
        } else {
          results[0] = {
            name: "Подключение к Supabase",
            status: 'error',
            message: "Ошибка подключения",
            details: error.message
          };
        }
      } else {
        results[0] = {
          name: "Подключение к Supabase",
          status: 'success',
          message: "✅ Подключение работает!",
          details: "Таблица project_data доступна"
        };
      }
    } catch (e: any) {
      results[0] = {
        name: "Подключение к Supabase",
        status: 'error',
        message: "❌ Не удалось подключиться",
        details: e.message
      };
    }
    setDiagnostics([...results]);

    // 2. Проверка аутентификации
    results.push({ name: "Аутентификация", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        results[1] = {
          name: "Аутентификация",
          status: 'success',
          message: "✅ Пользователь авторизован в Supabase",
          details: `Email: ${session.user.email}`
        };
      } else {
        results[1] = {
          name: "Аутентификация",
          status: 'warning',
          message: "⚠️ Пользователь не авторизован в Supabase",
          details: `Используется локальная аутентификация (это нормально!)`
        };
      }
    } catch (e: any) {
      results[1] = {
        name: "Аутентификация",
        status: 'warning',
        message: "⚠️ Локальная аутентификация",
        details: "Используется localStorage (это безопасно)"
      };
    }
    setDiagnostics([...results]);

    // 3. Проверка localStorage
    results.push({ name: "Локальное хранилище", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      const testKey = 'rb_diagnostics_test';
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (value === 'test') {
        // Подсчитываем сколько данных в localStorage
        let totalSize = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
          }
        }
        
        const sizeKB = (totalSize / 1024).toFixed(2);
        const percentUsed = ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1);
        
        results[2] = {
          name: "Локальное хранилище",
          status: 'success',
          message: "✅ localStorage работает отлично!",
          details: `Используется: ${sizeKB} КБ (~${percentUsed}% из 5 МБ)`
        };
      }
    } catch (e: any) {
      results[2] = {
        name: "Локальное хранилище",
        status: 'error',
        message: "❌ localStorage недоступен",
        details: e.message
      };
    }
    setDiagnostics([...results]);

    // 4. Проверка данных проектов в localStorage
    results.push({ name: "Данные проектов (localStorage)", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      const projectDataKeys = Object.keys(localStorage).filter(key => key.startsWith('rb_project_data_'));
      const projectsData = localStorage.getItem('rb_projects');
      
      results[3] = {
        name: "Данные проектов (localStorage)",
        status: 'success',
        message: `✅ Найдено проектов: ${projectDataKeys.length}`,
        details: `Основные проекты: ${projectsData ? JSON.parse(projectsData).length : 0}`
      };
    } catch (e: any) {
      results[3] = {
        name: "Данные проектов (localStorage)",
        status: 'warning',
        message: "⚠️ Нет данных проектов",
        details: "Это нормально если проектов ещё не создано"
      };
    }
    setDiagnostics([...results]);

    // 5. Проверка шаблонов
    results.push({ name: "Шаблоны проектов", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      const templatesData = localStorage.getItem('rb_templates');
      if (templatesData) {
        const templates = JSON.parse(templatesData);
        results[4] = {
          name: "Шаблоны проектов",
          status: 'success',
          message: `✅ Найдено шаблонов: ${templates.length}`,
          details: templates.map((t: any) => t.name).join(', ')
        };
      } else {
        results[4] = {
          name: "Шаблоны проектов",
          status: 'warning',
          message: "⚠️ Нет шаблонов",
          details: "Шаблоны будут созданы автоматически при первом входе в Template Editor"
        };
      }
    } catch (e: any) {
      results[4] = {
        name: "Шаблоны проектов",
        status: 'error',
        message: "❌ Ошибка чтения шаблонов",
        details: e.message
      };
    }
    setDiagnostics([...results]);

    // 6. Тест синхронизации
    results.push({ name: "Тест синхронизации", status: 'checking', message: "Проверка..." });
    setDiagnostics([...results]);

    try {
      // Пытаемся создать тестовую запись
      const testData = {
        project_id: 'test_diagnostic_' + Date.now(),
        template_id: 'test_template',
        template_version: 1,
        passport_data: { test: true },
        stages_data: {},
        completion_status: { totalElements: 0, completedElements: 0, percentage: 0 },
        history: [],
        created_by: user?.id
      };

      const { error: insertError } = await supabase
        .from('project_data')
        .insert(testData);

      if (insertError) {
        if (insertError.message.includes('does not exist')) {
          results[5] = {
            name: "Тест синхронизации",
            status: 'warning',
            message: "⚠️ Таблица не создана",
            details: "Нужно применить SQL миграцию. См. инструкцию ниже."
          };
        } else {
          results[5] = {
            name: "Тест синхронизации",
            status: 'warning',
            message: "⚠️ Синхронизация недоступна",
            details: insertError.message
          };
        }
      } else {
        // Удаляем тестовую запись
        await supabase
          .from('project_data')
          .delete()
          .eq('project_id', testData.project_id);

        results[5] = {
          name: "Тест синхронизации",
          status: 'success',
          message: "✅ Синхронизация работает!",
          details: "Данные успешно записываются в Supabase"
        };
      }
    } catch (e: any) {
      results[5] = {
        name: "Тест синхронизации",
        status: 'warning',
        message: "⚠️ Работает только localStorage",
        details: "Это нормально! Приложение полностью функционально."
      };
    }
    setDiagnostics([...results]);

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">OK</Badge>;
      case 'error':
        return <Badge variant="destructive">Ошибка</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Внимание</Badge>;
      case 'checking':
        return <Badge variant="outline">Проверка...</Badge>;
    }
  };

  const allSuccess = diagnostics.every(d => d.status === 'success');
  const hasErrors = diagnostics.some(d => d.status === 'error');
  const hasWarnings = diagnostics.some(d => d.status === 'warning');

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Диагностика системы
          </h1>
          <p className="text-muted-foreground mt-1">Проверка работоспособности и синхронизации</p>
        </div>
        <Button onClick={runDiagnostics} disabled={isRunning}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Overall Status */}
      {diagnostics.length > 0 && !isRunning && (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            {allSuccess ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-green-600">Всё отлично! 🎉</h2>
                  <p className="text-muted-foreground">Все системы работают нормально</p>
                </div>
              </>
            ) : hasErrors ? (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-red-600">Есть проблемы</h2>
                  <p className="text-muted-foreground">Требуется внимание</p>
                </div>
              </>
            ) : hasWarnings ? (
              <>
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-yellow-600">Работает с ограничениями</h2>
                  <p className="text-muted-foreground">Основные функции доступны</p>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      )}

      {/* Diagnostics Results */}
      <div className="space-y-3">
        {diagnostics.map((diagnostic, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(diagnostic.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{diagnostic.name}</h3>
                  {getStatusBadge(diagnostic.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{diagnostic.message}</p>
                {diagnostic.details && (
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2">
                    {diagnostic.details}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Как настроить Supabase синхронизацию
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">1️⃣ Зайдите в Supabase Dashboard:</p>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              https://supabase.com/dashboard
            </a>
          </div>
          <div>
            <p className="font-medium mb-1">2️⃣ Выберите свой проект</p>
          </div>
          <div>
            <p className="font-medium mb-1">3️⃣ Перейдите в SQL Editor</p>
          </div>
          <div>
            <p className="font-medium mb-1">4️⃣ Скопируйте и выполните SQL миграцию:</p>
            <p className="text-muted-foreground">Файл: <code className="bg-white px-2 py-1 rounded">supabase/migrations/20250109000001_project_data_tables.sql</code></p>
          </div>
          <div>
            <p className="font-medium mb-1">5️⃣ Обновите эту страницу</p>
          </div>
        </div>
      </Card>

      {/* Status Explanation */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-3">Что означают статусы?</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <span><strong>✅ Синхронизировано</strong> - данные сохраняются и в localStorage и в Supabase</span>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-yellow-500" />
            <span><strong>💾 Только локально</strong> - данные сохраняются только в localStorage (это нормально!)</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span><strong>Приложение ВСЕГДА работает</strong> - даже без Supabase все функции доступны</span>
          </div>
        </div>
      </Card>
    </div>
  );
}


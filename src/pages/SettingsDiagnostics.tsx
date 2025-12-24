import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/lib/appSettings';

export default function SettingsDiagnostics() {
  const [appSettings, updateAppSettings] = useAppSettings();
  const [supabaseData, setSupabaseData] = useState<any>(null);
  const [localStorageData, setLocalStorageData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const checkSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        setError(`Supabase Error: ${error.message}`);
        console.error('Supabase error:', error);
      } else {
        setSupabaseData(data);
        setError('');
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`);
      console.error('Exception:', err);
    }
  };

  const checkLocalStorage = () => {
    const stored = localStorage.getItem('rb_app_settings');
    if (stored) {
      setLocalStorageData(JSON.parse(stored));
    } else {
      setLocalStorageData(null);
    }
  };

  const testToggleDemoUsers = async () => {
    try {
      await updateAppSettings({ showDemoUsers: !appSettings.showDemoUsers });
      alert('Настройка изменена! Проверь другую вкладку/устройство');
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  useEffect(() => {
    checkSupabase();
    checkLocalStorage();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🔍 Диагностика настроек</h1>

      {/* Ошибка */}
      {error && (
        <Card className="p-6 bg-red-900/20 border-red-500">
          <h2 className="text-lg font-semibold text-red-400 mb-2">❌ Ошибка</h2>
          <pre className="text-sm text-red-300">{error}</pre>
        </Card>
      )}

      {/* Текущие настройки (React) */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">⚛️ Текущие настройки (React State)</h2>
        <pre className="bg-slate-800 p-4 rounded text-xs overflow-auto">
          {JSON.stringify(appSettings, null, 2)}
        </pre>
        <Button onClick={testToggleDemoUsers} className="mt-4">
          Переключить showDemoUsers (тест)
        </Button>
      </Card>

      {/* Данные из Supabase */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">🗄️ Данные из Supabase</h2>
          <Button onClick={checkSupabase} variant="outline" size="sm">
            Обновить
          </Button>
        </div>
        {supabaseData ? (
          <pre className="bg-slate-800 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(supabaseData, null, 2)}
          </pre>
        ) : (
          <div className="text-red-400">
            ❌ Нет данных! Таблица app_settings не найдена или пустая
          </div>
        )}
      </Card>

      {/* Данные из localStorage */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">💾 localStorage (кеш)</h2>
          <Button onClick={checkLocalStorage} variant="outline" size="sm">
            Обновить
          </Button>
        </div>
        {localStorageData ? (
          <pre className="bg-slate-800 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(localStorageData, null, 2)}
          </pre>
        ) : (
          <div className="text-muted-foreground">Пусто</div>
        )}
      </Card>

      {/* Инструкции */}
      <Card className="p-6 bg-blue-900/20 border-blue-500">
        <h2 className="text-lg font-semibold mb-2">📋 Что проверить:</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Если "Данные из Supabase" показывает ❌ - значит SQL миграция НЕ выполнена</li>
          <li>Если данные есть, но не совпадают с React State - проблема с кешем</li>
          <li>Нажми "Переключить showDemoUsers" - должно обновиться во всех вкладках</li>
          <li>Открой эту страницу на другом устройстве/браузере - должны быть те же данные</li>
        </ol>
      </Card>
    </div>
  );
}

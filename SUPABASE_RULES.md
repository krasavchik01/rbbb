# 🎯 ПРАВИЛА РАБОТЫ С SUPABASE - ПРОЕКТ RB PARTNERS

## ⚠️ КРИТИЧЕСКИ ВАЖНО

1. **НЕ УДАЛЯТЬ ГРАФИКИ И МЕТРИКИ** - только убирать демо-данные!
2. **Supabase - ОСНОВНОЕ хранилище**, localStorage - только кеш
3. **ВСЕ изменения проверять на работоспособность**
4. **Данные из Supabase загружаются через хуки** - не напрямую!

---

## 📁 СТРУКТУРА ПРОЕКТА

### Основные файлы для работы с данными:

```
src/
├── integrations/supabase/
│   ├── client.ts              # Клиент Supabase (НЕ ТРОГАТЬ!)
│   └── types.ts               # Типы из базы данных
├── lib/
│   ├── supabaseDataStore.ts   # Основной класс для работы с БД
│   └── dataStore.ts           # Старый store (fallback)
├── hooks/
│   └── useSupabaseData.ts     # React хуки для компонентов
└── pages/
    └── Dashboard.tsx          # ГЛАВНЫЙ дашборд (ОСТОРОЖНО!)
```

---

## 🔧 КАК РАБОТАТЬ С ДАННЫМИ

### ✅ ПРАВИЛЬНО:

```typescript
// В компонентах ВСЕГДА используй хуки:
import { useProjects, useEmployees } from '@/hooks/useSupabaseData';

function MyComponent() {
  const { projects, loading, error } = useProjects();
  const { employees } = useEmployees();
  
  // Работай с РЕАЛЬНЫМИ данными
  if (loading) return <Loader />;
  if (error) return <Error />;
  
  return <div>{projects.map(...)}</div>;
}
```

### ❌ НЕПРАВИЛЬНО:

```typescript
// НЕ делай так:
const demoProjects = [{ name: "Демо проект" }]; // ❌
const hardcodedData = [...]; // ❌
localStorage.getItem('projects'); // ❌ Только через хуки!
```

---

## 📊 DASHBOARD - СВЯЩЕННАЯ КОРОВА

### Что НЕЛЬЗЯ трогать:

1. **ВСЕ ГРАФИКИ** - Revenue Chart, Pie Chart, Bar Chart, KPI Chart
2. **Карточки метрик** - 4 карточки вверху
3. **ТОП-5 сотрудников** - блок с аватарами
4. **Дедлайны** - боковая панель
5. **Цели месяца** - Monthly Goals
6. **Анимации** - animate-bounce-in, hover-lift и т.д.

### Что МОЖНО менять:

1. **Источник данных** - с демо на реальные
2. **Пустые состояния** - когда нет данных
3. **Расчеты** - как считаются метрики

---

## 🗄️ ТАБЛИЦЫ В SUPABASE

### Основные таблицы:

1. **employees** - сотрудники
   - Поля: id, name, email, role, position, department, created_at
   
2. **projects** - проекты
   - Поля: id, name, status, amount, currency, client_name, created_at
   
3. **timesheets** - тайм-шиты
   - Поля: id, employee_id, project_id, hours, date
   
4. **bonuses** - бонусы
   - Поля: id, employee_id, amount, type
   
5. **companies** - компании
   - Поля: id, name, description

---

## 🔄 WORKFLOW: Как добавлять новые функции

### Шаг 1: Проверь хуки
```typescript
// Есть ли нужный хук?
useProjects() ✅
useEmployees() ✅
useTimesheets() ✅
useBonuses() ✅
```

### Шаг 2: Если нужен новый хук
```typescript
// Добавь в src/hooks/useSupabaseData.ts
export function useMyNewData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabaseDataStore.getMyData().then(setData);
  }, []);
  
  return { data, loading };
}
```

### Шаг 3: Добавь метод в supabaseDataStore
```typescript
// В src/lib/supabaseDataStore.ts
async getMyData() {
  const { data, error } = await supabase
    .from('my_table')
    .select('*');
  
  if (error) return this.getFromLocalStorage('my_key');
  return data || [];
}
```

---

## 🚨 ЧАСТЫЕ ОШИБКИ

### ❌ Ошибка #1: Удалил графики
```typescript
// БЫЛО (хорошо):
<AreaChart data={revenueData}>...</AreaChart>

// СТАЛО (плохо):
// <AreaChart... - удалено

// ИСПРАВЛЕНИЕ: Верни графики, убери только демо-данные!
```

### ❌ Ошибка #2: Хардкод демо-данных
```typescript
// ПЛОХО:
const topEmployees = [
  { name: "Анна Иванова", kpi: 95 }
];

// ХОРОШО:
const topEmployees = employees
  .map(emp => ({ ...emp, kpi: calculateKPI(emp) }))
  .sort((a, b) => b.kpi - a.kpi)
  .slice(0, 5);
```

### ❌ Ошибка #3: Прямой доступ к Supabase в компонентах
```typescript
// ПЛОХО:
const { data } = await supabase.from('employees').select();

// ХОРОШО:
const { employees } = useEmployees();
```

---

## 📝 ЧЕКЛИСТ ПЕРЕД КОММИТОМ

- [ ] Нет демо-данных (Анна Иванова, Петров и т.д.)
- [ ] Все графики на месте
- [ ] Используются хуки (не прямые запросы)
- [ ] Dashboard работает
- [ ] Проекты загружаются из Supabase
- [ ] Сотрудники загружаются из Supabase
- [ ] Empty states работают (когда нет данных)
- [ ] Loading states работают
- [ ] Сделан `npm run build` без ошибок
- [ ] Задеплоено на Vercel

---

## 🎨 СТИЛЬ КОДА

### Именование:
- Компоненты: `PascalCase`
- Функции: `camelCase`
- Константы: `UPPER_SNAKE_CASE`
- Хуки: `useMyHook`

### Комментарии:
```typescript
// ✅ ХОРОШО: Загружаем РЕАЛЬНЫЕ данные из Supabase
const { projects } = useProjects();

// ❌ ПЛОХО: данные
const x = useProjects();
```

---

## 🔥 ЭКСТРЕННЫЕ СЛУЧАИ

### Если сломался Dashboard:
1. Проверь хуки - они возвращают данные?
2. Проверь Supabase - подключен?
3. Проверь типы - совпадают?
4. Открой консоль браузера - какие ошибки?

### Если черный экран:
1. Проверь импорты - все на месте?
2. Проверь экспорты - `export default`?
3. Проверь `.map()` - не на undefined?
4. Проверь условный рендеринг - корректен?

---

## 👥 УПРАВЛЕНИЕ СОТРУДНИКАМИ

### Удаление сотрудников:
- **Только ADMIN** может удалять сотрудников
- Кнопка удаления должна быть в HR разделе
- Подтверждение перед удалением обязательно!

### Добавление сотрудников:
- Через форму HR (по одному)
- Через импорт Excel (массово)
- Все новые сотрудники сохраняются в Supabase

---

## 📞 КОНТАКТЫ

- Project: SUITE-A
- Supabase Project ID: `mknvqsnitzaurpwnhzwn`
- Supabase URL: https://mknvqsnitzaurpwnhzwn.supabase.co
- Vercel: projectbeastx-suite-main

---

## 🎯 ЗОЛОТОЕ ПРАВИЛО

**"Данные меняются, визуал остается!"**

Всегда помни: пользователь хочет видеть крутой дашборд с графиками,
просто с РЕАЛЬНЫМИ данными вместо демо!

---

## 🗑️ КАК УДАЛИТЬ ДЕМО-ДАННЫЕ

### Из кода:
```typescript
// Удали все массивы с хардкодом:
const demoEmployees = [...]; // ❌ УДАЛИТЬ
const demoProjects = [...]; // ❌ УДАЛИТЬ
```

### Из Supabase:
```sql
-- Удалить всех демо-сотрудников
DELETE FROM employees WHERE name LIKE '%Иванова%' OR name LIKE '%Петров%';

-- Или через миграцию:
-- supabase/migrations/YYYYMMDD_clear_demo_employees.sql
```

### Из localStorage:
```typescript
// Автоочистка при загрузке (уже реализовано в dataStore.ts)
if (!localStorage.getItem('rb_data_cleared_v2')) {
  dataStore.clearAllDemoData();
  localStorage.setItem('rb_data_cleared_v2', 'true');
}
```

---

*Последнее обновление: 2025-01-22*
*Создано для обеспечения стабильной работы с Supabase и предотвращения случайного удаления важных компонентов*





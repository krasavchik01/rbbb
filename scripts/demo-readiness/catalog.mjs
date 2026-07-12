export const PAGE_CATALOG = {
  '/projects': { title: 'Свод проектов', expectedText: ['Проекты', 'Свод'] },
  '/timesheets': { title: 'Таймшиты', expectedText: ['Тайм', 'Часы'] },
  '/attendance': { title: 'Посещаемость', expectedText: ['Посещаемость'] },
  '/notifications': { title: 'Уведомления', expectedText: ['Уведомления'] },
  '/hr': { title: 'HR', expectedText: ['HR', 'Сотрудники'] },
  '/employees': { title: 'Сотрудники', expectedText: ['Сотрудники'] },
  '/analytics': { title: 'Аналитика', expectedText: ['Аналитика'] },
  '/assign-partners': { title: 'Назначение партнёров', expectedText: ['партн'] },
  '/bonuses': { title: 'Бонусы', expectedText: ['Бонусы'] },
  '/settings': { title: 'Настройки', expectedText: ['Настройки'] },
  '/user-management': { title: 'Пользователи', expectedText: ['Пользовател'] },
  '/create-project-procurement': { title: 'Создание проекта', expectedText: ['Создать проект', 'Новый проект'] },
  '/project-approval': { title: 'Утверждение проектов', expectedText: ['Утверждение'] },
  '/tenders': { title: 'Тендеры', expectedText: ['Тендер'] },
  '/diagnostics': { title: 'Диагностика', expectedText: ['Диагност'] },
  '/database-test': { title: 'Проверка базы данных', expectedText: ['База', 'Database', 'Supabase'] },
  '/smtp-settings': { title: 'Настройки почты', expectedText: ['SMTP', 'Email', 'Почт'] },
  '/role-management': { title: 'Управление ролями', expectedText: ['Рол'] },
  '/settings-diagnostics': { title: 'Диагностика настроек', expectedText: ['Диагност'] },
  '/ai': { title: 'AI-ассистент', expectedText: ['AI', 'ассистент'] },
};

export const ACTIVE_STATIC_ROUTES = new Set([
  '/',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/404',
  ...Object.keys(PAGE_CATALOG),
]);

export function isKnownInternalHref(href) {
  if (!href || !href.startsWith('/')) return true;
  const pathname = href.split(/[?#]/)[0];
  return ACTIVE_STATIC_ROUTES.has(pathname)
    || pathname.startsWith('/project/')
    || pathname.startsWith('/projects/');
}

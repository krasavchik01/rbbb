/**
 * Хук для автоматической проверки дедлайнов и отправки уведомлений
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { checkDeadlinesAndNotify, requestNotificationPermission } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';

export function useDeadlineNotifications() {
  const { user } = useAuth();
  const { projects, loading } = useProjects();
  const { toast } = useToast();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Запрашиваем разрешение на браузерные уведомления при первом входе
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  useEffect(() => {
    // Проверяем дедлайны только один раз при загрузке проектов
    if (!user || loading || projects.length === 0 || hasCheckedRef.current) {
      return;
    }

    const checkDeadlines = async () => {
      try {
        hasCheckedRef.current = true;

        const result = await checkDeadlinesAndNotify(
          projects,
          user.id,
          user.role
        );

        if (result.notified > 0) {
          toast({
            title: '⏰ Уведомления о дедлайнах',
            description: `Отправлено ${result.notified} уведомлений о приближающихся сроках`,
          });
        }
      } catch (error) {
        console.error('Ошибка проверки дедлайнов:', error);
      }
    };

    // Небольшая задержка чтобы дать UI загрузиться
    const timer = setTimeout(checkDeadlines, 2000);

    return () => clearTimeout(timer);
  }, [user, projects, loading, toast]);

  // Возвращаем функцию для ручной проверки
  const checkNow = async () => {
    if (!user || projects.length === 0) return { notified: 0, projects: [] };

    // Сбрасываем флаг последней проверки для принудительной проверки
    const lastCheckKey = `deadline_check_${user.id}`;
    localStorage.removeItem(lastCheckKey);

    return checkDeadlinesAndNotify(projects, user.id, user.role);
  };

  return { checkNow };
}

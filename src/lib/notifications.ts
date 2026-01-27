/**
 * Система уведомлений через Supabase
 * БЕЗ localStorage - только production база данных
 */

import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  action_url?: string;
  created_at: string;
  updated_at: string;
}

// Звуковое оповещение
export const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Could not play notification sound:', err));
  } catch (error) {
    console.log('Notification sound error:', error);
  }
};

/**
 * Получить уведомления пользователя из Supabase
 */
export const getNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    console.log('📥 [getNotifications] Загрузка уведомлений для userId:', userId);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [getNotifications] Ошибка загрузки уведомлений:', error);
      return [];
    }

    console.log(`✅ [getNotifications] Загружено ${data?.length || 0} уведомлений для userId: ${userId}`);
    return data || [];
  } catch (error) {
    console.error('❌ [getNotifications] Ошибка:', error);
    return [];
  }
};

/**
 * Добавить новое уведомление в Supabase
 */
export const addNotification = async (notification: Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'read'>): Promise<Notification | null> => {
  try {
    console.log('📤 [addNotification] Создание уведомления:', {
      userId: notification.user_id,
      title: notification.title,
      message: notification.message.slice(0, 50) + '...',
      type: notification.type
    });

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_url: notification.action_url,
        read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [addNotification] Ошибка создания уведомления:', error);
      return null;
    }

    console.log('✅ [addNotification] Уведомление создано:', data.id);

    // Воспроизводим звук
    playNotificationSound();

    return data as Notification;
  } catch (error) {
    console.error('❌ [addNotification] Ошибка:', error);
    return null;
  }
};

/**
 * Отметить уведомление как прочитанное
 */
export const markAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    console.log('📝 [markAsRead] Отмечаем уведомление как прочитанное:', notificationId);

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('❌ [markAsRead] Ошибка обновления:', error);
      return false;
    }

    console.log('✅ [markAsRead] Уведомление отмечено как прочитанное');
    return true;
  } catch (error) {
    console.error('❌ [markAsRead] Ошибка:', error);
    return false;
  }
};

/**
 * Отметить все уведомления пользователя как прочитанные
 */
export const markAllAsRead = async (userId: string): Promise<boolean> => {
  try {
    console.log('📝 [markAllAsRead] Отмечаем все уведомления как прочитанные для userId:', userId);

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ [markAllAsRead] Ошибка обновления:', error);
      return false;
    }

    console.log('✅ [markAllAsRead] Все уведомления отмечены как прочитанные');
    return true;
  } catch (error) {
    console.error('❌ [markAllAsRead] Ошибка:', error);
    return false;
  }
};

/**
 * Удалить уведомление
 */
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    console.log('🗑️ [deleteNotification] Удаление уведомления:', notificationId);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('❌ [deleteNotification] Ошибка удаления:', error);
      return false;
    }

    console.log('✅ [deleteNotification] Уведомление удалено');
    return true;
  } catch (error) {
    console.error('❌ [deleteNotification] Ошибка:', error);
    return false;
  }
};

/**
 * Получить количество непрочитанных уведомлений
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ [getUnreadCount] Ошибка подсчета:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ [getUnreadCount] Ошибка:', error);
    return 0;
  }
};

/**
 * Подписка на новые уведомления в реальном времени (Supabase Realtime)
 */
export const subscribeToNotifications = (userId: string, callback: (notification: Notification) => void) => {
  console.log('🔔 [subscribeToNotifications] Подписка на уведомления для userId:', userId);

  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('🆕 [subscribeToNotifications] Новое уведомление:', payload);
        callback(payload.new as Notification);
        playNotificationSound();
      }
    )
    .subscribe();

  return channel;
};

// ====================
// Специфичные функции для проектов (оставляем для совместимости)
// ====================

/**
 * Создать уведомление о новом проекте
 */
export const notifyNewProject = async (projectName: string, creatorName: string, recipientUserId: string) => {
  return addNotification({
    user_id: recipientUserId,
    title: '📋 Новый проект для утверждения',
    message: `${creatorName} создал проект "${projectName}". Требуется ваше утверждение.`,
    type: 'info',
    action_url: '/project-approval',
  });
};

/**
 * Уведомить зам. директора о новом проекте
 */
export const notifyDeputyDirectorNewProject = async (projectName: string, clientName: string, amount: string) => {
  // Находим зам. директора
  const deputyUserId = 'deputy_1'; // TODO: получать из базы

  console.log('🔔 Создаём уведомление для зам. директора:', {
    userId: deputyUserId,
    projectName,
    clientName,
    amount
  });

  const notification = await addNotification({
    user_id: deputyUserId,
    title: '📋 Новый проект требует утверждения',
    message: `Отдел закупок создал проект "${projectName}" для клиента ${clientName}. Сумма: ${amount} ₸. Требуется ваше утверждение.`,
    type: 'info',
    action_url: '/project-approval',
  });

  console.log('✅ Уведомление создано:', notification);

  return notification;
};

/**
 * Создать уведомление о назначении на проект
 */
export const notifyProjectAssignment = async (projectName: string, role: string, recipientUserId: string) => {
  return addNotification({
    user_id: recipientUserId,
    title: '🎯 Вы назначены на проект',
    message: `Вы назначены на проект "${projectName}" в роли ${role}.`,
    type: 'success',
    action_url: '/projects',
  });
};

/**
 * Создать уведомление о дедлайне
 */
export const notifyDeadline = async (projectName: string, daysLeft: number, recipientUserId: string) => {
  return addNotification({
    user_id: recipientUserId,
    title: '⏰ Приближается дедлайн',
    message: `Проект "${projectName}" - осталось ${daysLeft} дней до дедлайна.`,
    type: 'warning',
    action_url: '/projects',
  });
};

/**
 * Браузерные push-уведомления (опционально)
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Показать браузерное уведомление
 */
export const showBrowserNotification = (title: string, message: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  }
};

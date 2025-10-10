/**
 * Система уведомлений
 * Управление уведомлениями с звуковыми оповещениями
 */

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  userId: string;
  actionUrl?: string;
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

// Получить уведомления из localStorage
export const getNotifications = (userId?: string): Notification[] => {
  try {
    const stored = localStorage.getItem('notifications');
    if (!stored) return [];
    
    const all: Notification[] = JSON.parse(stored);
    
    // Фильтруем по userId если указан
    if (userId) {
      return all.filter(n => n.userId === userId);
    }
    
    return all;
  } catch (error) {
    console.error('Error loading notifications:', error);
    return [];
  }
};

// Сохранить уведомления
const saveNotifications = (notifications: Notification[]) => {
  try {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving notifications:', error);
  }
};

// Добавить новое уведомление
export const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  
  const notifications = getNotifications();
  notifications.unshift(newNotification);
  
  // Ограничиваем до 100 уведомлений
  if (notifications.length > 100) {
    notifications.splice(100);
  }
  
  saveNotifications(notifications);
  
  // Воспроизводим звук
  playNotificationSound();
  
  return newNotification;
};

// Отметить как прочитанное
export const markAsRead = (notificationId: string) => {
  const notifications = getNotifications();
  const notification = notifications.find(n => n.id === notificationId);
  
  if (notification) {
    notification.read = true;
    saveNotifications(notifications);
  }
};

// Отметить все как прочитанные
export const markAllAsRead = (userId: string) => {
  const notifications = getNotifications();
  notifications.forEach(n => {
    if (n.userId === userId) {
      n.read = true;
    }
  });
  saveNotifications(notifications);
};

// Удалить уведомление
export const deleteNotification = (notificationId: string) => {
  const notifications = getNotifications();
  const filtered = notifications.filter(n => n.id !== notificationId);
  saveNotifications(filtered);
};

// Получить количество непрочитанных
export const getUnreadCount = (userId: string): number => {
  const notifications = getNotifications(userId);
  return notifications.filter(n => !n.read).length;
};

// Создать уведомление о новом проекте
export const notifyNewProject = (projectName: string, creatorName: string, recipientUserId: string) => {
  return addNotification({
    userId: recipientUserId,
    title: '📋 Новый проект для утверждения',
    message: `${creatorName} создал проект "${projectName}". Требуется ваше утверждение.`,
    type: 'info',
    actionUrl: '/project-approval',
  });
};

// Уведомить зам. директора о новом проекте
export const notifyDeputyDirectorNewProject = (projectName: string, clientName: string, amount: string) => {
  // Находим зам. директора (обычно это 'deputy@mak.kz')
  const deputyUserId = 'deputy-1'; // ID зам. директора из AuthContext
  
  return addNotification({
    userId: deputyUserId,
    title: '📋 Новый проект требует утверждения',
    message: `Отдел закупок создал проект "${projectName}" для клиента ${clientName}. Сумма: ${amount} ₸. Требуется ваше утверждение.`,
    type: 'info',
    actionUrl: '/project-approval',
  });
};

// Создать уведомление о назначении на проект
export const notifyProjectAssignment = (projectName: string, role: string, recipientUserId: string) => {
  return addNotification({
    userId: recipientUserId,
    title: '🎯 Вы назначены на проект',
    message: `Вы назначены на проект "${projectName}" в роли ${role}.`,
    type: 'success',
    actionUrl: '/projects',
  });
};

// Создать уведомление о дедлайне
export const notifyDeadline = (projectName: string, daysLeft: number, recipientUserId: string) => {
  return addNotification({
    userId: recipientUserId,
    title: '⏰ Приближается дедлайн',
    message: `Проект "${projectName}" - осталось ${daysLeft} дней до дедлайна.`,
    type: 'warning',
    actionUrl: '/projects',
  });
};

// Браузерные push-уведомления (опционально)
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

// Показать браузерное уведомление
export const showBrowserNotification = (title: string, message: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  }
};

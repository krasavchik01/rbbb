/**
 * Система уведомлений
 */

export interface Notification {
  id: string;
  type: 'project_created' | 'project_approved' | 'project_assigned' | 'task_assigned' | 'deadline_soon' | 'project_completed';
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  fromUserId?: string;
  fromUserName?: string;
  toUserId: string;
  read: boolean;
  createdAt: string;
}

/**
 * Создать уведомление
 */
export function createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Notification {
  const newNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // Сохраняем в localStorage
  const notifications = getNotifications();
  notifications.push(newNotification);
  localStorage.setItem('rb_notifications', JSON.stringify(notifications));

  return newNotification;
}

/**
 * Получить все уведомления
 */
export function getNotifications(): Notification[] {
  const data = localStorage.getItem('rb_notifications');
  return data ? JSON.parse(data) : [];
}

/**
 * Получить уведомления для пользователя
 */
export function getNotificationsForUser(userId: string): Notification[] {
  return getNotifications().filter(n => n.toUserId === userId);
}

/**
 * Получить количество непрочитанных уведомлений
 */
export function getUnreadCount(userId: string): number {
  return getNotifications().filter(n => n.toUserId === userId && !n.read).length;
}

/**
 * Пометить уведомление как прочитанное
 */
export function markAsRead(notificationId: string): void {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index > -1) {
    notifications[index].read = true;
    localStorage.setItem('rb_notifications', JSON.stringify(notifications));
  }
}

/**
 * Пометить все уведомления как прочитанные
 */
export function markAllAsRead(userId: string): void {
  const notifications = getNotifications();
  const updated = notifications.map(n => 
    n.toUserId === userId ? { ...n, read: true } : n
  );
  localStorage.setItem('rb_notifications', JSON.stringify(updated));
}

/**
 * Удалить уведомление
 */
export function deleteNotification(notificationId: string): void {
  const notifications = getNotifications();
  const filtered = notifications.filter(n => n.id !== notificationId);
  localStorage.setItem('rb_notifications', JSON.stringify(filtered));
}

/**
 * Создать уведомление о новом проекте для зам. директора
 */
export function notifyDeputyDirectorNewProject(projectId: string, projectName: string, clientName: string, fromUserId: string, fromUserName: string): void {
  // Находим всех зам. директоров (для всех компаний MAK)
  const deputyDirectors = [
    { id: 'deputy-1', role: 'deputy_director' }, // Из AuthContext
  ];

  deputyDirectors.forEach(deputy => {
    createNotification({
      type: 'project_created',
      title: '📋 Новый проект на утверждение',
      message: `Проект "${projectName}" для клиента "${clientName}" создан отделом закупок. Требуется назначить команду.`,
      projectId,
      projectName,
      fromUserId,
      fromUserName,
      toUserId: deputy.id,
    });
  });
}

/**
 * Создать уведомление о назначении в проект
 */
export function notifyTeamMembersAssigned(projectId: string, projectName: string, teamMemberIds: string[], fromUserId: string, fromUserName: string): void {
  teamMemberIds.forEach(memberId => {
    createNotification({
      type: 'project_assigned',
      title: '👥 Вы назначены в проект',
      message: `Вы добавлены в команду проекта "${projectName}".`,
      projectId,
      projectName,
      fromUserId,
      fromUserName,
      toUserId: memberId,
    });
  });
}

/**
 * Создать уведомление об утверждении проекта
 */
export function notifyProjectApproved(projectId: string, projectName: string, partnerId: string, fromUserId: string, fromUserName: string): void {
  createNotification({
    type: 'project_approved',
    title: '✅ Проект утвержден',
    message: `Проект "${projectName}" утвержден и готов к работе.`,
    projectId,
    projectName,
    fromUserId,
    fromUserName,
    toUserId: partnerId,
  });
}


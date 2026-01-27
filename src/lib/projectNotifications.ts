/**
 * Система уведомлений для полного жизненного цикла проекта
 * Все функции async, работают через Supabase
 */

import { addNotification } from './notifications';

// ====================
// ЭТАП 1: Создание проекта
// ====================

/**
 * Отдел закупок создал проект → Уведомляет зам. директора
 */
export const notifyProjectCreated = async (params: {
  projectName: string;
  clientName: string;
  amount: string;
  currency: string;
  creatorName: string;
}) => {
  const deputyUserId = 'deputy_1';

  return addNotification({
    user_id: deputyUserId,
    title: '📋 Новый проект требует утверждения',
    message: `${params.creatorName} создал проект "${params.projectName}" для ${params.clientName}. Сумма: ${params.currency}${params.amount}. Требуется ваше утверждение.`,
    type: 'info',
    action_url: '/project-approval',
  });
};

// ====================
// ЭТАП 2: Утверждение проекта
// ====================

/**
 * Зам. директор утвердил проект → Уведомляет партнёра
 */
export const notifyProjectApproved = async (params: {
  projectName: string;
  partnerId: string;
  partnerName: string;
  approverName: string;
}) => {
  console.log(`📬 [notifyProjectApproved] Создание уведомления для партнера:`, {
    partnerId: params.partnerId,
    partnerName: params.partnerName,
    projectName: params.projectName,
    approverName: params.approverName
  });

  const notification = await addNotification({
    user_id: params.partnerId,
    title: '✅ Проект утверждён - распределите задачи',
    message: `${params.approverName} утвердил проект "${params.projectName}". Команда назначена. Откройте проект для распределения задач на основе процедур.`,
    type: 'success',
    action_url: '/projects',
  });

  console.log(`✅ [notifyProjectApproved] Уведомление создано:`, notification);

  return notification;
};

/**
 * Зам. директор отклонил проект → Уведомляет отдел закупок
 */
export const notifyProjectRejected = async (params: {
  projectName: string;
  reason: string;
  procurementUserId: string;
  rejectorName: string;
}) => {
  return addNotification({
    user_id: params.procurementUserId,
    title: '❌ Проект отклонён',
    message: `${params.rejectorName} отклонил проект "${params.projectName}". Причина: ${params.reason}`,
    type: 'error',
    action_url: '/projects',
  });
};

// ====================
// ЭТАП 3: Назначение PM
// ====================

/**
 * Партнёр назначил PM → Уведомляет PM
 */
export const notifyPMAssigned = async (params: {
  projectName: string;
  pmId: string;
  pmName: string;
  partnerName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.pmId,
    title: '🎯 Вы назначены менеджером проекта',
    message: `${params.partnerName} назначил вас PM на проект "${params.projectName}". Партнер распределит задачи на основе процедур, после чего вы получите уведомления о назначенных задачах.`,
    type: 'success',
    action_url: `/project/${params.projectId}`,
  });
};

// ====================
// ЭТАП 4: Сборка команды
// ====================

/**
 * PM добавил сотрудника в команду → Уведомляет сотрудника
 */
export const notifyTeamMemberAdded = async (params: {
  projectName: string;
  memberId: string;
  memberName: string;
  role: string;
  assignerName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.memberId,
    title: '👥 Вы добавлены в команду проекта',
    message: `${params.assignerName} добавил вас в проект "${params.projectName}" в роли ${params.role}.`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * PM удалил сотрудника из команды → Уведомляет сотрудника
 */
export const notifyTeamMemberRemoved = async (params: {
  projectName: string;
  memberId: string;
  removerName: string;
}) => {
  return addNotification({
    user_id: params.memberId,
    title: '⚠️ Вы удалены из проекта',
    message: `${params.removerName} удалил вас из проекта "${params.projectName}".`,
    type: 'warning',
    action_url: '/projects',
  });
};

/**
 * Команда собрана → Уведомляет всю команду
 */
export const notifyTeamAssembled = async (params: {
  projectName: string;
  teamIds: string[];
  projectId: string;
  pmName: string;
}) => {
  return Promise.all(
    params.teamIds.map(memberId =>
      addNotification({
        user_id: memberId,
        title: '🚀 Команда собрана - проект стартует',
        message: `${params.pmName} собрал команду для проекта "${params.projectName}". Начинаем работу!`,
        type: 'success',
        action_url: `/project/${params.projectId}`,
      })
    )
  );
};

// ====================
// ЭТАП 5: Работа над проектом
// ====================

/**
 * Создана новая задача → Уведомляет исполнителя
 */
export const notifyTaskAssigned = async (params: {
  taskName: string;
  assigneeId: string;
  projectName: string;
  deadline: string;
  creatorName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.assigneeId,
    title: '📝 Новая задача назначена',
    message: `${params.creatorName} назначил вам задачу "${params.taskName}" в проекте "${params.projectName}". Дедлайн: ${params.deadline}`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Задача завершена → Уведомляет PM
 */
export const notifyTaskCompleted = async (params: {
  taskName: string;
  pmId: string;
  completorName: string;
  projectName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.pmId,
    title: '✅ Задача выполнена',
    message: `${params.completorName} завершил задачу "${params.taskName}" в проекте "${params.projectName}".`,
    type: 'success',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Приближается дедлайн задачи → Уведомляет исполнителя
 */
export const notifyTaskDeadlineApproaching = async (params: {
  taskName: string;
  assigneeId: string;
  daysLeft: number;
  projectName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.assigneeId,
    title: '⏰ Дедлайн задачи приближается',
    message: `Задача "${params.taskName}" в проекте "${params.projectName}" - осталось ${params.daysLeft} дней.`,
    type: 'warning',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Задача просрочена → Уведомляет PM и исполнителя
 */
export const notifyTaskOverdue = async (params: {
  taskName: string;
  assigneeId: string;
  pmId: string;
  projectName: string;
  projectId: string;
}) => {
  // Уведомляем исполнителя
  await addNotification({
    user_id: params.assigneeId,
    title: '🚨 Задача просрочена!',
    message: `Дедлайн задачи "${params.taskName}" в проекте "${params.projectName}" истёк!`,
    type: 'error',
    action_url: `/project/${params.projectId}`,
  });

  // Уведомляем PM
  return addNotification({
    user_id: params.pmId,
    title: '🚨 Задача просрочена',
    message: `Задача "${params.taskName}" в проекте "${params.projectName}" просрочена!`,
    type: 'error',
    action_url: `/project/${params.projectId}`,
  });
};

// ====================
// ЭТАП 6: QA / Проверка
// ====================

/**
 * Проект отправлен на проверку → Уведомляет QA/супервайзера
 */
export const notifyProjectSentToReview = async (params: {
  projectName: string;
  reviewerId: string;
  pmName: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.reviewerId,
    title: '🔍 Проект на проверке',
    message: `${params.pmName} отправил проект "${params.projectName}" на вашу проверку.`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Проверка завершена - есть замечания → Уведомляет PM и команду
 */
export const notifyReviewCommentsAdded = async (params: {
  projectName: string;
  pmId: string;
  teamIds: string[];
  reviewerName: string;
  commentsCount: number;
  projectId: string;
}) => {
  const targets = [params.pmId, ...params.teamIds];

  return Promise.all(
    targets.map(userId =>
      addNotification({
        user_id: userId,
        title: '📝 Замечания по проекту',
        message: `${params.reviewerName} оставил ${params.commentsCount} замечаний по проекту "${params.projectName}". Требуется доработка.`,
        type: 'warning',
        action_url: `/project/${params.projectId}`,
      })
    )
  );
};

/**
 * Проверка пройдена → Уведомляет PM и партнёра
 */
export const notifyReviewPassed = async (params: {
  projectName: string;
  pmId: string;
  partnerId: string;
  reviewerName: string;
  projectId: string;
}) => {
  // Уведомляем PM
  await addNotification({
    user_id: params.pmId,
    title: '✅ Проект прошёл проверку',
    message: `${params.reviewerName} одобрил проект "${params.projectName}". Можно отправлять клиенту!`,
    type: 'success',
    action_url: `/project/${params.projectId}`,
  });

  // Уведомляем партнёра
  return addNotification({
    user_id: params.partnerId,
    title: '✅ Проект готов',
    message: `Проект "${params.projectName}" прошёл проверку и готов к отправке клиенту.`,
    type: 'success',
    action_url: `/project/${params.projectId}`,
  });
};

// ====================
// ЭТАП 7: Подписание клиентом
// ====================

/**
 * Отправлено клиенту → Уведомляет партнёра и CEO
 */
export const notifyProjectSentToClient = async (params: {
  projectName: string;
  partnerId: string;
  ceoId: string;
  pmName: string;
  projectId: string;
}) => {
  // Уведомляем партнёра
  await addNotification({
    user_id: params.partnerId,
    title: '📤 Проект отправлен клиенту',
    message: `${params.pmName} отправил проект "${params.projectName}" на подписание клиенту.`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });

  // Уведомляем CEO
  return addNotification({
    user_id: params.ceoId,
    title: '📤 Проект ожидает подписания',
    message: `Проект "${params.projectName}" отправлен клиенту на подписание.`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Клиент подписал → Уведомляет всех
 */
export const notifyProjectSignedByClient = async (params: {
  projectName: string;
  partnerId: string;
  pmId: string;
  teamIds: string[];
  ceoId: string;
  projectId: string;
}) => {
  const allUserIds = [params.ceoId, params.partnerId, params.pmId, ...params.teamIds];

  return Promise.all(
    allUserIds.map(userId =>
      addNotification({
        user_id: userId,
        title: '🎉 Клиент подписал проект!',
        message: `Проект "${params.projectName}" успешно подписан клиентом. Ожидаем выплаты бонусов.`,
        type: 'success',
        action_url: `/project/${params.projectId}`,
      })
    )
  );
};

// ====================
// ЭТАП 8: Выплата бонусов
// ====================

/**
 * CEO утвердил выплаты → Уведомляет команду
 */
export const notifyBonusesApproved = async (params: {
  projectName: string;
  teamIds: string[];
  ceoName: string;
  projectId: string;
}) => {
  return Promise.all(
    params.teamIds.map(memberId =>
      addNotification({
        user_id: memberId,
        title: '💰 Бонусы утверждены!',
        message: `${params.ceoName} утвердил выплату бонусов по проекту "${params.projectName}".`,
        type: 'success',
        action_url: '/bonuses',
      })
    )
  );
};

/**
 * Бонус начислен → Уведомляет сотрудника
 */
export const notifyBonusPaid = async (params: {
  employeeId: string;
  amount: string;
  currency: string;
  projectName: string;
}) => {
  return addNotification({
    user_id: params.employeeId,
    title: '💸 Бонус выплачен!',
    message: `Вам начислен бонус ${params.currency}${params.amount} за проект "${params.projectName}".`,
    type: 'success',
    action_url: '/bonuses',
  });
};

// ====================
// ЭТАП 9: Закрытие проекта
// ====================

/**
 * Проект закрыт → Уведомляет всю команду
 */
export const notifyProjectClosed = async (params: {
  projectName: string;
  partnerId: string;
  pmId: string;
  teamIds: string[];
  totalAmount: string;
  currency: string;
  projectId: string;
}) => {
  const allUserIds = [params.partnerId, params.pmId, ...params.teamIds];

  return Promise.all(
    allUserIds.map(userId =>
      addNotification({
        user_id: userId,
        title: '🏁 Проект завершён',
        message: `Проект "${params.projectName}" успешно завершён. Общая сумма: ${params.currency}${params.totalAmount}. Спасибо за работу!`,
        type: 'success',
        action_url: `/project/${params.projectId}`,
      })
    )
  );
};

// ====================
// ОБЩИЕ УВЕДОМЛЕНИЯ
// ====================

/**
 * Упоминание в комментарии
 */
export const notifyMentionedInComment = async (params: {
  mentionedUserId: string;
  projectName: string;
  authorName: string;
  comment: string;
  projectId: string;
}) => {
  return addNotification({
    user_id: params.mentionedUserId,
    title: '💬 Вас упомянули',
    message: `${params.authorName} упомянул вас в комментарии к проекту "${params.projectName}": "${params.comment.slice(0, 50)}..."`,
    type: 'info',
    action_url: `/project/${params.projectId}`,
  });
};

/**
 * Новый файл добавлен
 */
export const notifyFileUploaded = async (params: {
  projectName: string;
  fileName: string;
  uploaderName: string;
  teamIds: string[];
  projectId: string;
}) => {
  return Promise.all(
    params.teamIds.map(memberId =>
      addNotification({
        user_id: memberId,
        title: '📎 Новый файл добавлен',
        message: `${params.uploaderName} добавил файл "${params.fileName}" в проект "${params.projectName}".`,
        type: 'info',
        action_url: `/project/${params.projectId}`,
      })
    )
  );
};

# 🔔 Руководство по системе уведомлений

## Обзор

Система уведомлений отслеживает весь жизненный цикл проекта от создания до завершения.

## 📋 Этапы проекта и уведомления

### 1. Создание проекта
**Отдел закупок → Зам. директора**

```typescript
import { notifyProjectCreated } from '@/lib/projectNotifications';

notifyProjectCreated({
  projectName: "Аудит ТОО Компания",
  clientName: "ТОО Компания",
  amount: "5,000,000",
  currency: "₸",
  creatorName: "Иван Иванов"
});
```

### 2. Утверждение проекта
**Зам. директора → Партнёр**

```typescript
import { notifyProjectApproved } from '@/lib/projectNotifications';

notifyProjectApproved({
  projectName: "Аудит ТОО Компания",
  partnerId: "partner_1",
  partnerName: "Петров П.П.",
  approverName: "Сидоров С.С."
});
```

### 3. Назначение PM
**Партнёр → PM**

```typescript
import { notifyPMAssigned } from '@/lib/projectNotifications';

notifyPMAssigned({
  projectName: "Аудит ТОО Компания",
  pmId: "pm_1",
  pmName: "Алексеев А.А.",
  partnerName: "Петров П.П.",
  projectId: "project-123"
});
```

### 4. Добавление в команду
**PM → Член команды**

```typescript
import { notifyTeamMemberAdded } from '@/lib/projectNotifications';

notifyTeamMemberAdded({
  projectName: "Аудит ТОО Компания",
  memberId: "emp_1",
  memberName: "Иванова И.И.",
  role: "Старший аудитор",
  assignerName: "Алексеев А.А.",
  projectId: "project-123"
});
```

### 5. Назначение задачи
**PM → Исполнитель**

```typescript
import { notifyTaskAssigned } from '@/lib/projectNotifications';

notifyTaskAssigned({
  taskName: "Проверка первичных документов",
  assigneeId: "emp_1",
  projectName: "Аудит ТОО Компания",
  deadline: "2025-11-30",
  creatorName: "Алексеев А.А.",
  projectId: "project-123"
});
```

### 6. Завершение задачи
**Исполнитель → PM**

```typescript
import { notifyTaskCompleted } from '@/lib/projectNotifications';

notifyTaskCompleted({
  taskName: "Проверка первичных документов",
  pmId: "pm_1",
  completorName: "Иванова И.И.",
  projectName: "Аудит ТОО Компания",
  projectId: "project-123"
});
```

### 7. Проверка проекта
**PM → QA/Супервайзер**

```typescript
import { notifyProjectSentToReview } from '@/lib/projectNotifications';

notifyProjectSentToReview({
  projectName: "Аудит ТОО Компания",
  reviewerId: "supervisor_1",
  pmName: "Алексеев А.А.",
  projectId: "project-123"
});
```

### 8. Замечания по проекту
**QA → PM и команда**

```typescript
import { notifyReviewCommentsAdded } from '@/lib/projectNotifications';

notifyReviewCommentsAdded({
  projectName: "Аудит ТОО Компания",
  pmId: "pm_1",
  teamIds: ["emp_1", "emp_2"],
  reviewerName: "Смирнов С.С.",
  commentsCount: 5,
  projectId: "project-123"
});
```

### 9. Проверка пройдена
**QA → PM и Партнёр**

```typescript
import { notifyReviewPassed } from '@/lib/projectNotifications';

notifyReviewPassed({
  projectName: "Аудит ТОО Компания",
  pmId: "pm_1",
  partnerId: "partner_1",
  reviewerName: "Смирнов С.С.",
  projectId: "project-123"
});
```

### 10. Отправка клиенту
**PM → Партнёр и CEO**

```typescript
import { notifyProjectSentToClient } from '@/lib/projectNotifications';

notifyProjectSentToClient({
  projectName: "Аудит ТОО Компания",
  partnerId: "partner_1",
  ceoId: "ceo_1",
  pmName: "Алексеев А.А.",
  projectId: "project-123"
});
```

### 11. Подписание клиентом
**Автоматически → Вся команда и руководство**

```typescript
import { notifyProjectSignedByClient } from '@/lib/projectNotifications';

notifyProjectSignedByClient({
  projectName: "Аудит ТОО Компания",
  partnerId: "partner_1",
  pmId: "pm_1",
  teamIds: ["emp_1", "emp_2", "emp_3"],
  ceoId: "ceo_1",
  projectId: "project-123"
});
```

### 12. Утверждение бонусов
**CEO → Команда**

```typescript
import { notifyBonusesApproved } from '@/lib/projectNotifications';

notifyBonusesApproved({
  projectName: "Аудит ТОО Компания",
  teamIds: ["emp_1", "emp_2", "emp_3"],
  ceoName: "Генеральный Директор",
  projectId: "project-123"
});
```

### 13. Выплата бонуса
**Автоматически → Сотрудник**

```typescript
import { notifyBonusPaid } from '@/lib/projectNotifications';

notifyBonusPaid({
  employeeId: "emp_1",
  amount: "150,000",
  currency: "₸",
  projectName: "Аудит ТОО Компания"
});
```

### 14. Закрытие проекта
**Партнёр → Вся команда**

```typescript
import { notifyProjectClosed } from '@/lib/projectNotifications';

notifyProjectClosed({
  projectName: "Аудит ТОО Компания",
  partnerId: "partner_1",
  pmId: "pm_1",
  teamIds: ["emp_1", "emp_2", "emp_3"],
  totalAmount: "5,000,000",
  currency: "₸",
  projectId: "project-123"
});
```

## 🔔 Дополнительные уведомления

### Приближение дедлайна

```typescript
import { notifyTaskDeadlineApproaching } from '@/lib/projectNotifications';

notifyTaskDeadlineApproaching({
  taskName: "Проверка документов",
  assigneeId: "emp_1",
  daysLeft: 2,
  projectName: "Аудит ТОО Компания",
  projectId: "project-123"
});
```

### Просроченная задача

```typescript
import { notifyTaskOverdue } from '@/lib/projectNotifications';

notifyTaskOverdue({
  taskName: "Проверка документов",
  assigneeId: "emp_1",
  pmId: "pm_1",
  projectName: "Аудит ТОО Компания",
  projectId: "project-123"
});
```

### Упоминание в комментарии

```typescript
import { notifyMentionedInComment } from '@/lib/projectNotifications';

notifyMentionedInComment({
  mentionedUserId: "emp_1",
  projectName: "Аудит ТОО Компания",
  authorName: "Алексеев А.А.",
  comment: "Привет @Иванова, проверьте документы",
  projectId: "project-123"
});
```

### Новый файл

```typescript
import { notifyFileUploaded } from '@/lib/projectNotifications';

notifyFileUploaded({
  projectName: "Аудит ТОО Компания",
  fileName: "Отчет.pdf",
  uploaderName: "Алексеев А.А.",
  teamIds: ["emp_1", "emp_2"],
  projectId: "project-123"
});
```

## 📱 Браузерные уведомления

Запрос разрешения:

```typescript
import { requestNotificationPermission } from '@/lib/notifications';

await requestNotificationPermission();
```

Показать браузерное уведомление:

```typescript
import { showBrowserNotification } from '@/lib/notifications';

showBrowserNotification(
  "Новая задача",
  "Вам назначена задача 'Проверка документов'"
);
```

## 🎯 Где использовать

1. **CreateProjectProcurement.tsx** - при создании проекта
2. **ProjectApproval.tsx** - при утверждении/отклонении
3. **ProjectWorkspace.tsx** - при добавлении в команду, назначении задач
4. **Tasks.tsx** - при завершении задач
5. **Bonuses.tsx** - при выплате бонусов

## ✅ Чеклист интеграции

- [ ] Импортировать нужную функцию уведомления
- [ ] Вызывать после успешного действия
- [ ] Передать все обязательные параметры
- [ ] Проверить что userId правильный
- [ ] Протестировать на разных ролях





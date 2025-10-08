import { useState, useEffect, useCallback } from 'react';
import { dataStore, Project, Timesheet, Bonus, Vacation, Notification } from '@/store/dataStore';
import { Employee } from '@/types';
import { ProjectTemplate } from '@/types/methodology';
import { useToast } from '@/hooks/use-toast';

/**
 * Хук для работы с проектами
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = useCallback(() => {
    setProjects(dataStore.getProjects());
  }, []);

  const addProject = useCallback((project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    const newProject = dataStore.addProject(project);
    loadProjects();
    toast({
      title: 'Проект создан',
      description: `Проект "${newProject.name}" успешно создан`,
    });
    return newProject;
  }, [loadProjects, toast]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    const updated = dataStore.updateProject(id, updates);
    if (updated) {
      loadProjects();
      toast({
        title: 'Проект обновлён',
        description: `Проект "${updated.name}" успешно обновлён`,
      });
    }
    return updated;
  }, [loadProjects, toast]);

  const deleteProject = useCallback((id: string) => {
    const project = projects.find(p => p.id === id);
    const success = dataStore.deleteProject(id);
    if (success) {
      loadProjects();
      toast({
        title: 'Проект удалён',
        description: `Проект "${project?.name}" успешно удалён`,
        variant: 'destructive',
      });
    }
    return success;
  }, [projects, loadProjects, toast]);

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    refreshProjects: loadProjects,
  };
}

/**
 * Хук для работы с сотрудниками
 */
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = useCallback(() => {
    setEmployees(dataStore.getEmployees());
  }, []);

  const addEmployee = useCallback((employee: Omit<Employee, 'id'>) => {
    const newEmployee = dataStore.addEmployee(employee);
    loadEmployees();
    toast({
      title: 'Сотрудник добавлен',
      description: `${newEmployee.name} успешно добавлен`,
    });
    return newEmployee;
  }, [loadEmployees, toast]);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    const updated = dataStore.updateEmployee(id, updates);
    if (updated) {
      loadEmployees();
      toast({
        title: 'Сотрудник обновлён',
        description: `Данные ${updated.name} успешно обновлены`,
      });
    }
    return updated;
  }, [loadEmployees, toast]);

  const deleteEmployee = useCallback((id: string) => {
    const employee = employees.find(e => e.id === id);
    const success = dataStore.deleteEmployee(id);
    if (success) {
      loadEmployees();
      toast({
        title: 'Сотрудник удалён',
        description: `${employee?.name} успешно удалён`,
        variant: 'destructive',
      });
    }
    return success;
  }, [employees, loadEmployees, toast]);

  return {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    refreshEmployees: loadEmployees,
  };
}

/**
 * Хук для работы с тайм-шитами
 */
export function useTimesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = useCallback(() => {
    setTimesheets(dataStore.getTimesheets());
  }, []);

  const addTimesheet = useCallback((timesheet: Omit<Timesheet, 'id' | 'created_at'>) => {
    const newTimesheet = dataStore.addTimesheet(timesheet);
    loadTimesheets();
    toast({
      title: 'Запись добавлена',
      description: `Отмечено ${newTimesheet.hours} часов`,
    });
    return newTimesheet;
  }, [loadTimesheets, toast]);

  const updateTimesheet = useCallback((id: string, updates: Partial<Timesheet>) => {
    const updated = dataStore.updateTimesheet(id, updates);
    if (updated) {
      loadTimesheets();
      toast({
        title: 'Запись обновлена',
        description: 'Тайм-шит успешно обновлён',
      });
    }
    return updated;
  }, [loadTimesheets, toast]);

  const deleteTimesheet = useCallback((id: string) => {
    const success = dataStore.deleteTimesheet(id);
    if (success) {
      loadTimesheets();
      toast({
        title: 'Запись удалена',
        description: 'Тайм-шит успешно удалён',
        variant: 'destructive',
      });
    }
    return success;
  }, [loadTimesheets, toast]);

  return {
    timesheets,
    addTimesheet,
    updateTimesheet,
    deleteTimesheet,
    refreshTimesheets: loadTimesheets,
  };
}

/**
 * Хук для работы с бонусами
 */
export function useBonuses() {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadBonuses();
  }, []);

  const loadBonuses = useCallback(() => {
    setBonuses(dataStore.getBonuses());
  }, []);

  const addBonus = useCallback((bonus: Omit<Bonus, 'id' | 'created_at'>) => {
    const newBonus = dataStore.addBonus(bonus);
    loadBonuses();
    toast({
      title: 'Бонус добавлен',
      description: `Бонус ${newBonus.amount}₽ успешно добавлен`,
    });
    return newBonus;
  }, [loadBonuses, toast]);

  const updateBonus = useCallback((id: string, updates: Partial<Bonus>) => {
    const updated = dataStore.updateBonus(id, updates);
    if (updated) {
      loadBonuses();
      toast({
        title: 'Бонус обновлён',
        description: 'Данные бонуса успешно обновлены',
      });
    }
    return updated;
  }, [loadBonuses, toast]);

  const deleteBonus = useCallback((id: string) => {
    const success = dataStore.deleteBonus(id);
    if (success) {
      loadBonuses();
      toast({
        title: 'Бонус удалён',
        description: 'Бонус успешно удалён',
        variant: 'destructive',
      });
    }
    return success;
  }, [loadBonuses, toast]);

  return {
    bonuses,
    addBonus,
    updateBonus,
    deleteBonus,
    refreshBonuses: loadBonuses,
  };
}

/**
 * Хук для работы с отпусками
 */
export function useVacations() {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadVacations();
  }, []);

  const loadVacations = useCallback(() => {
    setVacations(dataStore.getVacations());
  }, []);

  const addVacation = useCallback((vacation: Omit<Vacation, 'id' | 'created_at'>) => {
    const newVacation = dataStore.addVacation(vacation);
    loadVacations();
    toast({
      title: 'Отпуск добавлен',
      description: `Отпуск на ${newVacation.days} дней успешно добавлен`,
    });
    return newVacation;
  }, [loadVacations, toast]);

  const updateVacation = useCallback((id: string, updates: Partial<Vacation>) => {
    const updated = dataStore.updateVacation(id, updates);
    if (updated) {
      loadVacations();
      toast({
        title: 'Отпуск обновлён',
        description: 'Данные отпуска успешно обновлены',
      });
    }
    return updated;
  }, [loadVacations, toast]);

  const deleteVacation = useCallback((id: string) => {
    const success = dataStore.deleteVacation(id);
    if (success) {
      loadVacations();
      toast({
        title: 'Отпуск удалён',
        description: 'Отпуск успешно удалён',
        variant: 'destructive',
      });
    }
    return success;
  }, [loadVacations, toast]);

  return {
    vacations,
    addVacation,
    updateVacation,
    deleteVacation,
    refreshVacations: loadVacations,
  };
}

/**
 * Хук для работы с уведомлениями
 */
export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = useCallback(() => {
    const all = dataStore.getNotifications();
    if (userId) {
      setNotifications(all.filter(n => n.user_id === userId));
    } else {
      setNotifications(all);
    }
  }, [userId]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'created_at'>) => {
    const newNotification = dataStore.addNotification(notification);
    loadNotifications();
    return newNotification;
  }, [loadNotifications]);

  const markAsRead = useCallback((id: string) => {
    dataStore.markNotificationAsRead(id);
    loadNotifications();
  }, [loadNotifications]);

  const markAllAsRead = useCallback(() => {
    if (userId) {
      dataStore.markAllNotificationsAsRead(userId);
      loadNotifications();
    }
  }, [userId, loadNotifications]);

  const deleteNotification = useCallback((id: string) => {
    dataStore.deleteNotification(id);
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: loadNotifications,
  };
}

/**
 * Хук для работы с шаблонами проектов (методологиями)
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = useCallback(() => {
    setTemplates(dataStore.getTemplates());
  }, []);

  const addTemplate = useCallback((template: Omit<ProjectTemplate, 'id' | 'created_at' | 'updated_at' | 'version'>) => {
    const newTemplate = dataStore.addTemplate(template);
    loadTemplates();
    toast({
      title: 'Шаблон создан',
      description: `Шаблон "${newTemplate.name}" успешно создан`,
    });
    return newTemplate;
  }, [loadTemplates, toast]);

  const updateTemplate = useCallback((id: string, updates: Partial<ProjectTemplate>) => {
    const updated = dataStore.updateTemplate(id, updates);
    if (updated) {
      loadTemplates();
      toast({
        title: 'Шаблон обновлён',
        description: `Шаблон "${updated.name}" успешно обновлён`,
      });
    }
    return updated;
  }, [loadTemplates, toast]);

  const deleteTemplate = useCallback((id: string) => {
    const template = templates.find(t => t.id === id);
    const success = dataStore.deleteTemplate(id);
    if (success) {
      loadTemplates();
      toast({
        title: 'Шаблон удалён',
        description: `Шаблон "${template?.name}" успешно удалён`,
        variant: 'destructive',
      });
    }
    return success;
  }, [templates, loadTemplates, toast]);

  const duplicateTemplate = useCallback((id: string) => {
    const duplicated = dataStore.duplicateTemplate(id);
    if (duplicated) {
      loadTemplates();
      toast({
        title: 'Шаблон скопирован',
        description: `Создана копия шаблона "${duplicated.name}"`,
      });
    }
    return duplicated;
  }, [loadTemplates, toast]);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    refreshTemplates: loadTemplates,
  };
}

/**
 * Хук для управления всем хранилищем
 */
export function useDataManager() {
  const { toast } = useToast();

  const clearAll = useCallback(() => {
    dataStore.clearAll();
    toast({
      title: 'Все данные удалены',
      description: 'Хранилище данных очищено',
      variant: 'destructive',
    });
  }, [toast]);

  const resetToDefaults = useCallback(() => {
    dataStore.resetToDefaults();
    toast({
      title: 'Данные сброшены',
      description: 'Восстановлены демо-данные по умолчанию',
    });
    // Принудительная перезагрузка страницы для обновления всех компонентов
    window.location.reload();
  }, [toast]);

  return {
    clearAll,
    resetToDefaults,
  };
}


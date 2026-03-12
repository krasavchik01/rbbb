/**
 * Хук для синхронизации данных проектов с Express-сервером (СХД/NAS)
 * С ПОЛНЫМ FALLBACK на localStorage!
 *
 * Принцип работы:
 * 1. Всегда работает с localStorage (быстро, офлайн)
 * 2. Пытается синхронизироваться с сервером (если доступен)
 * 3. Если сервер недоступен - работает только с localStorage
 */

import { useState, useCallback } from 'react';
import { ProjectData } from '@/types/methodology';
import { useToast } from '@/hooks/use-toast';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  error?: string;
}

// Базовый URL для API сервера
function getServerApiUrl(): string {
  if (typeof window !== 'undefined') {
    // В разработке Vite на 8080, сервер на 3000
    if (window.location.port === '8080') {
      return `http://${window.location.hostname}:3000/api`;
    }
    return '/api';
  }
  return '/api';
}

export function useProjectDataSync(projectId: string) {
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false
  });

  const projectDataKey = `rb_project_data_${projectId}`;
  const apiUrl = getServerApiUrl();

  // Проверка доступности сервера
  const checkServerConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch (e) {
      return false;
    }
  };

  // Загрузка данных из localStorage
  const loadFromLocalStorage = useCallback((): ProjectData | null => {
    try {
      const saved = localStorage.getItem(projectDataKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
    return null;
  }, [projectDataKey]);

  // Сохранение в localStorage
  const saveToLocalStorage = useCallback((data: ProjectData): void => {
    try {
      localStorage.setItem(projectDataKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить в локальное хранилище",
        variant: "destructive"
      });
    }
  }, [projectDataKey, toast]);

  // Загрузка данных с сервера (СХД)
  const loadFromServer = useCallback(async (): Promise<ProjectData | null> => {
    try {
      const response = await fetch(`${apiUrl}/project-data/${projectId}`);

      if (response.status === 404) {
        console.log('📂 Данные проекта на сервере не найдены (новый проект)');
        return null;
      }

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // Преобразуем из серверного формата
      const projectData: ProjectData = {
        projectId: data.project_id || data.projectId,
        templateId: data.template_id || data.templateId,
        templateVersion: data.template_version || data.templateVersion,
        passportData: data.passport_data || data.passportData || {},
        stagesData: data.stages_data || data.stagesData || {},
        completionStatus: data.completion_status || data.completionStatus || {
          totalElements: 0,
          completedElements: 0,
          percentage: 0
        },
        history: data.history || [],
        updated_at: data.updated_at
      };

      return projectData;
    } catch (e) {
      console.log('Сервер недоступен, работаем с localStorage:', e);
    }
    return null;
  }, [projectId, apiUrl]);

  // Сохранение на сервер (СХД)
  const saveToServer = useCallback(async (data: ProjectData): Promise<boolean> => {
    try {
      const isOnline = await checkServerConnection();
      if (!isOnline) {
        console.log('Сервер недоступен, сохраняем только в localStorage');
        return false;
      }

      const payload = {
        project_id: data.projectId,
        template_id: data.templateId,
        template_version: data.templateVersion,
        passport_data: data.passportData,
        stages_data: data.stagesData,
        completion_status: data.completionStatus,
        history: data.history,
      };

      const response = await fetch(`${apiUrl}/project-data/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      setSyncStatus(prev => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
        error: undefined
      }));

      return true;
    } catch (e: any) {
      console.log('Ошибка синхронизации с сервером:', e.message);
      setSyncStatus(prev => ({
        ...prev,
        error: e.message
      }));
      return false;
    }
  }, [projectId, apiUrl]);

  // Основная функция загрузки данных
  const loadProjectData = useCallback(async (): Promise<ProjectData | null> => {
    // СНАЧАЛА загружаем из localStorage (быстро)
    const localData = loadFromLocalStorage();

    // ЗАТЕМ пытаемся синхронизироваться с сервером
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    const isOnline = await checkServerConnection();

    if (isOnline) {
      const serverData = await loadFromServer();

      if (serverData) {
        // Сравнение версий по updated_at
        const localUpdatedAt = (localData as any)?.updated_at ? new Date((localData as any).updated_at).getTime() : 0;
        const remoteUpdatedAt = (serverData as any)?.updated_at ? new Date((serverData as any).updated_at).getTime() : 0;

        if (!localData || remoteUpdatedAt > localUpdatedAt) {
          console.log('🔄 Данные на сервере новее или локальных нет, обновляем локально');
          saveToLocalStorage(serverData);
          setSyncStatus({ isOnline: true, isSyncing: false, lastSyncAt: new Date().toISOString() });
          return serverData;
        } else if (localUpdatedAt > remoteUpdatedAt) {
          console.log('🔄 Локальные данные новее, сохраняем на сервер');
          await saveToServer(localData);
          setSyncStatus({ isOnline: true, isSyncing: false, lastSyncAt: new Date().toISOString() });
          return localData;
        } else {
          console.log('✅ Данные синхронизированы');
          setSyncStatus({ isOnline: true, isSyncing: false, lastSyncAt: new Date().toISOString() });
          return localData;
        }
      } else if (localData) {
        console.log('Сервер пуст, но есть локальные данные. Загружаем на сервер.');
        await saveToServer(localData);
        setSyncStatus({ isOnline: true, isSyncing: false, lastSyncAt: new Date().toISOString() });
        return localData;
      }

      setSyncStatus({ isOnline: true, isSyncing: false });
    } else {
      setSyncStatus({ isOnline: false, isSyncing: false });
    }

    return localData;
  }, [loadFromLocalStorage, loadFromServer, saveToLocalStorage, saveToServer]);

  // Основная функция сохранения данных
  const saveProjectData = useCallback(async (data: ProjectData): Promise<void> => {
    // ВСЕГДА сохраняем в localStorage (гарантированно работает)
    saveToLocalStorage(data);

    // ПЫТАЕМСЯ синхронизировать с сервером (не критично если не получится)
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    const synced = await saveToServer(data);
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      isOnline: synced
    }));
  }, [saveToLocalStorage, saveToServer]);

  // Принудительная синхронизация
  const forceSync = useCallback(async (): Promise<void> => {
    const localData = loadFromLocalStorage();
    if (!localData) {
      toast({
        title: "Нет данных",
        description: "Нет данных для синхронизации",
        variant: "destructive"
      });
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    const synced = await saveToServer(localData);

    if (synced) {
      toast({
        title: "Синхронизировано!",
        description: "Данные успешно сохранены на сервере (СХД)",
      });
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        isOnline: true,
        lastSyncAt: new Date().toISOString()
      }));
    } else {
      toast({
        title: "Сервер недоступен",
        description: "Данные сохранены локально, синхронизация будет позже",
        variant: "destructive"
      });
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        isOnline: false
      }));
    }
  }, [loadFromLocalStorage, saveToServer, toast]);

  return {
    loadProjectData,
    saveProjectData,
    forceSync,
    syncStatus
  };
}

/**
 * Хук для синхронизации данных проектов с Supabase
 * С ПОЛНЫМ FALLBACK на localStorage!
 * 
 * Принцип работы:
 * 1. Всегда работает с localStorage (быстро, офлайн)
 * 2. Пытается синхронизироваться с Supabase (если доступен)
 * 3. Если Supabase недоступен - работает только с localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProjectData } from '@/types/methodology';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  error?: string;
}

export function useProjectDataSync(projectId: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false
  });

  const projectDataKey = `rb_project_data_${projectId}`;

  // Проверка доступности Supabase
  const checkSupabaseConnection = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('project_data').select('id').limit(1);
      return !error;
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

  // Загрузка данных из Supabase
  const loadFromSupabase = useCallback(async (): Promise<ProjectData | null> => {
    try {
      const { data, error } = await supabase
        .from('project_data')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error) {
        console.log('Supabase load error (это нормально если проект новый):', error.message);
        return null;
      }

      if (data) {
        // Преобразуем из формата Supabase в наш формат
        const projectData: ProjectData = {
          projectId: data.project_id,
          templateId: data.template_id,
          templateVersion: data.template_version,
          passportData: data.passport_data || {},
          stagesData: data.stages_data || {},
          completionStatus: data.completion_status || {
            totalElements: 0,
            completedElements: 0,
            percentage: 0
          },
          history: data.history || []
        };

        return projectData;
      }
    } catch (e) {
      console.log('Supabase недоступен, работаем с localStorage:', e);
    }
    return null;
  }, [projectId]);

  // Сохранение в Supabase
  const saveToSupabase = useCallback(async (data: ProjectData): Promise<boolean> => {
    try {
      // Проверяем доступность
      const isOnline = await checkSupabaseConnection();
      if (!isOnline) {
        console.log('Supabase недоступен, сохраняем только в localStorage');
        return false;
      }

      // Проверяем существует ли запись
      const { data: existing } = await supabase
        .from('project_data')
        .select('id')
        .eq('project_id', projectId)
        .single();

      const payload = {
        project_id: data.projectId,
        template_id: data.templateId,
        template_version: data.templateVersion,
        passport_data: data.passportData,
        stages_data: data.stagesData,
        completion_status: data.completionStatus,
        history: data.history,
        created_by: user?.id
      };

      if (existing) {
        // Обновляем существующую запись
        const { error } = await supabase
          .from('project_data')
          .update(payload)
          .eq('project_id', projectId);

        if (error) throw error;
      } else {
        // Создаём новую запись
        const { error } = await supabase
          .from('project_data')
          .insert(payload);

        if (error) throw error;
      }

      setSyncStatus(prev => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
        error: undefined
      }));

      return true;
    } catch (e: any) {
      console.log('Ошибка синхронизации с Supabase:', e.message);
      setSyncStatus(prev => ({
        ...prev,
        error: e.message
      }));
      return false;
    }
  }, [projectId, user]);

  // Основная функция загрузки данных
  const loadProjectData = useCallback(async (): Promise<ProjectData | null> => {
    // СНАЧАЛА загружаем из localStorage (быстро)
    const localData = loadFromLocalStorage();

    // ЗАТЕМ пытаемся синхронизироваться с Supabase
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      const supabaseData = await loadFromSupabase();
      
      if (supabaseData) {
        // Если в Supabase есть более свежие данные - используем их
        if (!localData || new Date(supabaseData.completionStatus.toString()) > new Date(localData.completionStatus.toString())) {
          saveToLocalStorage(supabaseData);
          setSyncStatus({ isOnline: true, isSyncing: false, lastSyncAt: new Date().toISOString() });
          return supabaseData;
        }
      }
      
      setSyncStatus({ isOnline: true, isSyncing: false });
    } else {
      setSyncStatus({ isOnline: false, isSyncing: false });
    }

    // Возвращаем данные из localStorage
    return localData;
  }, [loadFromLocalStorage, loadFromSupabase, saveToLocalStorage]);

  // Основная функция сохранения данных
  const saveProjectData = useCallback(async (data: ProjectData): Promise<void> => {
    // ВСЕГДА сохраняем в localStorage (гарантированно работает)
    saveToLocalStorage(data);

    // ПЫТАЕМСЯ синхронизировать с Supabase (не критично если не получится)
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    const synced = await saveToSupabase(data);
    setSyncStatus(prev => ({ 
      ...prev, 
      isSyncing: false,
      isOnline: synced 
    }));

    // Не показываем тост о синхронизации каждый раз, только если важно
  }, [saveToLocalStorage, saveToSupabase]);

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
    const synced = await saveToSupabase(localData);
    
    if (synced) {
      toast({
        title: "Синхронизировано!",
        description: "Данные успешно сохранены на сервере",
      });
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        isOnline: true,
        lastSyncAt: new Date().toISOString()
      }));
    } else {
      toast({
        title: "Синхронизация недоступна",
        description: "Данные сохранены локально, синхронизация будет позже",
        variant: "destructive"
      });
      setSyncStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        isOnline: false
      }));
    }
  }, [loadFromLocalStorage, saveToSupabase, toast]);

  return {
    loadProjectData,
    saveProjectData,
    forceSync,
    syncStatus
  };
}




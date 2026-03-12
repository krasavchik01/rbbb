/**
 * Компонент для управления файлами проекта
 * Загрузка, просмотр, скачивание и удаление файлов
 */

import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  File,
  Download,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { supabase } from "@/integrations/supabase/client";
import { ProjectFile } from "@/types/project-v3";

interface ProjectFileManagerProps {
  projectId: string;
  uploadedBy: string;
  canDelete?: (file: ProjectFile) => boolean;
  onFilesChange?: (files: ProjectFile[]) => void;
  initialFiles?: any[]; // Файлы из notes.files (обход RLS)
}

export function ProjectFileManager({
  projectId,
  uploadedBy,
  canDelete = (file) => file.uploadedBy === uploadedBy,
  onFilesChange,
  initialFiles = []
}: ProjectFileManagerProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles as ProjectFile[]);

  // Обновляем файлы когда приходят initialFiles
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles as ProjectFile[]);
      onFilesChange?.(initialFiles as ProjectFile[]);
    }
  }, [initialFiles]);

  // Загрузка списка файлов
  const loadFiles = useCallback(async () => {
    try {
      // Сначала пробуем API
      const projectFiles = await supabaseDataStore.getProjectFiles(projectId);
      // Если API вернул пустой массив, используем initialFiles
      if (projectFiles.length === 0 && initialFiles.length > 0) {
        setFiles(initialFiles as ProjectFile[]);
        onFilesChange?.(initialFiles as ProjectFile[]);
        return;
      }
      setFiles(projectFiles);
      onFilesChange?.(projectFiles);
    } catch (error: any) {
      console.error('Error loading files:', error);
      // При ошибке используем initialFiles
      if (initialFiles.length > 0) {
        setFiles(initialFiles as ProjectFile[]);
        onFilesChange?.(initialFiles as ProjectFile[]);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список файлов",
        variant: "destructive",
      });
    }
  }, [projectId, onFilesChange, toast, initialFiles]);


  // Удаление файла
  const handleDeleteFile = async (file: ProjectFile) => {
    if (!canDelete(file)) {
      toast({
        title: "Доступ запрещен",
        description: "Вы можете удалять только свои файлы",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabaseDataStore.deleteProjectFile(file.id, uploadedBy, projectId);
      toast({
        title: "✅ Успех",
        description: `Файл "${file.fileName}" удален`,
      });
      await loadFiles();
    } catch (error: any) {
      toast({
        title: "❌ Ошибка",
        description: error?.message || "Не удалось удалить файл",
        variant: "destructive",
      });
    }
  };

  // Скачивание файла
  const handleDownloadFile = async (file: ProjectFile) => {
    try {
      let url = (file as any).publicUrl;

      // Если это файл из Seafile
      if ((file as any).isSeafile || (url && url.startsWith('seafile://'))) {
        try {
          const downloadUrl = await supabaseDataStore.getSeafileDownloadUrl(file.storagePath);
          if (downloadUrl) {
            url = downloadUrl;
          } else {
            throw new Error('Не удалось получить ссылку на файл из Seafile');
          }
        } catch (error) {
          console.error('Ошибка получения ссылки Seafile:', error);
          toast({
            title: "Ошибка конфигурации Seafile",
            description: "Невозможно скачать файл",
            variant: "destructive",
          });
          return;
        }
      }
      // Если публичного URL нет или он локальный, но файла локально нет, 
      // пробуем получить signed URL из Supabase Storage (наследие старой системы)
      else if (!url && file.storagePath) {
        try {
          // Определяем бакет по пути или категории
          let bucketName = 'project-files';
          if (file.storagePath.includes('contracts/')) bucketName = 'contracts';
          else if (file.storagePath.includes('documents/')) bucketName = 'documents';

          const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.storagePath, 3600); // URL действителен 1 час

          if (error) throw error;
          url = data.signedUrl;
        } catch (error) {
          console.error('Ошибка получения signed URL:', error);
          url = file.storagePath;
        }
      }

      if (url && !url.startsWith('seafile://')) {
        // Создаем временную ссылку для скачивания
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        toast({
          title: "Ошибка",
          description: "URL файла не найден",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Ошибка скачивания файла:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось скачать файл",
        variant: "destructive",
      });
    }
  };

  // Загружаем файлы при монтировании
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('image')) return '🖼️';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <File className="w-5 h-5" />
            Файлы проекта
          </h3>
        </div>

        {/* Список файлов */}
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Файлы не загружены
          </p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{getFileIcon(file.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)} • {file.category || 'other'} • {new Date(file.uploadedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadFile(file)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {canDelete(file) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}


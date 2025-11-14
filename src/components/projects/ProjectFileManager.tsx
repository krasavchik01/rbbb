/**
 * Компонент для управления файлами проекта
 * Загрузка, просмотр, скачивание и удаление файлов
 */

import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  File, 
  Download, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  X
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
}

export function ProjectFileManager({ 
  projectId, 
  uploadedBy,
  canDelete = (file) => file.uploadedBy === uploadedBy,
  onFilesChange 
}: ProjectFileManagerProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Загрузка списка файлов
  const loadFiles = useCallback(async () => {
    try {
      const projectFiles = await supabaseDataStore.getProjectFiles(projectId);
      setFiles(projectFiles);
      onFilesChange?.(projectFiles);
    } catch (error: any) {
      console.error('Error loading files:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список файлов",
        variant: "destructive",
      });
    }
  }, [projectId, onFilesChange, toast]);

  // Загрузка файла
  const handleFileUpload = async (file: File, category: ProjectFile['category'] = 'other') => {
    // Валидация размера (макс 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "Ошибка",
        description: `Файл слишком большой. Максимальный размер: 50MB`,
        variant: "destructive",
      });
      return;
    }

    // Валидация типа файла
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|jpg|jpeg|png|webp)$/i)) {
      toast({
        title: "Ошибка",
        description: "Разрешены только файлы: PDF, Word, изображения",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Симуляция прогресса (реальный прогресс нужно делать через Storage API с onUploadProgress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await supabaseDataStore.uploadProjectFile(
        projectId,
        file,
        category,
        uploadedBy
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: "✅ Успех",
        description: `Файл "${file.name}" успешно загружен`,
      });

      // Обновляем список файлов
      await loadFiles();
      
      // Сбрасываем состояние
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error: any) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      const errorMessage = error?.message || "Не удалось загрузить файл";
      setUploadError(errorMessage);
      toast({
        title: "❌ Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

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
      await supabaseDataStore.deleteProjectFile(file.id, uploadedBy);
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
      // Используем публичный URL из Storage
      let url = (file as any).publicUrl;
      
      // Если публичного URL нет, получаем signed URL из Supabase Storage
      if (!url && file.storagePath) {
        try {
          const { data, error } = await supabase.storage
            .from('project-files')
            .createSignedUrl(file.storagePath, 3600); // URL действителен 1 час
          
          if (error) throw error;
          url = data.signedUrl;
        } catch (error) {
          console.error('Ошибка получения signed URL:', error);
          // Пробуем использовать storagePath напрямую
          url = file.storagePath;
        }
      }
      
      if (url) {
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

  // Обработка выбора файлов
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    Array.from(selectedFiles).forEach(file => {
      handleFileUpload(file);
    });
    
    // Сбрасываем input
    e.target.value = '';
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
          <div className="flex items-center gap-2">
            <label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                className="cursor-pointer"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить файлы
                </span>
              </Button>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Прогресс загрузки */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Загрузка файла...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Ошибка загрузки */}
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{uploadError}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadError(null)}
              className="absolute top-2 right-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </Alert>
        )}

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


/**
 * Компонент для управления файлами проекта
 * Загрузка, просмотр, скачивание и удаление файлов
 */

import { useState, useCallback, useEffect, type ChangeEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  File,
  Download,
  Eye,
  Loader2,
  Trash2,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { supabase } from "@/integrations/supabase/client";
import { ProjectFile } from "@/types/project-v3";
import { dedupeProjectFiles } from "@/lib/contractData";

interface ProjectFileManagerProps {
  projectId: string;
  uploadedBy: string;
  canUpload?: boolean;
  canDelete?: (file: ProjectFile) => boolean;
  onFilesChange?: (files: ProjectFile[]) => void;
  initialFiles?: any[]; // Файлы из notes.files (обход RLS)
}

export function ProjectFileManager({
  projectId,
  uploadedBy,
  canUpload = true,
  canDelete = (file) => file.uploadedBy === uploadedBy,
  onFilesChange,
  initialFiles = []
}: ProjectFileManagerProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>(() => dedupeProjectFiles(initialFiles) as ProjectFile[]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeFileAction, setActiveFileAction] = useState<string | null>(null);

  // Обновляем файлы когда приходят initialFiles
  useEffect(() => {
    if (!Array.isArray(initialFiles)) return;
    const normalizedFiles = dedupeProjectFiles(initialFiles) as ProjectFile[];
    setFiles(normalizedFiles);
    onFilesChange?.(normalizedFiles);
  }, [initialFiles]);

  // Загрузка списка файлов
  const loadFiles = useCallback(async () => {
    try {
      // Сначала пробуем API
      const projectFiles = await supabaseDataStore.getProjectFiles(projectId);
      const normalizedProjectFiles = dedupeProjectFiles(projectFiles) as ProjectFile[];
      // Если API вернул пустой массив, используем initialFiles
      if (normalizedProjectFiles.length === 0 && initialFiles.length > 0) {
        const normalizedInitialFiles = dedupeProjectFiles(initialFiles) as ProjectFile[];
        setFiles(normalizedInitialFiles);
        onFilesChange?.(normalizedInitialFiles);
        return;
      }
      setFiles(normalizedProjectFiles);
      onFilesChange?.(normalizedProjectFiles);
    } catch (error: any) {
      console.error('Error loading files:', error);
      // При ошибке используем initialFiles
      if (initialFiles.length > 0) {
        const normalizedInitialFiles = dedupeProjectFiles(initialFiles) as ProjectFile[];
        setFiles(normalizedInitialFiles);
        onFilesChange?.(normalizedInitialFiles);
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

  const resolveFileUrl = async (file: ProjectFile) => {
    let url = (file as any).publicUrl;

    if ((file as any).isSeafile || (url && url.startsWith('seafile://'))) {
      const downloadUrl = await supabaseDataStore.getSeafileDownloadUrl(file.storagePath);
      if (downloadUrl) {
        url = downloadUrl;
      } else {
        throw new Error('Не удалось получить ссылку на файл из Seafile');
      }
    } else if (!url && file.storagePath) {
      try {
        let bucketName = 'project-files';
        if (file.storagePath.includes('contracts/')) bucketName = 'contracts';
        else if (file.storagePath.includes('documents/')) bucketName = 'documents';

        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(file.storagePath, 3600);

        if (error) throw error;
        url = data.signedUrl;
      } catch (error) {
        console.error('Ошибка получения signed URL:', error);
        url = file.storagePath;
      }
    }

    if (!url || url.startsWith('seafile://')) {
      throw new Error('URL файла не найден');
    }
    return url;
  };

  const fileActionKey = (file: ProjectFile, action: 'open' | 'download') =>
    `${action}:${file.id || file.storagePath || file.fileName}`;

  const handleOpenFile = async (file: ProjectFile) => {
    const key = fileActionKey(file, 'open');
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    setActiveFileAction(key);
    try {
      const url = new URL(await resolveFileUrl(file), window.location.origin).href;
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      previewWindow?.close();
      console.error('Ошибка открытия файла:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось открыть файл",
        variant: "destructive",
      });
    } finally {
      setActiveFileAction(null);
    }
  };

  // Скачивание файла
  const handleDownloadFile = async (file: ProjectFile) => {
    const key = fileActionKey(file, 'download');
    setActiveFileAction(key);
    try {
      const url = new URL(await resolveFileUrl(file), window.location.origin).href;
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Ошибка скачивания файла:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось скачать файл",
        variant: "destructive",
      });
    } finally {
      setActiveFileAction(null);
    }
  };

  const canPreviewFile = (file: ProjectFile) => {
    const value = `${file.fileType || ''} ${file.fileName || ''}`.toLowerCase();
    return /pdf|image|\.png|\.jpe?g|\.webp|\.gif/.test(value);
  };

  // Загружаем файлы при монтировании
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getFileIcon = (fileType?: string) => {
    const normalizedType = String(fileType || '').toLowerCase();
    if (normalizedType.includes('pdf')) return '📄';
    if (normalizedType.includes('word') || normalizedType.includes('document')) return '📝';
    if (normalizedType.includes('image')) return '🖼️';
    return '📎';
  };

  const formatFileSize = (bytes?: number) => {
    const safeBytes = Number(bytes) || 0;
    if (safeBytes < 1024) return `${safeBytes} B`;
    if (safeBytes < 1024 * 1024) return `${(safeBytes / 1024).toFixed(1)} KB`;
    return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUploadDate = (value?: string) => {
    if (!value) return 'дата не указана';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'дата не указана' : date.toLocaleDateString('ru-RU');
  };

  const categoryForFile = (file: globalThis.File): ProjectFile['category'] => {
    const name = file.name.toLowerCase();
    if (name.includes('contract') || name.includes('dogovor') || name.includes('договор')) return 'contract';
    if (name.includes('scan') || name.includes('скан')) return 'scan';
    return 'document';
  };

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (selectedFiles.length === 0) return;

    if (!projectId) {
      toast({
        title: "Ошибка",
        description: "Проект не найден для загрузки файлов",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const uploaded: ProjectFile[] = [];
    const failed: string[] = [];

    for (const file of selectedFiles) {
      try {
        const result = await supabaseDataStore.uploadProjectFile(
          projectId,
          file,
          categoryForFile(file) || 'document',
          uploadedBy || 'system'
        );
        if (result.file) uploaded.push(result.file as ProjectFile);
      } catch (error) {
        console.error('Error uploading project file:', error);
        failed.push(file.name);
      }
    }

    if (uploaded.length > 0) {
      const nextFiles = dedupeProjectFiles([...files, ...uploaded]) as ProjectFile[];
      try {
        await supabaseDataStore.updateProject(projectId, { files: nextFiles });
      } catch (metadataError) {
        console.warn('Could not persist project file list after upload:', metadataError);
      }
      setFiles(nextFiles);
      onFilesChange?.(nextFiles);
    }

    setIsUploading(false);

    if (failed.length > 0) {
      toast({
        title: "Файлы загружены частично",
        description: `Не удалось загрузить: ${failed.slice(0, 3).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Файлы загружены",
      description: `Добавлено: ${uploaded.length}`,
    });
  };

  const uploadInputId = `project-file-upload-${projectId || 'unknown'}`;

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <File className="w-5 h-5" />
            Файлы проекта
          </h3>
          {canUpload && (
            <div>
              <input
                id={uploadInputId}
                type="file"
                multiple
                className="hidden"
                onChange={handleUploadFiles}
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(uploadInputId)?.click()}
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Загрузка...' : 'Добавить файлы'}
              </Button>
            </div>
          )}
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
                      {formatFileSize(file.fileSize)} • {file.category || 'other'} • {formatUploadDate(file.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canPreviewFile(file) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenFile(file)}
                      disabled={activeFileAction === fileActionKey(file, 'open')}
                      aria-label={`Открыть файл: ${file.fileName}`}
                      title="Открыть документ"
                    >
                      {activeFileAction === fileActionKey(file, 'open')
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadFile(file)}
                    disabled={activeFileAction === fileActionKey(file, 'download')}
                    aria-label={`Скачать файл: ${file.fileName}`}
                    title="Скачать файл"
                  >
                    {activeFileAction === fileActionKey(file, 'download')
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </Button>
                  {canDelete(file) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file)}
                      className="text-destructive hover:text-destructive"
                      aria-label={`Удалить файл: ${file.fileName}`}
                      title="Удалить файл"
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


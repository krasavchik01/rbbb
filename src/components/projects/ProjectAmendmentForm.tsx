/**
 * Компонент для добавления доп соглашений к проекту
 * Только для отдела закупок
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";

interface ProjectAmendmentFormProps {
  projectId: string;
  createdBy: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProjectAmendmentForm({ 
  projectId, 
  createdBy,
  onSuccess,
  onCancel 
}: ProjectAmendmentFormProps) {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!number.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите номер доп соглашения",
        variant: "destructive",
      });
      return;
    }

    if (!date) {
      toast({
        title: "Ошибка",
        description: "Укажите дату доп соглашения",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите описание изменений",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl: string | undefined;

      // Если есть файл - загружаем его
      if (file) {
        const fileResult = await supabaseDataStore.uploadProjectFile(
          projectId,
          file,
          'document',
          createdBy
        );
        fileUrl = fileResult.publicUrl;
      }

      // Создаем доп соглашение
      await supabaseDataStore.createProjectAmendment(
        projectId,
        {
          number,
          date,
          description,
          fileUrl,
        },
        createdBy
      );

      toast({
        title: "✅ Успех",
        description: "Доп соглашение добавлено",
      });

      // Сбрасываем форму
      setNumber("");
      setDate("");
      setDescription("");
      setFile(null);
      
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "❌ Ошибка",
        description: error?.message || "Не удалось добавить доп соглашение",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <h3 className="font-semibold">Добавить доп соглашение</h3>
        </div>

        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Доп соглашения могут добавлять только сотрудники отдела закупок
          </AlertDescription>
        </Alert>

        <div>
          <Label htmlFor="amendment-number">Номер доп соглашения *</Label>
          <Input
            id="amendment-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Например: ДС-001"
          />
        </div>

        <div>
          <Label htmlFor="amendment-date">Дата доп соглашения *</Label>
          <Input
            id="amendment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="amendment-description">Описание изменений *</Label>
          <Textarea
            id="amendment-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите, какие изменения вносятся доп соглашением"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="amendment-file">Файл доп соглашения (необязательно)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="amendment-file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            {file && (
              <span className="text-sm text-muted-foreground truncate">
                {file.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? "Сохранение..." : "Добавить доп соглашение"}
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


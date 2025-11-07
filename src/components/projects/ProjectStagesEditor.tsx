/**
 * Компонент для редактирования этапов проекта
 * Динамическое добавление/удаление этапов с датами
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Calendar } from "lucide-react";
import { ProjectStage } from "@/types/project-v3";

interface ProjectStagesEditorProps {
  stages: ProjectStage[];
  onChange: (stages: ProjectStage[]) => void;
}

export function ProjectStagesEditor({ stages, onChange }: ProjectStagesEditorProps) {
  const addStage = () => {
    const newStage: ProjectStage = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: "",
      startDate: "",
      endDate: "",
      description: "",
    };
    onChange([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    onChange(stages.filter(s => s.id !== id));
  };

  const updateStage = (id: string, field: keyof ProjectStage, value: string) => {
    onChange(stages.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Этапы проекта
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStage}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить этап
          </Button>
        </div>

        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Этапы не добавлены. Нажмите "Добавить этап" чтобы начать.
          </p>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="p-4 border rounded-lg space-y-3 bg-secondary/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Этап {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStage(stage.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <Label htmlFor={`stage-name-${stage.id}`}>Название этапа</Label>
                  <Input
                    id={`stage-name-${stage.id}`}
                    value={stage.name}
                    onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                    placeholder="Например: Аудит за 6 месяцев"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`stage-start-${stage.id}`}>Дата начала</Label>
                    <Input
                      id={`stage-start-${stage.id}`}
                      type="date"
                      value={stage.startDate}
                      onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`stage-end-${stage.id}`}>Дата окончания</Label>
                    <Input
                      id={`stage-end-${stage.id}`}
                      type="date"
                      value={stage.endDate}
                      onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`stage-desc-${stage.id}`}>Описание (необязательно)</Label>
                  <Textarea
                    id={`stage-desc-${stage.id}`}
                    value={stage.description || ""}
                    onChange={(e) => updateStage(stage.id, 'description', e.target.value)}
                    placeholder="Дополнительная информация об этапе"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}


/**
 * Компонент для выбора дополнительных услуг
 * Можно выбрать из списка или добавить кастомную услугу
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { AdditionalService } from "@/types/project-v3";

interface AdditionalServicesSelectorProps {
  services: AdditionalService[];
  onChange: (services: AdditionalService[]) => void;
}

// Предустановленные услуги
const PRESET_SERVICES = [
  { name: "Обучение", description: "Проведение обучения для сотрудников клиента" },
  { name: "Семинар", description: "Организация семинара по аудиту" },
  { name: "Консультация", description: "Консультационные услуги" },
  { name: "Методология", description: "Разработка методологии" },
  { name: "Аналитика", description: "Аналитические услуги" },
];

export function AdditionalServicesSelector({ services, onChange }: AdditionalServicesSelectorProps) {
  const addPresetService = (presetName: string) => {
    const preset = PRESET_SERVICES.find(s => s.name === presetName);
    if (!preset) return;

    const newService: AdditionalService = {
      id: `service_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: preset.name,
      description: preset.description,
      cost: undefined,
    };
    onChange([...services, newService]);
  };

  const addCustomService = () => {
    const newService: AdditionalService = {
      id: `service_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: "",
      description: "",
      cost: undefined,
    };
    onChange([...services, newService]);
  };

  const removeService = (id: string) => {
    onChange(services.filter(s => s.id !== id));
  };

  const updateService = (id: string, field: keyof AdditionalService, value: string | number | undefined) => {
    onChange(services.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const availablePresets = PRESET_SERVICES.filter(
    preset => !services.some(s => s.name === preset.name)
  );

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Дополнительные услуги
          </h3>
          <div className="flex items-center gap-2">
            {availablePresets.length > 0 && (
              <Select onValueChange={addPresetService}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Выбрать из списка" />
                </SelectTrigger>
                <SelectContent>
                  {availablePresets.map(preset => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomService}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить услугу
            </Button>
          </div>
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Дополнительные услуги не добавлены
          </p>
        ) : (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="p-4 border rounded-lg space-y-3 bg-secondary/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Услуга {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeService(service.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <Label htmlFor={`service-name-${service.id}`}>Название услуги</Label>
                  <Input
                    id={`service-name-${service.id}`}
                    value={service.name}
                    onChange={(e) => updateService(service.id, 'name', e.target.value)}
                    placeholder="Например: Обучение"
                  />
                </div>

                <div>
                  <Label htmlFor={`service-desc-${service.id}`}>Описание (необязательно)</Label>
                  <Textarea
                    id={`service-desc-${service.id}`}
                    value={service.description || ""}
                    onChange={(e) => updateService(service.id, 'description', e.target.value)}
                    placeholder="Описание услуги"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor={`service-cost-${service.id}`}>Стоимость (необязательно)</Label>
                  <Input
                    id={`service-cost-${service.id}`}
                    type="number"
                    value={service.cost || ""}
                    onChange={(e) => updateService(service.id, 'cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0"
                    min="0"
                    step="0.01"
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


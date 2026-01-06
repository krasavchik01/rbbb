import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Trash2, Calculator } from "lucide-react";
import { ProjectStage, ProjectCurrency, CURRENCY_SYMBOLS } from "@/types/project-v3";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ContractStagesEditorProps {
  projectId: string;
  projectName: string;
  totalAmount: number;
  currency: ProjectCurrency;
  contractStartDate: string;
  contractEndDate: string;
  currentStages?: ProjectStage[];
  onSave: (stages: ProjectStage[]) => Promise<void>;
}

const VAT_RATE = 0.16; // НДС 16%

export function ContractStagesEditor({
  projectId,
  projectName,
  totalAmount,
  currency,
  contractStartDate,
  contractEndDate,
  currentStages = [],
  onSave,
}: ContractStagesEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stages, setStages] = useState<ProjectStage[]>(currentStages);
  const [isSaving, setIsSaving] = useState(false);

  // Автоматическое разбиение по годам
  const generateYearlyStages = () => {
    const start = new Date(contractStartDate);
    const end = new Date(contractEndDate);

    const years: number[] = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      years.push(year);
    }

    if (years.length === 0) return;

    const amountPerYear = totalAmount / years.length;
    const newStages: ProjectStage[] = years.map((year, index) => {
      const stageStart = index === 0 ? contractStartDate : `${year}-01-01`;
      const stageEnd = index === years.length - 1 ? contractEndDate : `${year}-12-31`;

      const amountWithoutVAT = Math.round(amountPerYear * 100) / 100;
      const vatAmount = Math.round(amountWithoutVAT * VAT_RATE * 100) / 100;
      const amountWithVAT = Math.round((amountWithoutVAT + vatAmount) * 100) / 100;

      return {
        id: `stage-${year}-${Date.now()}-${index}`,
        name: `${year} год`,
        startDate: stageStart,
        endDate: stageEnd,
        year: year,
        amountWithoutVAT,
        vatAmount,
        amountWithVAT,
      };
    });

    setStages(newStages);
  };

  // Добавить этап вручную
  const addStage = () => {
    const amountWithoutVAT = 0;
    const vatAmount = 0;
    const amountWithVAT = 0;

    setStages([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        name: `Этап ${stages.length + 1}`,
        startDate: contractStartDate,
        endDate: contractEndDate,
        amountWithoutVAT,
        vatAmount,
        amountWithVAT,
      },
    ]);
  };

  // Удалить этап
  const removeStage = (id: string) => {
    setStages(stages.filter((s) => s.id !== id));
  };

  // Обновить этап
  const updateStage = (id: string, field: keyof ProjectStage, value: any) => {
    setStages(
      stages.map((stage) => {
        if (stage.id !== id) return stage;

        const updated = { ...stage, [field]: value };

        // Пересчитываем финансы при изменении суммы без НДС
        if (field === 'amountWithoutVAT') {
          const amount = parseFloat(value) || 0;
          updated.amountWithoutVAT = amount;
          updated.vatAmount = Math.round(amount * VAT_RATE * 100) / 100;
          updated.amountWithVAT = Math.round((amount + updated.vatAmount) * 100) / 100;
        }

        return updated;
      })
    );
  };

  // Рассчёт итогов
  const totals = useMemo(() => {
    const totalWithoutVAT = stages.reduce((sum, s) => sum + (s.amountWithoutVAT || 0), 0);
    const totalVAT = stages.reduce((sum, s) => sum + (s.vatAmount || 0), 0);
    const totalWithVAT = stages.reduce((sum, s) => sum + (s.amountWithVAT || 0), 0);
    const difference = totalAmount - totalWithoutVAT;

    return { totalWithoutVAT, totalVAT, totalWithVAT, difference };
  }, [stages, totalAmount]);

  const handleSave = async () => {
    if (totals.difference !== 0) {
      const confirmed = confirm(
        `Сумма этапов (${totals.totalWithoutVAT.toLocaleString()}) не совпадает с суммой договора (${totalAmount.toLocaleString()}).\n\nРазница: ${totals.difference.toLocaleString()} ${CURRENCY_SYMBOLS[currency]}\n\nВы уверены, что хотите сохранить?`
      );
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      await onSave(stages);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving stages:', error);
      alert('Ошибка сохранения этапов');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Calendar className="w-3 h-3 mr-1" />
          {stages.length > 0 ? `${stages.length} этапов` : 'Этапы договора'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Этапы договора
          </DialogTitle>
          <DialogDescription>
            {projectName}
            <br />
            Договор: {new Date(contractStartDate).toLocaleDateString('ru-RU')} - {new Date(contractEndDate).toLocaleDateString('ru-RU')}
            <br />
            Общая сумма: <span className="font-semibold">{totalAmount.toLocaleString()} {CURRENCY_SYMBOLS[currency]}</span> (без НДС)
          </DialogDescription>
        </DialogHeader>

        {/* Быстрые действия */}
        <div className="flex gap-2">
          <Button onClick={generateYearlyStages} variant="outline" size="sm">
            <Calculator className="w-4 h-4 mr-2" />
            Разбить по годам
          </Button>
          <Button onClick={addStage} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Добавить этап
          </Button>
        </div>

        {/* Список этапов */}
        <div className="space-y-3">
          {stages.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              Нет этапов. Нажмите "Разбить по годам" или "Добавить этап"
            </Card>
          ) : (
            stages.map((stage, index) => (
              <Card key={stage.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Этап {index + 1}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStage(stage.id)}
                      className="h-7 text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={stage.name}
                        onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                        placeholder="Название этапа"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Начало</Label>
                      <Input
                        type="date"
                        value={stage.startDate}
                        onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Окончание</Label>
                      <Input
                        type="date"
                        value={stage.endDate}
                        onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Сумма без НДС</Label>
                      <Input
                        type="number"
                        value={stage.amountWithoutVAT}
                        onChange={(e) => updateStage(stage.id, 'amountWithoutVAT', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>НДС 16%</Label>
                      <Input
                        type="number"
                        value={stage.vatAmount}
                        disabled
                        className="font-mono bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Сумма с НДС</Label>
                      <Input
                        type="number"
                        value={stage.amountWithVAT}
                        disabled
                        className="font-mono bg-muted font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Итоги */}
        {stages.length > 0 && (
          <Card className="p-4 bg-primary/5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Итого без НДС:</span>
                <span className="font-mono font-semibold">
                  {totals.totalWithoutVAT.toLocaleString()} {CURRENCY_SYMBOLS[currency]}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Итого НДС 16%:</span>
                <span className="font-mono">
                  {totals.totalVAT.toLocaleString()} {CURRENCY_SYMBOLS[currency]}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Итого с НДС:</span>
                <span className="font-mono">
                  {totals.totalWithVAT.toLocaleString()} {CURRENCY_SYMBOLS[currency]}
                </span>
              </div>
              {totals.difference !== 0 && (
                <div className="flex justify-between text-destructive pt-2 border-t">
                  <span>Разница с договором:</span>
                  <span className="font-mono font-semibold">
                    {totals.difference > 0 ? '+' : ''}{totals.difference.toLocaleString()} {CURRENCY_SYMBOLS[currency]}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

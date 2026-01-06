import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DollarSign, Edit } from "lucide-react";
import { ProjectCurrency, CURRENCY_SYMBOLS } from "@/types/project-v3";

interface QuickPriceEditorProps {
  projectId: string;
  projectName: string;
  currentAmount?: number;
  currentCurrency?: ProjectCurrency;
  onSave: (amount: number, currency: ProjectCurrency) => Promise<void>;
}

export function QuickPriceEditor({
  projectId,
  projectName,
  currentAmount,
  currentCurrency = 'KZT',
  onSave,
}: QuickPriceEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(currentAmount?.toString() || '');
  const [currency, setCurrency] = useState<ProjectCurrency>(currentCurrency);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Введите корректную сумму');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(numAmount, currency);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving price:', error);
      alert('Ошибка сохранения цены');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={currentAmount ? "ghost" : "outline"}
          size="sm"
          className="h-8"
        >
          <Edit className="w-3 h-3 mr-1" />
          {currentAmount ? (
            <span className="font-mono">
              {currentAmount.toLocaleString()} {CURRENCY_SYMBOLS[currentCurrency]}
            </span>
          ) : (
            <span className="text-muted-foreground">Добавить цену</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Цена проекта
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {projectName}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Сумма без НДС</Label>
            <Input
              id="amount"
              type="number"
              placeholder="1000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Валюта</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as ProjectCurrency)}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KZT">₸ Тенге (KZT)</SelectItem>
                <SelectItem value="USD">$ Доллар (USD)</SelectItem>
                <SelectItem value="EUR">€ Евро (EUR)</SelectItem>
                <SelectItem value="RUB">₽ Рубль (RUB)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
          >
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

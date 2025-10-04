import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Plane } from 'lucide-react';

interface VacationCalculatorProps {
  employeeId: string;
  hireDate: string;
}

export function VacationCalculator({ employeeId, hireDate }: VacationCalculatorProps) {
  const [vacationType, setVacationType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState(0);

  const calculateVacationDays = () => {
    const hire = new Date(hireDate);
    const today = new Date();
    const monthsWorked = (today.getFullYear() - hire.getFullYear()) * 12 + 
                        (today.getMonth() - hire.getMonth());
    
    // Базовый отпуск 24 дня в год
    const baseVacationDays = 24;
    const earnedDays = Math.floor((monthsWorked / 12) * baseVacationDays);
    
    return {
      earned: earnedDays,
      used: 5, // mock used days
      remaining: earnedDays - 5
    };
  };

  const vacationInfo = calculateVacationDays();

  const calculateDaysBetweenDates = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const handleDateChange = () => {
    if (startDate && endDate) {
      const calculatedDays = calculateDaysBetweenDates(startDate, endDate);
      setDays(calculatedDays);
    }
  };

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center">
          <Plane className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Калькулятор отпусков</h3>
          <p className="text-sm text-muted-foreground">Расчет дней отпуска</p>
        </div>
      </div>

      {/* Vacation Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 rounded-lg bg-secondary/20">
          <div className="text-2xl font-bold text-success">{vacationInfo.earned}</div>
          <div className="text-xs text-muted-foreground">Заработано</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/20">
          <div className="text-2xl font-bold text-warning">{vacationInfo.used}</div>
          <div className="text-xs text-muted-foreground">Использовано</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/20">
          <div className="text-2xl font-bold text-primary">{vacationInfo.remaining}</div>
          <div className="text-xs text-muted-foreground">Осталось</div>
        </div>
      </div>

      {/* Vacation Request Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Тип отпуска</Label>
          <Select value={vacationType} onValueChange={setVacationType}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите тип отпуска" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Ежегодный оплачиваемый</SelectItem>
              <SelectItem value="sick">Больничный</SelectItem>
              <SelectItem value="personal">Личный день</SelectItem>
              <SelectItem value="unpaid">Без сохранения зарплаты</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Дата начала</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setTimeout(handleDateChange, 100);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Дата окончания</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setTimeout(handleDateChange, 100);
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Количество дней</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 0)}
              min="1"
            />
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <Button className="w-full btn-gradient" disabled={!vacationType || !startDate || !endDate}>
          <Calendar className="w-4 h-4 mr-2" />
          Подать заявку на отпуск
        </Button>
      </div>
    </Card>
  );
}
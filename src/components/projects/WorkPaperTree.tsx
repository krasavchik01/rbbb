/**
 * Компонент дерева рабочих документов проекта
 * Отображает структуру документов по разделам методологии
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  CheckCircle2, 
  Circle,
  Clock,
  AlertCircle,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { WorkPaper, WorkPaperStatus } from '@/types/workPapers';

interface WorkPaperTreeProps {
  workPapers: WorkPaper[];
  selectedWorkPaperId?: string;
  onSelectWorkPaper: (workPaper: WorkPaper) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

interface GroupedWorkPaper {
  sectionCode: string;
  sectionName: string;
  workPapers: WorkPaper[];
  completed: number;
  total: number;
}

const STATUS_ICONS: Record<WorkPaperStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  awaiting_review: <AlertCircle className="w-4 h-4 text-amber-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  rejected: <AlertCircle className="w-4 h-4 text-red-500" />
};

const STATUS_LABELS: Record<WorkPaperStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  awaiting_review: 'На проверке',
  completed: 'Завершен',
  rejected: 'Отклонен'
};

export function WorkPaperTree({
  workPapers,
  selectedWorkPaperId,
  onSelectWorkPaper,
  searchQuery = '',
  onSearchChange
}: WorkPaperTreeProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Группируем документы по разделам
  const groupedWorkPapers = useMemo(() => {
    const groups: Record<string, GroupedWorkPaper> = {};

    workPapers.forEach(wp => {
      // Извлекаем код раздела из кода документа (например, 'J-1' -> 'J')
      const sectionCode = wp.code.split('-')[0] || wp.code.split('_')[0] || 'OTHER';
      const sectionName = wp.template?.section?.name || `Раздел ${sectionCode}`;

      if (!groups[sectionCode]) {
        groups[sectionCode] = {
          sectionCode,
          sectionName,
          workPapers: [],
          completed: 0,
          total: 0
        };
      }

      groups[sectionCode].workPapers.push(wp);
      groups[sectionCode].total++;
      if (wp.status === 'completed') {
        groups[sectionCode].completed++;
      }
    });

    // Сортируем документы внутри каждого раздела
    Object.values(groups).forEach(group => {
      group.workPapers.sort((a, b) => {
        // Сортируем по коду документа
        const aCode = a.code.match(/\d+/)?.[0] || '0';
        const bCode = b.code.match(/\d+/)?.[0] || '0';
        return parseInt(aCode) - parseInt(bCode);
      });
    });

    return Object.values(groups).sort((a, b) => a.sectionCode.localeCompare(b.sectionCode));
  }, [workPapers]);

  // Фильтрация по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedWorkPapers;

    const query = searchQuery.toLowerCase();
    return groupedWorkPapers
      .map(group => ({
        ...group,
        workPapers: group.workPapers.filter(wp =>
          wp.name.toLowerCase().includes(query) ||
          wp.code.toLowerCase().includes(query) ||
          wp.template?.purpose?.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.workPapers.length > 0);
  }, [groupedWorkPapers, searchQuery]);

  // Автоматически раскрываем разделы с выбранным документом
  useMemo(() => {
    if (selectedWorkPaperId) {
      const selectedWP = workPapers.find(wp => wp.id === selectedWorkPaperId);
      if (selectedWP) {
        const sectionCode = selectedWP.code.split('-')[0] || selectedWP.code.split('_')[0] || 'OTHER';
        setExpandedSections(prev => new Set([...prev, sectionCode]));
      }
    }
  }, [selectedWorkPaperId, workPapers]);

  const toggleSection = (sectionCode: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionCode)) {
        next.delete(sectionCode);
      } else {
        next.add(sectionCode);
      }
      return next;
    });
  };

  // Общая статистика
  const totalCompleted = workPapers.filter(wp => wp.status === 'completed').length;
  const totalWorkPapers = workPapers.length;
  const overallProgress = totalWorkPapers > 0 ? (totalCompleted / totalWorkPapers) * 100 : 0;

  return (
    <Card className="p-4 h-full flex flex-col">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Рабочие документы
          </h3>
          <Badge variant="outline">
            {totalCompleted}/{totalWorkPapers}
          </Badge>
        </div>
        
        {totalWorkPapers > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Общий прогресс</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}

        {onSearchChange && (
          <div className="mt-3 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск документов..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'Документы не найдены' : 'Нет рабочих документов'}
            </p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedSections.has(group.sectionCode);
            const sectionProgress = group.total > 0 ? (group.completed / group.total) * 100 : 0;

            return (
              <div key={group.sectionCode} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(group.sectionCode)}
                  className="w-full p-3 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {group.sectionCode}
                        </Badge>
                        <span className="font-medium text-sm">{group.sectionName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={sectionProgress} className="h-1 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {group.completed}/{group.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-muted/30">
                    {group.workPapers.map(wp => {
                      const isSelected = wp.id === selectedWorkPaperId;
                      
                      return (
                        <button
                          key={wp.id}
                          onClick={() => onSelectWorkPaper(wp)}
                          className={`w-full p-3 text-left hover:bg-secondary/50 transition-colors border-b last:border-b-0 ${
                            isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {STATUS_ICONS[wp.status]}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{wp.name}</span>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {wp.code}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {STATUS_LABELS[wp.status]}
                                </span>
                                {wp.assigned_user && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {wp.assigned_user.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}


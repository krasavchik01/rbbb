import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { ChecklistItem } from "@/types/project";
import { useAuth } from "@/hooks/useAuth";

interface TaskChecklistProps {
  checklist: ChecklistItem[];
  onUpdate: (checklist: ChecklistItem[]) => void;
  taskId: string;
  disabled?: boolean;
}

export function TaskChecklist({ 
  checklist, 
  onUpdate, 
  taskId, 
  disabled = false 
}: TaskChecklistProps) {
  const { hasRole } = useAuth();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [newItemText, setNewItemText] = useState("");

  const canEdit = (hasRole('partner') || hasRole('admin')) && !disabled;

  const handleToggleItem = (index: number) => {
    if (!canEdit) return;
    
    const updatedChecklist = [...checklist];
    updatedChecklist[index] = {
      ...updatedChecklist[index],
      done: !updatedChecklist[index].done
    };
    onUpdate(updatedChecklist);
  };

  const handleAddItem = () => {
    if (!newItemText.trim() || !canEdit) return;
    
    const newItem: ChecklistItem = {
      item: newItemText.trim(),
      required: false,
      done: false
    };
    
    onUpdate([...checklist, newItem]);
    setNewItemText("");
  };

  const handleDeleteItem = (index: number) => {
    if (!canEdit) return;
    
    const updatedChecklist = checklist.filter((_, i) => i !== index);
    onUpdate(updatedChecklist);
  };

  const handleStartEdit = (index: number) => {
    if (!canEdit) return;
    
    setEditingIndex(index);
    setEditText(checklist[index].item);
  };

  const handleSaveEdit = () => {
    if (!canEdit || editingIndex === null) return;
    
    const updatedChecklist = [...checklist];
    updatedChecklist[editingIndex] = {
      ...updatedChecklist[editingIndex],
      item: editText.trim()
    };
    
    onUpdate(updatedChecklist);
    setEditingIndex(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const handleToggleRequired = (index: number) => {
    if (!canEdit) return;
    
    const updatedChecklist = [...checklist];
    updatedChecklist[index] = {
      ...updatedChecklist[index],
      required: !updatedChecklist[index].required
    };
    onUpdate(updatedChecklist);
  };

  const completedCount = checklist.filter(item => item.done).length;
  const totalCount = checklist.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Прогресс чек-листа</span>
            <span className="font-medium">{completedCount}/{totalCount} ({progressPercentage}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklist.map((item, index) => (
          <div 
            key={index}
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${
              item.done 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-background border-border'
            }`}
          >
            <Checkbox
              checked={item.done}
              onCheckedChange={() => handleToggleItem(index)}
              disabled={!canEdit}
              className="mt-1"
            />
            
            <div className="flex-1 min-w-0">
              {editingIndex === index ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveEdit}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span 
                    className={`flex-1 ${
                      item.done 
                        ? 'line-through text-muted-foreground' 
                        : 'text-foreground'
                    }`}
                  >
                    {item.item}
                  </span>
                  {item.required && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded">
                      Обязательно
                    </span>
                  )}
                </div>
              )}
            </div>

            {canEdit && editingIndex !== index && (
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartEdit(index)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleRequired(index)}
                  className={`h-8 w-8 p-0 ${
                    item.required 
                      ? 'text-red-600 hover:text-red-700' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-xs font-bold">!</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteItem(index)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Item */}
      {canEdit && (
        <div className="flex items-center space-x-2 p-3 border-2 border-dashed border-border rounded-lg">
          <Input
            placeholder="Добавить пункт чек-листа..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem();
            }}
            className="flex-1"
          />
          <Button
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            size="sm"
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
      )}

      {!canEdit && totalCount === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p>Чек-лист пуст</p>
          <p className="text-sm">Только партнёры могут добавлять пункты</p>
        </div>
      )}
    </div>
  );
}

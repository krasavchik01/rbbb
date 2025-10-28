import React from 'react';
import { Card } from '@/components/ui/card';

export default function Tasks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">✅ Задачи</h1>
        <p className="text-muted-foreground">Управление задачами и проектами</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Задачи в разработке</h2>
        <p className="text-muted-foreground">
          Здесь будет система управления задачами.
        </p>
      </Card>
    </div>
  );
}
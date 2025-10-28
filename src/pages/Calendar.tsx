import React from 'react';
import { Card } from '@/components/ui/card';

export default function Calendar() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📅 Календарь</h1>
        <p className="text-muted-foreground">Календарь событий и задач</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Календарь в разработке</h2>
        <p className="text-muted-foreground">
          Здесь будет календарь с событиями и задачами.
        </p>
      </Card>
    </div>
  );
}
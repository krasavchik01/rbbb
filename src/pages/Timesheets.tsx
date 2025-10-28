import React from 'react';
import { Card } from '@/components/ui/card';

export default function Timesheets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">⏰ Тайм-щиты</h1>
        <p className="text-muted-foreground">Учет рабочего времени</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Тайм-щиты в разработке</h2>
        <p className="text-muted-foreground">
          Здесь будет система учета рабочего времени.
        </p>
      </Card>
    </div>
  );
}
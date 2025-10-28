import React from 'react';
import { Card } from '@/components/ui/card';

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📊 Аналитика</h1>
        <p className="text-muted-foreground">Детальная аналитика по проектам и сотрудникам</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Аналитика в разработке</h2>
        <p className="text-muted-foreground">
          Здесь будет детальная аналитика с графиками и отчетами.
        </p>
      </Card>
    </div>
  );
}
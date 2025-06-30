
'use client';

import * as React from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { LucideProps } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ParameterDialProps {
  name: string;
  value: number;
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  color: string;
  isLoading: boolean;
}

export function ParameterDial({ name, value, icon: Icon, color, isLoading }: ParameterDialProps) {
  const chartData = [{ name, value, fill: color }];

  if (isLoading) {
    return (
      <Card className="bg-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-headline text-sm font-medium">{name}</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-headline text-sm font-medium">{name}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" style={{ color }} />
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-2 pt-0">
        <div className="h-24 w-24 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
              barSize={10}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: '#1e293b' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>
              {value.toFixed(1)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

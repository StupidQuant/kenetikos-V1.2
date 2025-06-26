'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketRegimesProps {
  scores?: Record<string, number>;
  isLoading: boolean;
}

const regimeColors: Record<string, string> = {
  'Fragile topping/reversal risk': 'hsl(var(--destructive))',
  'Chaotic indecision': 'hsl(30, 90%, 60%)',
  'Stable bull/bear trend': 'hsl(var(--primary))',
  'Coiling Spring (High Tension)': 'hsl(var(--accent))',
  'Low volatility/Orderly': 'hsl(200, 80%, 60%)',
};

export function MarketRegimes({ scores, isLoading }: MarketRegimesProps) {
  const sortedRegimes = scores
    ? Object.entries(scores).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <Card className="bg-glass">
      <CardHeader>
        <CardTitle>Market Regime Classification</CardTitle>
        <CardDescription>Quantifies resemblance to recognized market regimes (0-100).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRegimes.map(([regime, score]) => (
              <div key={regime}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{regime}</span>
                  <span className="text-sm font-bold" style={{ color: regimeColors[regime] }}>
                    {score.toFixed(1)}
                  </span>
                </div>
                <Progress value={score} indicatorClassName="transition-all duration-500" style={{backgroundColor: regimeColors[regime]}} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

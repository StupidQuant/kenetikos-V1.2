
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from './ui/skeleton';

// Dynamically import Plotly to ensure it's client-side only
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <Skeleton className="h-[250px] w-full" />,
});

interface RadarChartProps {
  scores?: {
    potential: number;
    momentum: number;
    entropy: number;
    temperature: number;
  };
  isLoading: boolean;
}

export function RadarChart({ scores, isLoading }: RadarChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[250px] w-full" />;
  }

  if (!scores) {
    return (
      <div className="h-[250px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">No data for Radar Chart.</p>
      </div>
    );
  }

  const radarData = [{
    type: 'scatterpolar',
    r: [
      scores.potential,
      scores.momentum,
      scores.entropy,
      scores.temperature,
      scores.potential, // Close the loop
    ],
    theta: ['Potential', 'Momentum', 'Entropy', 'Temperature', 'Potential'],
    fill: 'toself',
    fillcolor: 'hsla(var(--primary) / 0.4)',
    marker: { color: 'hsl(var(--primary))', size: 8 },
    line: { color: 'hsl(var(--primary))', width: 2 },
  }] as Plotly.Data[];

  const radarLayout: Partial<Plotly.Layout> = {
    height: 250,
    polar: {
      radialaxis: {
        visible: true,
        range: [0, 100],
        showline: false,
        showticklabels: true,
        gridcolor: 'hsl(var(--border) / 0.5)',
        tickfont: { size: 8, color: 'hsl(var(--muted-foreground))' },
      },
      angularaxis: {
        tickfont: { size: 12, color: 'hsl(var(--foreground))' },
        gridcolor: 'hsl(var(--border) / 0.5)',
        linecolor: 'hsl(var(--border))'
      },
      bgcolor: 'transparent',
    },
    paper_bgcolor: 'transparent',
    showlegend: false,
    margin: { t: 50, b: 50, l: 50, r: 50 },
    font: {
      family: 'var(--font-body)',
    }
  };

  return (
    <Plot
      data={radarData}
      layout={radarLayout}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

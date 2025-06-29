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
      scores.potential / 100,
      scores.momentum / 100,
      scores.entropy / 100,
      scores.temperature / 100,
      scores.potential / 100, // Close the loop
    ],
    theta: ['Potential', 'Momentum', 'Entropy', 'Temperature', 'Potential'],
    fill: 'toself',
    fillcolor: 'rgba(79, 70, 229, 0.4)',
    marker: { color: '#a5b4fc', size: 6 },
    line: { color: '#6366f1', width: 2 },
  }] as Plotly.Data[];

  const radarLayout: Partial<Plotly.Layout> = {
    height: 250,
    polar: {
      radialaxis: {
        visible: true,
        range: [0, 1],
        showline: false,
        showticklabels: false,
        gridcolor: '#374151',
      },
      angularaxis: {
        tickfont: { size: 12, color: '#e5e7eb' },
        gridcolor: '#374151',
        linecolor: '#475569'
      },
      bgcolor: 'rgba(0,0,0,0)',
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    margin: { t: 40, b: 40, l: 40, r: 40 },
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

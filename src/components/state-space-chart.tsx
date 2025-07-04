
'use client';

import * as React from 'react';
import Plot from 'react-plotly.js';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDescription, CardTitle } from './ui/card';
import type { StateVectorDataPoint } from '@/lib/indicator';
import { type Data } from 'plotly.js';

interface StateSpaceChartProps {
  trajectory?: StateVectorDataPoint[];
  isLoading: boolean;
}

export function StateSpaceChart({ trajectory, isLoading }: StateSpaceChartProps) {
  if (isLoading) {
    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-2">
                <CardTitle>4D State-Space Trajectory</CardTitle>
                <CardDescription>Potential (x), Momentum (y), Entropy (z), Temperature (color)</CardDescription>
            </div>
            <div className="flex-1 flex items-center justify-center">
                <Skeleton className="h-full w-full" />
            </div>
        </div>
    );
  }

  if (!trajectory || trajectory.length === 0) {
    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-2">
                <CardTitle>4D State-Space Trajectory</CardTitle>
                <CardDescription>Potential (x), Momentum (y), Entropy (z), Temperature (color)</CardDescription>
            </div>
            <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">No data to display. Adjust parameters or date range.</p>
            </div>
      </div>
    );
  }

  const potential = trajectory.map(d => d.potential);
  const momentum = trajectory.map(d => d.momentum);
  const entropy = trajectory.map(d => d.entropy);
  const temperature = trajectory.map(d => d.temperature);

  const finiteTemps = temperature.filter((t): t is number => t !== null && isFinite(t));
  const sortedTemps = [...finiteTemps].sort((a, b) => a - b);
  const percentileIndex = sortedTemps.length > 0 ? Math.min(Math.floor(sortedTemps.length * 0.99), sortedTemps.length - 1) : 0;
  const maxColorTemp = sortedTemps.length > 0 ? sortedTemps[percentileIndex] : 1;
  
  const normalizedTemp = temperature.map(t => {
      if (t === null || !isFinite(t)) return 0;
      const cappedTemp = Math.min(t, maxColorTemp);
      return maxColorTemp > 0 ? cappedTemp / maxColorTemp : 0;
  });
  
  const viridisColorscale: [number, string][] = [
    [0, '#440154'],
    [0.1, '#482878'],
    [0.2, '#3e4a89'],
    [0.3, '#31688e'],
    [0.4, '#26828e'],
    [0.5, '#1f9e89'],
    [0.6, '#35b779'],
    [0.7, '#6ece58'],
    [0.8, '#b5de2b'],
    [0.9, '#fde725'],
    [1, '#fde725']
  ];

  const trace: Partial<Data> = {
    x: potential,
    y: momentum,
    z: entropy,
    mode: 'lines+markers',
    type: 'scatter3d',
    marker: {
      size: 4,
      color: normalizedTemp,
      colorscale: viridisColorscale,
      showscale: true,
      colorbar: {
        title: { text: 'Temp (Θ)', font: { size: 16 } },
        x: 0.05,
        thickness: 15,
        len: 0.75,
        bgcolor: 'rgba(0,0,0,0)',
        tickfont: { size: 12 },
        outlinewidth: 0,
        bordercolor: '#374151'
      },
    },
    line: {
      width: 4,
      color: normalizedTemp,
      colorscale: viridisColorscale,
    },
    hoverinfo: 'text',
    text: trajectory.map((d) => 
        `<b>P: ${d.potential?.toExponential(2) ?? 'N/A'}</b><br>` +
        `<b>M: ${d.momentum?.toExponential(2) ?? 'N/A'}</b><br>` +
        `<b>E: ${d.entropy?.toFixed(3) ?? 'N/A'}</b><br>` +
        `<b>Θ: ${d.temperature?.toExponential(2) ?? 'N/A'}</b>`
    ),
  };

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    scene: {
      xaxis: { title: { text: 'Potential (P)', font: { size: 80 } }, color: '#9ca3af', gridcolor: '#374151', tickfont: { size: 14 } },
      yaxis: { title: { text: 'Momentum (M)', font: { size: 80 } }, color: '#9ca3af', gridcolor: '#374151', tickfont: { size: 14 } },
      zaxis: { title: { text: 'Entropy (E)', font: { size: 80 } }, color: '#9ca3af', gridcolor: '#374151', tickfont: { size: 14 } },
      camera: {
        eye: {x: 1.5, y: 1.5, z: 1.5}
      }
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      color: '#e5e7eb',
      family: 'var(--font-headline)',
    },
    margin: { l: 40, r: 40, b: 40, t: 40 },
  };

  return (
    <div className="h-full w-full flex flex-col">
       <div className="px-2">
            <CardTitle>4D State-Space Trajectory</CardTitle>
            <CardDescription>Potential (x), Momentum (y), Entropy (z), Temperature (color)</CardDescription>
        </div>
        <div className="flex-1 min-h-0 w-full">
            <Plot
                data={[trace as Data]}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displaylogo: false }}
            />
        </div>
    </div>
  );
}

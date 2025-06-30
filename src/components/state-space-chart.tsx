
'use client';

import * as React from 'react';
import Plot from 'react-plotly.js';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDescription, CardTitle } from './ui/card';
import type { StateVectorDataPoint } from '@/lib/indicator';

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

  const sortedTemps = [...temperature].filter(t => t !== null && isFinite(t)).sort((a, b) => a - b);
  const percentileIndex = sortedTemps.length > 0 ? Math.min(Math.floor(sortedTemps.length * 0.99), sortedTemps.length - 1) : 0;
  const maxColorTemp = sortedTemps.length > 0 ? sortedTemps[percentileIndex] : 1;
  
  const normalizedTemp = temperature.map(t => {
      if(t === null || !isFinite(t)) return 0;
      const cappedTemp = Math.min(t, maxColorTemp);
      return maxColorTemp > 0 ? cappedTemp / maxColorTemp : 0;
  });

  const trace: Partial<Plotly.PlotData> = {
    x: potential,
    y: momentum,
    z: entropy,
    mode: 'lines+markers',
    type: 'scatter3d',
    marker: {
      size: 4,
      color: normalizedTemp,
      colorscale: 'Viridis',
      showscale: true,
      colorbar: {
        title: 'Temp (Θ)',
        x: 0,
        thickness: 15,
        len: 0.75,
        bgcolor: 'rgba(0,0,0,0)',
        tickfont: { color: '#9ca3af' },
        titlefont: { color: '#9ca3af' },
        outlinewidth: 0,
        bordercolor: '#374151'
      },
    },
    line: {
      width: 4,
      color: normalizedTemp,
      colorscale: 'Viridis',
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
      xaxis: { title: 'Potential (P)', color: '#9ca3af', gridcolor: '#374151', titlefont: {size: 10} },
      yaxis: { title: 'Momentum (M)', color: '#9ca3af', gridcolor: '#374151', titlefont: {size: 10} },
      zaxis: { title: 'Entropy (E)', color: '#9ca3af', gridcolor: '#374151', titlefont: {size: 10} },
      camera: {
        eye: {x: 1.5, y: 1.5, z: 1.5}
      }
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e5e7eb', family: 'var(--font-body)' },
    margin: { l: 0, r: 0, b: 0, t: 0 },
  };

  return (
    <div className="h-full w-full flex flex-col">
       <div className="px-2">
            <CardTitle>4D State-Space Trajectory</CardTitle>
            <CardDescription>Potential (x), Momentum (y), Entropy (z), Temperature (color)</CardDescription>
        </div>
        <div className="flex-1 min-h-0 w-full">
            <Plot
                data={[trace]}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displaylogo: false }}
            />
        </div>
    </div>
  );
}


'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from './ui/skeleton';
import { CardDescription, CardTitle } from './ui/card';

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
    const getTemperatureColor = (temperature: number | undefined) => {
        if (temperature === undefined) {
            return {
                fill: 'hsla(var(--primary) / 0.4)',
                line: 'hsl(var(--primary))'
            };
        }
        const normalizedTemp = temperature / 100;

        // Interpolate HSL values from blue (cool) to yellow (hot)
        // Cool: hsl(220, 85%, 65%) -- based on --chart-1
        // Hot:  hsl(40, 90%, 60%) -- based on --chart-3
        const coolHue = 220;
        const hotHue = 40;
        const coolSat = 85;
        const hotSat = 90;
        const coolLight = 65;
        const hotLight = 60;

        const hue = coolHue - (normalizedTemp * (coolHue - hotHue));
        const sat = coolSat + (normalizedTemp * (hotSat - coolSat));
        const light = coolLight - (normalizedTemp * (hotLight - coolLight));

        return {
            fill: `hsla(${hue}, ${sat}%, ${light}%, 0.4)`,
            line: `hsl(${hue}, ${sat}%, ${light}%)`
        };
    };

    const chartContent = () => {
        if (isLoading) {
            return <Skeleton className="h-[250px] w-full" />;
        }

        if (!scores) {
            return (
                <div className="h-[250px] w-full flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Waiting for data...</p>
                </div>
            );
        }

        const temperatureColor = getTemperatureColor(scores.temperature);

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
            fillcolor: temperatureColor.fill,
            marker: { color: temperatureColor.line, size: 8 },
            line: { color: temperatureColor.line, width: 2 },
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
                    tickfont: { size: 10, color: 'hsl(var(--muted-foreground))' },
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
    };

    return (
        <div>
            <CardTitle className="text-lg font-headline">State-Space Snapshot</CardTitle>
            <CardDescription className="text-sm">Current percentile ranks</CardDescription>
            <div className="mt-2">
                {chartContent()}
            </div>
        </div>
    );
}

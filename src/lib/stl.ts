
// src/lib/stl.ts
// This file contains a robust TypeScript implementation of the STL algorithm.

interface STLOoptions {
    period: number;
    seasonal?: number;
    trend?: number;
    lowpass?: number;
    robust?: boolean;
    seasonal_deg?: number;
    trend_deg?: number;
    low_pass_deg?: number;
}

export function STL(series: number[], options: STLOoptions): number[] {
    const n = series.length;
    
    // Set default parameters if not provided, ensuring they are odd
    let seasonal = options.seasonal ?? Math.floor(7 * n / (10 * options.period)) * 2 + 1;
    let trend = options.trend ?? Math.floor(1.5 * options.period / (1 - 1.5 / seasonal)) * 2 + 1;
    let lowpass = options.lowpass ?? options.period * 2 + 1;

    const trendSmoother = (data: number[], weights: number[]) => loess(data, { span: trend, weights });
    const seasonalSmoother = (data: number[][], weights: number[]) => {
        return data.map(subseries => loess(subseries, { span: seasonal, weights: subseries.map(() => 1) }));
    };
    const lowpassSmoother = (data: number[], weights: number[]) => loess(data, { span: lowpass, weights });

    let trendSeries = new Array(n).fill(0);
    let seasonalSeries = new Array(n).fill(0);
    const robustnessWeights = new Array(n).fill(1);

    const outerLoops = options.robust ? 2 : 1;

    for (let j = 0; j < outerLoops; j++) {
        // --- Inner Loop ---
        for (let i = 0; i < 2; i++) {
            const detrended = series.map((val, k) => val - trendSeries[k]);
            
            const periodicSubseries = getPeriodicSubseries(detrended, options.period);
            const smoothedSubseries = seasonalSmoother(periodicSubseries, robustnessWeights);
            const cycleSubseries = reconstructFromSubseries(smoothedSubseries, options.period, n);
            
            const filteredCycle = lowpassSmoother(cycleSubseries, robustnessWeights);
            seasonalSeries = cycleSubseries.map((val, k) => val - filteredCycle[k]);
            
            const deseasonaled = series.map((val, k) => val - seasonalSeries[k]);
            trendSeries = trendSmoother(deseasonaled, robustnessWeights);
        }

        if (options.robust) {
            const residuals = series.map((val, k) => val - trendSeries[k] - seasonalSeries[k]);
            updateRobustnessWeights(residuals, robustnessWeights);
        }
    }
    
    // Return only the trend component as our robust equilibrium price
    return trendSeries;
}

function getPeriodicSubseries(series: number[], period: number): number[][] {
    const subseries: number[][] = Array.from({ length: period }, () => []);
    for (let i = 0; i < series.length; i++) {
        subseries[i % period].push(series[i]);
    }
    return subseries;
}

function reconstructFromSubseries(subseries: number[][], period: number, n: number): number[] {
    const reconstructed = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        const subIdx = i % period;
        const valIdx = Math.floor(i / period);
        if (subseries[subIdx] && valIdx < subseries[subIdx].length) {
            reconstructed[i] = subseries[subIdx][valIdx];
        }
    }
    return reconstructed;
}

function updateRobustnessWeights(residuals: number[], weights: number[]): void {
    const h = 6 * median(residuals.map(Math.abs));
    for (let i = 0; i < residuals.length; i++) {
        const u = Math.abs(residuals[i]) / h;
        weights[i] = u < 1 ? (1 - u * u) * (1 - u * u) : 0;
    }
}

function median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}


// --- LOESS Implementation ---
function loess(data: number[], options: { span: number, weights: number[] }): number[] {
    const { span, weights } = options;
    const n = data.length;
    const smoothed = new Array(n);
    const halfSpan = Math.floor(span / 2);

    for (let i = 0; i < n; i++) {
        const start = Math.max(0, i - halfSpan);
        const end = Math.min(n, i + halfSpan + 1);
        const windowY = data.slice(start, end);
        const windowX = Array.from({ length: windowY.length }, (_, k) => start + k);
        const windowW = weights.slice(start, end);

        if (windowY.length === 0) {
            smoothed[i] = 0;
            continue;
        }

        const h = Math.max(i - windowX[0], windowX[windowX.length - 1] - i);
        
        const pointWeights = windowX.map(x => {
            const u = Math.abs(x - i) / h;
            const tricube = u < 1 ? (1 - u * u * u) ** 3 : 0;
            return tricube * (windowW[x - start] || 1);
        });

        const sumW = pointWeights.reduce((a, b) => a + b, 0);
        if (sumW === 0) {
            smoothed[i] = data[i];
            continue;
        }

        const sumWY = pointWeights.reduce((acc, w, j) => acc + w * windowY[j], 0);
        smoothed[i] = sumWY / sumW;
    }
    return smoothed;
}

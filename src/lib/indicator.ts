
import * as math from 'mathjs';

// --- TYPE DEFINITIONS ---
export type MarketDataPoint = {
  timestamp: number;
  price: number;
  volume: number;
};

export type StateVectorDataPoint = MarketDataPoint & {
  p_eq: number | null;
  k: number | null;
  F: number | null;
  m: number | null;
  potential: number | null;
  momentum: number | null;
  entropy: number | null;
  temperature: number | null;
  smoothed_price: number | null;
  price_velocity: number | null;
  price_acceleration: number | null;
};

export type IndicatorOptions = {
    sgWindow: number;
    sgPolyOrder: number;
    regressionWindow: number;
    equilibriumWindow: number;
    entropyWindow: number;
    numBins: number;
    temperatureWindow: number;
};

// --- CORE CALCULATION FUNCTIONS ---

function savitzkyGolay(data: MarketDataPoint[], { windowSize, polynomialOrder }: { windowSize: number; polynomialOrder: number; }) {
    if (!Number.isInteger(windowSize) || windowSize % 2 === 0 || windowSize <= 0) return data.map(() => ({ smoothed_price: null, price_velocity: null, price_acceleration: null }));
    if (!Number.isInteger(polynomialOrder) || polynomialOrder < 0 || polynomialOrder >= windowSize) return data.map(() => ({ smoothed_price: null, price_velocity: null, price_acceleration: null }));

    const halfWindow = Math.floor(windowSize / 2);
    const result: { smoothed_price: number | null, price_velocity: number | null, price_acceleration: number | null }[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < halfWindow || i >= data.length - halfWindow) {
            result.push({ smoothed_price: null, price_velocity: null, price_acceleration: null });
            continue;
        }

        const window = data.slice(i - halfWindow, i + halfWindow + 1);
        const centerTimestampInSeconds = data[i].timestamp / 1000.0;
        const t = window.map(p => (p.timestamp / 1000.0) - centerTimestampInSeconds);
        const y = window.map(p => p.price);

        const A_data: number[][] = [];
        for (let j = 0; j < windowSize; j++) {
            const row: number[] = [];
            for (let p = 0; p <= polynomialOrder; p++) {
                row.push(Math.pow(t[j], p));
            }
            A_data.push(row);
        }
        const A = math.matrix(A_data);

        try {
            const c = math.lusolve(math.multiply(math.transpose(A), A), math.multiply(math.transpose(A), y)).toArray().flat();
            result.push({
                smoothed_price: c[0] ?? null,
                price_velocity: c[1] ?? null,
                price_acceleration: polynomialOrder >= 2 ? 2 * c[2] : 0
            });
        } catch (error) {
            result.push({ smoothed_price: null, price_velocity: null, price_acceleration: null });
        }
    }
    return result;
}

function calculateSMA(data: any[], startIndex: number, endIndex: number, key: string): number {
    let sum = 0;
    let count = 0;
    for (let i = startIndex; i < endIndex; i++) {
        if (data[i] && typeof data[i][key] === 'number' && isFinite(data[i][key])) {
            sum += data[i][key];
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}

function estimateMarketParameters(data: any[], { regressionWindow, equilibriumWindow }: { regressionWindow: number; equilibriumWindow: number; }) {
    const minDataLength = Math.max(regressionWindow, equilibriumWindow);
    return data.map((point, i) => {
        if (i < minDataLength - 1 || point.price_acceleration === null || !isFinite(point.price_acceleration)) {
            return { ...point, k: null, F: null, m: null, p_eq: null };
        }

        const p_eq = calculateSMA(data, i - equilibriumWindow + 1, i + 1, 'smoothed_price');
        const avg_vol = calculateSMA(data, i - regressionWindow + 1, i + 1, 'volume');
        const avg_price = calculateSMA(data, i - regressionWindow + 1, i + 1, 'smoothed_price');
        const m = avg_price > 0 ? avg_vol / avg_price : 0;

        if (m < 1e-9) {
            return { ...point, k: null, F: null, m, p_eq };
        }

        const y_data: number[][] = [];
        const x_data: number[][] = [];
        for (let j = 0; j < regressionWindow; j++) {
            const wp = data[i - j];
            if (wp && wp.price_acceleration !== null && isFinite(wp.price_acceleration) && wp.smoothed_price !== null && isFinite(wp.smoothed_price)) {
                y_data.push([m * wp.price_acceleration]);
                x_data.push([1, wp.smoothed_price - p_eq]);
            }
        }

        if (x_data.length < 2) {
            return { ...point, k: null, F: null, m, p_eq };
        }

        try {
            const X = math.matrix(x_data);
            const Y = math.matrix(y_data);
            const beta = math.lusolve(math.multiply(math.transpose(X), X), math.multiply(math.transpose(X), Y)).toArray().flat();
            return { ...point, k: -beta[1], F: beta[0], p_eq, m };
        } catch (error) {
            return { ...point, k: null, F: null, m, p_eq };
        }
    });
}

function calculateRollingLagrangianEntropy(series: (number | null)[], { entropyWindow, numBins }: { entropyWindow: number, numBins: number }) {
    if (!series || series.length < entropyWindow) {
        return new Array(series.length).fill(null);
    }
    const log = Math.log2;
    let globalMin = Infinity;
    let globalMax = -Infinity;
    series.forEach(value => {
        if (value !== null && isFinite(value)) {
            globalMin = Math.min(globalMin, value);
            globalMax = Math.max(globalMax, value);
        }
    });

    if (!isFinite(globalMin) || !isFinite(globalMax) || globalMin === globalMax) {
        return series.map(v => (v !== null && isFinite(v) ? 0 : null));
    }

    const binWidth = (globalMax - globalMin) / numBins;
    if (binWidth <= 1e-9) {
        return series.map(v => v !== null && isFinite(v) ? 0 : null);
    }

    const discretizeValue = (v: number | null) => {
        if (v === null || !isFinite(v)) return null;
        const clampedValue = Math.max(globalMin, Math.min(v, globalMax));
        if (clampedValue === globalMax) return numBins - 1;
        return Math.floor((clampedValue - globalMin) / binWidth);
    };

    const calculateEntropyFromCounts = (counts: Map<number, number>, size: number) => {
        if (size === 0) return null;
        let e = 0;
        for (const count of counts.values()) {
            if (count > 0) {
                const p = count / size;
                e -= p * log(p);
            }
        }
        return e;
    };

    const results: (number | null)[] = new Array(series.length).fill(null);
    const counts = new Map<number, number>();
    for (let i = 0; i < numBins; i++) {
        counts.set(i, 0);
    }

    let validPointsInWindow = 0;
    
    // Initialize first window
    for (let i = 0; i < entropyWindow; i++) {
        const bin = discretizeValue(series[i]);
        if (bin !== null) {
            counts.set(bin, (counts.get(bin) || 0) + 1);
            validPointsInWindow++;
        }
    }
    
    if (validPointsInWindow > 0) {
        results[entropyWindow - 1] = calculateEntropyFromCounts(counts, validPointsInWindow);
    }

    // Slide window across the rest of the series
    for (let i = entropyWindow; i < series.length; i++) {
        // Remove old point
        const oldBin = discretizeValue(series[i - entropyWindow]);
        if (oldBin !== null) {
            const currentCount = counts.get(oldBin);
            if (currentCount && currentCount > 0) {
                counts.set(oldBin, currentCount - 1);
                validPointsInWindow--;
            }
        }

        // Add new point
        const newBin = discretizeValue(series[i]);
        if (newBin !== null) {
            counts.set(newBin, (counts.get(newBin) || 0) + 1);
            validPointsInWindow++;
        }

        if (validPointsInWindow > 0) {
            results[i] = calculateEntropyFromCounts(counts, validPointsInWindow);
        } else {
            results[i] = null;
        }
    }

    return results;
}


function calculateTemperature(data: any[], { temperatureWindow }: { temperatureWindow: number; }) {
    const results = data.map(d => ({ ...d, temperature: null }));
    const epsilon = 1e-10;

    for (let i = temperatureWindow; i < data.length; i++) {
        const deltas = [];
        for (let j = 0; j < temperatureWindow; j++) {
            const currIdx = i - j;
            const prevIdx = i - j - 1;
            if (currIdx < 0 || prevIdx < 0) continue;

            const curr = data[currIdx];
            const prev = data[prevIdx];
            
            if (curr && prev && curr.entropy !== null && isFinite(curr.entropy) && prev.entropy !== null && isFinite(prev.entropy) && curr.volume !== null && prev.volume !== null) {
                const dE = curr.entropy - prev.entropy;
                const dV = curr.volume - prev.volume;
                if (Math.abs(dE) > epsilon || Math.abs(dV) > epsilon) {
                  deltas.push({ x: dE, y: dV }); // x: dEntropy, y: dVolume
                }
            }
        }

        if (deltas.length < 2) continue;

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        deltas.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumX2 += p.x * p.x;
        });

        const denom = deltas.length * sumX2 - sumX * sumX;
        
        if (Math.abs(denom) > epsilon) {
            // Per documentation, Temperature is proportional to d(Volume)/d(Entropy).
            // This is the slope (beta) of the regression of dV on dE.
            const slope = (deltas.length * sumXY - sumX * sumY) / denom;
            results[i].temperature = slope;
        } else {
            // If ΔE has no variance, there is no relationship to measure.
            results[i].temperature = 0;
        }
    }
    return results;
}

export function calculateStateVector(data: MarketDataPoint[], options: IndicatorOptions): StateVectorDataPoint[] {
    const smoothedData = savitzkyGolay(data, {windowSize: options.sgWindow, polynomialOrder: options.sgPolyOrder});
    const dataWithDerivatives = data.map((d, i) => ({ ...d, ...smoothedData[i] }));
    
    const parameterData = estimateMarketParameters(dataWithDerivatives, {regressionWindow: options.regressionWindow, equilibriumWindow: options.equilibriumWindow});
    
    const velocitySeries = parameterData.map(d => d.price_velocity);
    const entropySeries = calculateRollingLagrangianEntropy(velocitySeries, { entropyWindow: options.entropyWindow, numBins: options.numBins });
    
    let entropyData = parameterData.map((d, i) => ({ ...d, entropy: entropySeries[i] }));
    
    let finalData = calculateTemperature(entropyData, { temperatureWindow: options.temperatureWindow });
    
    return finalData.map(d => {
        let momentum: number | null = null, potential: number | null = null;
        if (d.price_velocity !== null && isFinite(d.price_velocity) && d.m !== null && isFinite(d.m)) {
            momentum = 0.5 * d.m * Math.pow(d.price_velocity, 2);
        }
        if (d.k !== null && isFinite(d.k) && d.F !== null && isFinite(d.F) && d.smoothed_price !== null && isFinite(d.smoothed_price) && d.p_eq !== null && isFinite(d.p_eq)) {
            potential = 0.5 * d.k * Math.pow(d.smoothed_price - d.p_eq, 2) - d.F * d.smoothed_price;
        }
        return { ...d, potential, momentum };
    });
}

export class RegimeClassifier {
    private historicalData: StateVectorDataPoint[];
    private sortedValues: Record<string, number[]>;
    public regimeLogic: Record<string, ((s: StateVectorDataPoint) => boolean)[]>;

    constructor(historicalData: StateVectorDataPoint[]) {
        this.historicalData = historicalData.filter(d => 
            d.potential !== null && isFinite(d.potential) &&
            d.momentum !== null && isFinite(d.momentum) &&
            d.entropy !== null && isFinite(d.entropy) &&
            d.temperature !== null && isFinite(d.temperature)
        );
        this.sortedValues = {};
        this._calculatePercentiles();
        
        this.regimeLogic = {
            'Fragile Topping / Reversal Risk': [
                (s) => this.getPercentileRank('temperature', s.temperature) > 75,
                (s) => this.getPercentileRank('entropy', s.entropy) > 75,
                (s) => this.getPercentileRank('momentum', s.momentum) < 25,
            ],
            'Chaotic Indecision': [
                (s) => this.getPercentileRank('temperature', s.temperature) > 75,
                (s) => this.getPercentileRank('entropy', s.entropy) > 75,
            ],
            'Stable Bull Trend': [
                (s) => this.getPercentileRank('entropy', s.entropy) < 25,
                (s) => this.getPercentileRank('temperature', s.temperature) < 25,
                (s) => this.getPercentileRank('momentum', s.momentum) > 75,
                (s) => s.price_velocity !== null && s.price_velocity > 0,
            ],
            'Stable Bear Trend': [
                (s) => this.getPercentileRank('entropy', s.entropy) < 25,
                (s) => this.getPercentileRank('temperature', s.temperature) < 25,
                (s) => this.getPercentileRank('momentum', s.momentum) > 75,
                (s) => s.price_velocity !== null && s.price_velocity <= 0,
            ],
            'Coiling Spring (High Tension)': [
                (s) => this.getPercentileRank('potential', s.potential) > 75,
                (s) => this.getPercentileRank('momentum', s.momentum) < 25,
                (s) => this.getPercentileRank('temperature', s.temperature) < 50,
            ],
            'Low Volatility / Orderly': [
                 (s) => this.getPercentileRank('entropy', s.entropy) < 25,
                 (s) => this.getPercentileRank('temperature', s.temperature) < 25,
            ],
        };
    }

    private _calculatePercentiles() {
        const keys = ['potential', 'momentum', 'entropy', 'temperature'];
        keys.forEach(key => {
            this.sortedValues[key] = this.historicalData
                .map(d => d[key as keyof StateVectorDataPoint] as number)
                .filter(v => v !== null && isFinite(v))
                .sort((a, b) => a - b);
        });
    }
    
    public getPercentileRank(key: 'potential' | 'momentum' | 'entropy' | 'temperature', value: number | null): number {
        if (value === null || !isFinite(value) || !this.sortedValues[key] || this.sortedValues[key].length === 0) return 0;
        
        const arr = this.sortedValues[key];
        let low = 0, high = arr.length;
        
        while (low < high) {
            const mid = Math.floor(low + (high - low) / 2);
            if (arr[mid] < value) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return (low / arr.length) * 100;
    }
    
    public classify(latestState: StateVectorDataPoint): Record<string, number> {
        let scores: Record<string, number> = {};
        for (const [regime, conditions] of Object.entries(this.regimeLogic)) {
            let metConditions = 0;
            conditions.forEach(condition => {
                if (condition(latestState)) metConditions++;
            });
            scores[regime] = (100 * metConditions) / conditions.length;
        }
        return scores;
    }
}

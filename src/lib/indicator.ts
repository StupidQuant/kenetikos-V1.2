
import * as math from 'mathjs';

// --- TYPE DEFINITIONS ---

export type MarketDataPoint = {
  timestamp: number;
  price: number;
  volume: number;
};

export type StateVectorDataPoint = MarketDataPoint & {
  // Core calculated values
  p_eq: number | null;
  k: number | null;
  F: number | null;
  m: number | null;
  potential: number | null;
  momentum: number | null;
  entropy: number | null;
  temperature: number | null;
  
  // Intermediate values for debugging/analysis
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

/**
 * Applies a Savitzky-Golay filter to smooth data and calculate derivatives.
 * This is a TypeScript implementation of the logic found in the original prototype.
 */
export function savitzkyGolay(data: MarketDataPoint[], { windowSize, polynomialOrder }: { windowSize: number; polynomialOrder: number; }): Omit<StateVectorDataPoint, 'p_eq' | 'k' | 'F' | 'm' | 'potential' | 'momentum' | 'entropy' | 'temperature'>[] {
    if (!Number.isInteger(windowSize) || windowSize % 2 === 0 || windowSize <= 0) return data.map(d => ({ ...d, smoothed_price: null, price_velocity: null, price_acceleration: null }));
    if (!Number.isInteger(polynomialOrder) || polynomialOrder < 0 || polynomialOrder >= windowSize) return data.map(d => ({ ...d, smoothed_price: null, price_velocity: null, price_acceleration: null }));

    const halfWindow = Math.floor(windowSize / 2);
    const result: Omit<StateVectorDataPoint, 'p_eq' | 'k' | 'F' | 'm' | 'potential' | 'momentum' | 'entropy' | 'temperature'>[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < halfWindow || i >= data.length - halfWindow) {
            result.push({ ...data[i], smoothed_price: null, price_velocity: null, price_acceleration: null });
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
            const c = math.lusolve(math.multiply(math.transpose(A), A), math.multiply(math.transpose(A), y)).toArray().flat() as number[];
            result.push({
                ...data[i],
                smoothed_price: c[0],
                price_velocity: c[1] ?? null,
                price_acceleration: polynomialOrder >= 2 ? 2 * (c[2] ?? 0) : 0,
            });
        } catch (error) {
            result.push({ ...data[i], smoothed_price: null, price_velocity: null, price_acceleration: null });
        }
    }
    return result;
}

function calculateSMA(arr: any[], startIndex: number, endIndex: number, key: string): number {
    let sum = 0;
    let count = 0;
    for (let i = startIndex; i < endIndex; i++) {
        if (arr[i] && typeof arr[i][key] === 'number' && isFinite(arr[i][key])) {
            sum += arr[i][key];
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}

export function estimateMarketParameters<T extends { price_acceleration: number | null, smoothed_price: number | null, volume: number }>(data: T[], { regressionWindow, equilibriumWindow }: { regressionWindow: number, equilibriumWindow: number }): (T & { k: number | null; F: number | null; m: number | null; p_eq: number | null; })[] {
    const minDataLength = Math.max(regressionWindow, equilibriumWindow);
    return data.map((point, i) => {
        if (i < minDataLength - 1 || point.price_acceleration === null || point.smoothed_price === null) {
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
            if (wp && wp.price_acceleration !== null && wp.smoothed_price !== null) {
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
            const beta = math.lusolve(math.multiply(math.transpose(X), X), math.multiply(math.transpose(X), Y)).toArray().flat() as number[];
            return { ...point, k: -beta[1], F: beta[0], p_eq, m };
        } catch (error) {
            return { ...point, k: null, F: null, m, p_eq };
        }
    });
}

export function calculateRollingLagrangianEntropy(series: (number | null)[], { entropyWindow, numBins }: { entropyWindow: number; numBins: number; }): (number | null)[] {
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

    if (globalMin === globalMax || !isFinite(globalMin)) {
        return new Array(series.length).fill(0);
    }

    const binWidth = (globalMax - globalMin) / numBins;
    if (binWidth <= 0) {
        return new Array(series.length).fill(0);
    }

    const discretizeValue = (v: number | null) => v === null || !isFinite(v) ? null : Math.floor(Math.max(0, Math.min(numBins - 1, (v - globalMin) / binWidth)));
    const calculateEntropyFromCounts = (counts: Map<number, number>, size: number) => {
        let e = 0;
        for (const c of counts.values()) {
            if (c > 0) {
                const p = c / size;
                e -= p * log(p);
            }
        }
        return e;
    };

    const results = new Array(series.length).fill(null);
    const counts = new Map(Array.from({ length: numBins }, (_, i) => [i, 0]));
    let validPoints = 0;
    
    for (let i = 0; i < entropyWindow; i++) {
        const bin = discretizeValue(series[i]);
        if (bin !== null) {
            counts.set(bin, (counts.get(bin) ?? 0) + 1);
            validPoints++;
        }
    }
    
    if (validPoints > 0) {
        results[entropyWindow - 1] = calculateEntropyFromCounts(counts, validPoints);
    }

    for (let i = entropyWindow; i < series.length; i++) {
        const oldBin = discretizeValue(series[i - entropyWindow]);
        const newBin = discretizeValue(series[i]);
        
        if (oldBin !== null) {
            const oldBinCount = counts.get(oldBin);
            if(oldBinCount && oldBinCount > 0) {
                counts.set(oldBin, oldBinCount - 1);
                validPoints--;
            }
        }
        if (newBin !== null) {
            counts.set(newBin, (counts.get(newBin) ?? 0) + 1);
            validPoints++;
        }
        
        if (validPoints > 0) {
            results[i] = calculateEntropyFromCounts(counts, validPoints);
        }
    }
    return results;
}

export function calculateTemperature<T extends { entropy: number | null, volume: number | null }>(data: T[], { temperatureWindow }: { temperatureWindow: number; }): (T & { temperature: number | null })[] {
    const results = data.map(d => ({ ...d, temperature: null }));
    const epsilon = 1e-10;

    for (let i = temperatureWindow - 1; i < data.length; i++) {
        const deltas: { x: number; y: number }[] = [];
        for (let j = 0; j < temperatureWindow - 1; j++) {
            const curr = data[i - j];
            const prev = data[i - j - 1];
            if (curr && prev && curr.entropy !== null && prev.entropy !== null && curr.volume !== null && prev.volume !== null) {
                deltas.push({ x: curr.entropy - prev.entropy, y: curr.volume - prev.volume });
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
        const slope = Math.abs(denom) > epsilon ? (deltas.length * sumXY - sumX * sumY) / denom : 0;
        results[i].temperature = Math.abs(slope) > epsilon ? 1 / Math.abs(slope) : Infinity;
    }
    return results;
}


/**
 * Main function to calculate the full 4D state vector.
 * This orchestrates the entire calculation pipeline.
 */
export function calculateStateVector(data: MarketDataPoint[], options: IndicatorOptions): StateVectorDataPoint[] {
    const smoothedData = savitzkyGolay(data, { windowSize: options.sgWindow, polynomialOrder: options.sgPolyOrder });
    const parameterData = estimateMarketParameters(smoothedData, { regressionWindow: options.regressionWindow, equilibriumWindow: options.equilibriumWindow });
    const velocitySeries = parameterData.map(d => d.price_velocity);
    const entropySeries = calculateRollingLagrangianEntropy(velocitySeries, { entropyWindow: options.entropyWindow, numBins: options.numBins });
    
    let entropyData = parameterData.map((d, i) => ({ ...d, entropy: entropySeries[i] }));
    const finalDataWithTemp = calculateTemperature(entropyData, { temperatureWindow: options.temperatureWindow });

    return finalDataWithTemp.map(d => {
        let momentum: number | null = null, potential: number | null = null;
        if (d.price_velocity !== null && d.m !== null) {
            momentum = 0.5 * d.m * Math.pow(d.price_velocity, 2);
        }
        if (d.k !== null && d.F !== null && d.smoothed_price !== null && d.p_eq !== null) {
            potential = 0.5 * d.k * Math.pow(d.smoothed_price - d.p_eq, 2) - d.F * d.smoothed_price;
        }
        return { ...d, potential, momentum };
    });
}

export class RegimeClassifier {
    private historicalData: StateVectorDataPoint[];
    private sortedValues: Record<string, number[]>;

    constructor(historicalData: StateVectorDataPoint[]) {
        this.historicalData = historicalData.filter(d => Object.values(d).every(v => v === null || (typeof v === 'number' && isFinite(v))));
        this.sortedValues = {};
        this._calculatePercentiles();
    }

    private _calculatePercentiles() {
        const keys: (keyof StateVectorDataPoint)[] = ['potential', 'momentum', 'entropy', 'temperature'];
        keys.forEach(key => {
            this.sortedValues[key as string] = this.historicalData
                .map(d => d[key] as number)
                .filter(v => v !== null && isFinite(v))
                .sort((a, b) => a - b);
        });
    }

    public getPercentileRank(value: number | null, key: keyof Omit<StateVectorDataPoint, 'timestamp' | 'price' | 'volume' | 'smoothed_price' | 'price_velocity' | 'price_acceleration' | 'p_eq' | 'k' | 'F' | 'm' >): number {
        const keyStr = key as string;
        if (value === null || !isFinite(value) || !this.sortedValues[keyStr] || this.sortedValues[keyStr].length === 0) {
            return 0;
        }
        const arr = this.sortedValues[keyStr];
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
        const regimeLogic: Record<string, ((s: StateVectorDataPoint) => boolean)[]> = {
            'Fragile topping/reversal risk': [
                (s) => this.getPercentileRank(s.temperature, 'temperature') > 75,
                (s) => this.getPercentileRank(s.entropy, 'entropy') > 75,
                (s) => this.getPercentileRank(s.momentum, 'momentum') < 25,
            ],
            'Chaotic indecision': [
                (s) => this.getPercentileRank(s.temperature, 'temperature') > 75,
                (s) => this.getPercentileRank(s.entropy, 'entropy') > 75,
            ],
            'Stable bull/bear trend': [
                (s) => this.getPercentileRank(s.entropy, 'entropy') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 25,
                (s) => this.getPercentileRank(s.momentum, 'momentum') > 75,
            ],
            'Coiling Spring (High Tension)': [
                (s) => this.getPercentileRank(s.potential, 'potential') > 75,
                (s) => this.getPercentileRank(s.momentum, 'momentum') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 50,
            ],
            'Low volatility/Orderly': [
                (s) => this.getPercentileRank(s.entropy, 'entropy') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 25,
            ],
        };

        const scores: Record<string, number> = {};
        for (const [regime, conditions] of Object.entries(regimeLogic)) {
            let metConditions = 0;
            conditions.forEach(condition => {
                if (condition(latestState)) {
                    metConditions++;
                }
            });
            scores[regime] = (100 * metConditions) / conditions.length;
        }
        return scores;
    }
}

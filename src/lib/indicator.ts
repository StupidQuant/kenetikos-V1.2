
import * as math from 'mathjs';

// Type definitions based on the application structure
export type MarketDataPoint = {
  timestamp: number;
  price: number;
  volume: number;
};

// This will be the comprehensive data structure for each point after calculations
export type StateVectorDataPoint = MarketDataPoint & {
  smoothed_price: number | null;
  price_velocity: number | null;
  price_acceleration: number | null;
  k: number | null;
  F: number | null;
  p_eq: number | null;
  m: number | null;
  potential: number | null;
  momentum: number | null;
  entropy: number | null;
  temperature: number | null;
};

// Options for the main calculation function
export type IndicatorOptions = {
    sgWindow: number;
    sgPolyOrder: number;
    regressionWindow: number;
    equilibriumWindow: number;
    entropyWindow: number;
    numBins: number;
    temperatureWindow: number;
};

/**
 * Applies a Savitzky-Golay filter to smooth data and calculate derivatives.
 * This is a direct port of the version from your original code.
 */
export function savitzkyGolay(data: MarketDataPoint[], { windowSize, polynomialOrder }: { windowSize: number; polynomialOrder: number; }): StateVectorDataPoint[] {
    const halfWindow = Math.floor(windowSize / 2);
    const result: StateVectorDataPoint[] = [];

    if (!Number.isInteger(windowSize) || windowSize % 2 === 0 || windowSize <= 0) {
      console.error("Savitzky-Golay: windowSize must be a positive odd integer.");
      return data.map(d => ({ ...d, smoothed_price: null, price_velocity: null, price_acceleration: null, k: null, F: null, p_eq: null, m: null, potential: null, momentum: null, entropy: null, temperature: null }));
    }
    if (!Number.isInteger(polynomialOrder) || polynomialOrder < 1 || polynomialOrder >= windowSize) {
      console.error("Savitzky-Golay: polynomialOrder must be a positive integer less than windowSize.");
      return data.map(d => ({ ...d, smoothed_price: null, price_velocity: null, price_acceleration: null, k: null, F: null, p_eq: null, m: null, potential: null, momentum: null, entropy: null, temperature: null }));
    }

    for (let i = 0; i < data.length; i++) {
        if (i < halfWindow || i >= data.length - halfWindow) {
            result.push({ ...data[i], smoothed_price: null, price_velocity: null, price_acceleration: null, k: null, F: null, p_eq: null, m: null, potential: null, momentum: null, entropy: null, temperature: null });
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
                ...data[i],
                smoothed_price: c[0],
                price_velocity: c[1],
                price_acceleration: polynomialOrder >= 2 ? 2 * c[2] : 0,
                k: null, F: null, p_eq: null, m: null, potential: null, momentum: null, entropy: null, temperature: null
            });
        } catch (error) {
            console.error(`Savitzky-Golay failed at index ${i}:`, error);
            result.push({ ...data[i], smoothed_price: null, price_velocity: null, price_acceleration: null, k: null, F: null, p_eq: null, m: null, potential: null, momentum: null, entropy: null, temperature: null });
        }
    }
    return result;
}


function calculateSMA(arr: StateVectorDataPoint[], startIndex: number, endIndex: number, key: keyof StateVectorDataPoint): number {
    let sum = 0;
    let count = 0;
    for (let i = startIndex; i < endIndex; i++) {
        const value = arr[i]?.[key];
        if (typeof value === 'number' && isFinite(value)) {
            sum += value;
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}

/**
 * Estimates market parameters k (mean-reversion) and F (trend force).
 */
export function estimateMarketParameters(data: StateVectorDataPoint[], { regressionWindow, equilibriumWindow }: { regressionWindow: number; equilibriumWindow: number; }): StateVectorDataPoint[] {
    const minDataLength = Math.max(regressionWindow, equilibriumWindow);

    return data.map((point, i) => {
        if (i < minDataLength - 1 || point.price_acceleration === null || point.smoothed_price === null) {
            return point;
        }

        const p_eq = calculateSMA(data, i - equilibriumWindow + 1, i + 1, 'smoothed_price');
        const avg_vol = calculateSMA(data, i - regressionWindow + 1, i + 1, 'volume');
        const avg_price = calculateSMA(data, i - regressionWindow + 1, i + 1, 'smoothed_price');
        const m = avg_price > 0 ? avg_vol / avg_price : 0;

        if (m < 1e-9) return { ...point, k: null, F: null, m, p_eq };

        const y_data: number[][] = [];
        const x_data: number[][] = [];
        for (let j = 0; j < regressionWindow; j++) {
            const wp = data[i - j];
            if (wp && wp.price_acceleration !== null && wp.smoothed_price !== null && p_eq !== null) {
                y_data.push([m * wp.price_acceleration]);
                x_data.push([1, wp.smoothed_price - p_eq]);
            }
        }

        if (x_data.length < 2) return { ...point, k: null, F: null, m, p_eq };

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

/**
 * Calculates rolling Shannon entropy for a given series.
 */
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
    if (binWidth <= 0) return new Array(series.length).fill(0);

    const discretizeValue = (v: number | null): number | null =>
        v === null || !isFinite(v) ? null : Math.floor(Math.max(0, Math.min(numBins - 1, (v - globalMin) / binWidth)));

    const calculateEntropyFromCounts = (counts: Map<number, number>, size: number): number => {
        let e = 0;
        for (const c of counts.values()) {
            if (c > 0) {
                const p = c / size;
                e -= p * log(p);
            }
        }
        return e;
    };

    const results: (number | null)[] = new Array(series.length).fill(null);
    const counts = new Map<number, number>(Array.from({ length: numBins }, (_, i) => [i, 0]));
    let validPoints = 0;

    for (let i = 0; i < entropyWindow; i++) {
        const bin = discretizeValue(series[i]);
        if (bin !== null) {
            counts.set(bin, (counts.get(bin) || 0) + 1);
            validPoints++;
        }
    }
    if (validPoints > 0) {
        results[entropyWindow - 1] = calculateEntropyFromCounts(counts, validPoints);
    }

    for (let i = entropyWindow; i < series.length; i++) {
        const oldBin = discretizeValue(series[i - entropyWindow]);
        const newBin = discretizeValue(series[i]);

        if (oldBin !== null && (counts.get(oldBin) || 0) > 0) {
            counts.set(oldBin, (counts.get(oldBin) || 1) - 1);
            validPoints--;
        }
        if (newBin !== null) {
            counts.set(newBin, (counts.get(newBin) || 0) + 1);
            validPoints++;
        }
        if (validPoints > 0) {
            results[i] = calculateEntropyFromCounts(counts, validPoints);
        } else {
            results[i] = 0;
        }
    }
    return results;
}

/**
 * Calculates economic temperature.
 */
export function calculateTemperature(data: StateVectorDataPoint[], { temperatureWindow }: { temperatureWindow: number; }): StateVectorDataPoint[] {
    const results = [...data];
    const epsilon = 1e-10;

    for (let i = temperatureWindow - 1; i < data.length; i++) {
        const deltas: { x: number; y: number }[] = [];
        for (let j = 0; j < temperatureWindow - 1; j++) {
            const curr = results[i - j];
            const prev = results[i - j - 1];
            if (curr && prev && curr.entropy !== null && prev.entropy !== null && curr.volume !== null && prev.volume !== null) {
                const deltaE = curr.entropy - prev.entropy;
                const deltaV = curr.volume - prev.volume;
                if(isFinite(deltaE) && isFinite(deltaV)) {
                   deltas.push({ x: deltaE, y: deltaV });
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
    // 1. Smooth price and get derivatives
    const smoothedData = savitzkyGolay(data, { windowSize: options.sgWindow, polynomialOrder: options.sgPolyOrder });

    // 2. Estimate market parameters
    const parameterData = estimateMarketParameters(smoothedData, { regressionWindow: options.regressionWindow, equilibriumWindow: options.equilibriumWindow });

    // 3. Calculate entropy from price velocity
    const velocitySeries = parameterData.map(d => d.price_velocity);
    const entropySeries = calculateRollingLagrangianEntropy(velocitySeries, { entropyWindow: options.entropyWindow, numBins: options.numBins });
    let entropyData = parameterData.map((d, i) => ({ ...d, entropy: entropySeries[i] }));

    // 4. Calculate temperature
    const tempData = calculateTemperature(entropyData, { temperatureWindow: options.temperatureWindow });
    
    // 5. Calculate final Potential and Momentum
    const finalData = tempData.map(d => {
        let momentum: number | null = null;
        let potential: number | null = null;

        if (d.price_velocity !== null && d.m !== null) {
            momentum = 0.5 * d.m * Math.pow(d.price_velocity, 2);
        }

        if (d.k !== null && d.F !== null && d.smoothed_price !== null && d.p_eq !== null) {
            potential = 0.5 * d.k * Math.pow(d.smoothed_price - d.p_eq, 2) - d.F * d.smoothed_price;
        }

        return { ...d, potential, momentum };
    });

    return finalData;
}


/**
 * Classifies the market regime based on the latest state vector data.
 */
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
                (s) => this.getPercentileRank(s.temperature, 'temperature') > 75,
                (s) => this.getPercentileRank(s.entropy, 'entropy') > 75,
                (s) => this.getPercentileRank(s.momentum, 'momentum') < 25,
            ],
            'Chaotic Indecision': [
                (s) => this.getPercentileRank(s.temperature, 'temperature') > 75,
                (s) => this.getPercentileRank(s.entropy, 'entropy') > 75,
            ],
            'Stable Bull Trend': [
                (s) => this.getPercentileRank(s.entropy, 'entropy') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 25,
                (s) => this.getPercentileRank(s.momentum, 'momentum') > 75,
                (s) => s.price_velocity !== null && s.price_velocity > 0,
            ],
            'Stable Bear Trend': [
                (s) => this.getPercentileRank(s.entropy, 'entropy') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 25,
                (s) => this.getPercentileRank(s.momentum, 'momentum') > 75,
                (s) => s.price_velocity !== null && s.price_velocity <= 0,
            ],
            'Coiling Spring (High Tension)': [
                (s) => this.getPercentileRank(s.potential, 'potential') > 75,
                (s) => this.getPercentileRank(s.momentum, 'momentum') < 25,
                (s) => this.getPercentileRank(s.temperature, 'temperature') < 50,
            ],
            'Low Volatility / Orderly': [
                 (s) => this.getPercentileRank(s.entropy, 'entropy') < 25,
                 (s) => this.getPercentileRank(s.temperature, 'temperature') < 25,
            ],
        };
    }

    private _calculatePercentiles() {
        const keys = ['potential', 'momentum', 'entropy', 'temperature'];
        keys.forEach(key => {
            // The type assertion is safe here due to the filter in the constructor
            this.sortedValues[key] = this.historicalData
                .map(d => d[key as keyof StateVectorDataPoint] as number)
                .sort((a, b) => a - b);
        });
    }
    
    public getPercentileRank(value: number | null, key: 'potential' | 'momentum' | 'entropy' | 'temperature'): number {
        if (value === null || !this.sortedValues[key] || this.sortedValues[key].length === 0) return 0;
        
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

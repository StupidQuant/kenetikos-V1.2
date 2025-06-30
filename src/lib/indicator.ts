
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
    numBins: number; // This will be superseded by Freedman-Diaconis but kept for legacy/control
    temperatureWindow: number;
};


// --- CAUSAL ENGINE V2.0 IMPLEMENTATION ---

const sgCoeffsCache: Map<string, number[][] | null> = new Map();

/**
 * Computes the Savitzky-Golay coefficient matrix H = (A^T * A)^-1 * A^T.
 * The rows of H contain the filter weights for each polynomial coefficient (a0, a1,...).
 * @param windowSize The number of past data points (w).
 * @param polynomialOrder The order of the polynomial to fit (p).
 * @returns The (p+1) x w coefficient matrix H, or null if not solvable.
 */
function getCausalSgCoeffs(windowSize: number, polynomialOrder: number): number[][] | null {
   const cacheKey = `${windowSize}-${polynomialOrder}`;
   if (sgCoeffsCache.has(cacheKey)) {
       return sgCoeffsCache.get(cacheKey)!;
   }

   if (polynomialOrder >= windowSize) {
       return null;
   }

   const A: number[][] = [];
   for (let i = 0; i < windowSize; i++) {
       const timeIndex = -(windowSize - 1) + i;
       const row: number[] = [];
       for (let j = 0; j <= polynomialOrder; j++) {
           row.push(Math.pow(timeIndex, j));
       }
       A.push(row);
   }

   try {
       const matA = math.matrix(A);
       const AT = math.transpose(matA);
       const ATA = math.multiply(AT, matA);
       const ATA_inv = math.inv(ATA);
       const H = math.multiply(ATA_inv, AT);
       
       const coeffs = H.toArray() as number[][];
       sgCoeffsCache.set(cacheKey, coeffs);
       return coeffs;
   } catch(e) {
       console.error("Failed to compute SG coefficients", e);
       sgCoeffsCache.set(cacheKey, null);
       return null;
   }
}


/**
 * Applies a one-sided (causal) Savitzky-Golay filter to a series of data.
 * @param data An array of MarketDataPoint objects.
 * @param windowSize The size of the filter window.
 * @param polynomialOrder The order of the fitting polynomial.
 * @returns An array of objects with smoothed_price, price_velocity, and price_acceleration.
 */
function savitzkyGolayCausal(data: MarketDataPoint[], { windowSize, polynomialOrder }: { windowSize: number, polynomialOrder: number }) {
    const results: { smoothed_price: number | null, price_velocity: number | null, price_acceleration: number | null }[] = [];
    const deltaT = 1; // Assuming unit time steps for simplicity. Could be made dynamic.

    const H = getCausalSgCoeffs(windowSize, polynomialOrder);
    if (!H) {
        // If coeffs can't be computed, return nulls for all points.
        return data.map(() => ({ smoothed_price: null, price_velocity: null, price_acceleration: null }));
    }

    const smoothingCoeffs = H[0] || [];
    const derivativeCoeffs = H[1] || [];
    const accelerationCoeffs = H[2] || [];

    for (let i = 0; i < data.length; i++) {
        if (i < windowSize - 1) {
            results.push({ smoothed_price: null, price_velocity: null, price_acceleration: null });
            continue;
        }

        const windowData = data.slice(i - windowSize + 1, i + 1).map(d => d.price);
        
        let smoothedValue = 0;
        let derivativeTerm = 0;
        let accelerationTerm = 0;

        for (let j = 0; j < windowSize; j++) {
            smoothedValue += smoothingCoeffs[j] * windowData[j];
            if (derivativeCoeffs.length > 0) {
                derivativeTerm += derivativeCoeffs[j] * windowData[j];
            }
            if (accelerationCoeffs.length > 0) {
                accelerationTerm += accelerationCoeffs[j] * windowData[j];
            }
        }
        
        // The derivative must be scaled by the sampling interval.
        const derivative = derivativeTerm / deltaT;
        // Second derivative scaling is 2!/deltaT^2.
        const acceleration = 2 * accelerationTerm / (deltaT * deltaT);
        
        results.push({
            smoothed_price: smoothedValue,
            price_velocity: derivative,
            price_acceleration: polynomialOrder >= 2 ? acceleration : null,
        });
    }

    return results;
}

/**
 * Calculates the value at a given percentile in a sorted numeric array.
 * @param sortedData A pre-sorted array of numbers.
 * @param percentile A number between 0 and 100.
 * @returns The value at the specified percentile.
 */
function getPercentile(sortedData: number[], percentile: number): number {
   if (sortedData.length === 0 || percentile < 0 || percentile > 100) return NaN;
   if (sortedData.length === 1) return sortedData[0];
   const index = (percentile / 100) * (sortedData.length - 1);
   const lowerIndex = Math.floor(index);
   const upperIndex = Math.ceil(index);
   if (lowerIndex === upperIndex) return sortedData[lowerIndex];
   const lowerValue = sortedData[lowerIndex];
   const upperValue = sortedData[upperIndex];
   const weight = index - lowerIndex;
   return lowerValue * (1 - weight) + upperValue * weight;
}


/**
 * CAUSAL IMPLEMENTATION of rolling Shannon Entropy using the Freedman-Diaconis rule.
 * @param series The input time series (e.g., price_velocity).
 * @param entropyWindow The size of the rolling window.
 * @returns An array of entropy values.
 */
function calculateCausalRollingEntropy(series: (number | null)[], { entropyWindow }: { entropyWindow: number }) {
    if (!series || series.length < entropyWindow) {
        return new Array(series.length).fill(null);
    }
    const log = Math.log2;
    const results: (number | null)[] = new Array(series.length).fill(null);

    for (let i = entropyWindow - 1; i < series.length; i++) {
        const windowData = series.slice(i - entropyWindow + 1, i + 1).filter(v => v !== null && isFinite(v)) as number[];
        
        if (windowData.length < 2) {
            results[i] = 0; // Not enough data or no variance, entropy is 0.
            continue;
        }

        const sortedWindow = [...windowData].sort((a, b) => a - b);
        const q1 = getPercentile(sortedWindow, 25);
        const q3 = getPercentile(sortedWindow, 75);
        const iqr = q3 - q1;
        const n = windowData.length;

        let binWidth: number;
        if (iqr > 0) {
            binWidth = (2 * iqr) / Math.pow(n, 1 / 3);
        } else {
            const dataRange = sortedWindow[n - 1] - sortedWindow[0];
            if (dataRange > 0) {
                // Fallback for zero IQR but non-zero range (e.g., using Scott's rule as inspiration)
                const stdDev = math.std(windowData) as number;
                binWidth = (3.49 * stdDev) / Math.pow(n, 1/3);
            } else {
                 // All points are identical, so entropy is 0.
                results[i] = 0;
                continue;
            }
        }
        
        if (binWidth <= 0) {
            results[i] = 0;
            continue;
        }

        const windowMin = sortedWindow[0];
        const numBins = Math.max(1, Math.ceil((sortedWindow[n - 1] - windowMin) / binWidth));
        const counts = new Array(numBins).fill(0);
        
        for (const value of windowData) {
            let binIndex = Math.floor((value - windowMin) / binWidth);
            if (binIndex >= numBins) {
                binIndex = numBins - 1;
            }
            counts[binIndex]++;
        }

        let entropy = 0;
        for (const count of counts) {
            if (count > 0) {
                const probability = count / n;
                entropy -= probability * log(probability);
            }
        }
        results[i] = entropy;
    }
    return results;
}


// --- LEGACY/UNCHANGED FUNCTIONS (ASSUMED CAUSAL) ---

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
                  deltas.push({ x: dE, y: dV });
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
            const slope = (deltas.length * sumXY - sumX * sumY) / denom;
            results[i].temperature = Math.abs(slope) > epsilon ? 1 / Math.abs(slope) : null;
        } else {
            results[i].temperature = null;
        }
    }
    return results;
}


// --- MASTER CALCULATION PIPELINE ---

export function calculateStateVector(data: MarketDataPoint[], options: IndicatorOptions): StateVectorDataPoint[] {
    // Phase 1: Causal Smoothing and Derivative Estimation
    const smoothedData = savitzkyGolayCausal(data, {windowSize: options.sgWindow, polynomialOrder: options.sgPolyOrder});
    const dataWithDerivatives = data.map((d, i) => ({ ...d, ...smoothedData[i] }));
    
    // Phase 2: Estimate Market Parameters (k, F, m, p_eq)
    const parameterData = estimateMarketParameters(dataWithDerivatives, {regressionWindow: options.regressionWindow, equilibriumWindow: options.equilibriumWindow});
    
    // Phase 3: Causal Entropy Calculation
    const velocitySeries = parameterData.map(d => d.price_velocity);
    const entropySeries = calculateCausalRollingEntropy(velocitySeries, { entropyWindow: options.entropyWindow });
    
    let entropyData = parameterData.map((d, i) => ({ ...d, entropy: entropySeries[i] }));
    
    // Phase 4: Temperature Calculation
    let finalData = calculateTemperature(entropyData, { temperatureWindow: options.temperatureWindow });
    
    // Final Phase: Calculate Potential and Momentum
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

// --- REGIME CLASSIFIER (CAUSAL VERSION) ---

export class RegimeClassifier {
    // Note: To be fully causal, this classifier should also use a ROLLING window for percentile ranks.
    // For now, we keep the original logic but acknowledge it's for historical analysis.
    // A fully causal implementation is a separate step.
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

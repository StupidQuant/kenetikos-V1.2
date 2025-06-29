
import * as math from 'mathjs';
import { STL } from '@/lib/stl';

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
  m: number;
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
    equilibriumWindow: number;
    entropyWindow: number;
    numBins: number;
    temperatureWindow: number;
};

// --- EKF IMPLEMENTATION using math.js ---
class MarketPhysicsEKF {
    private x: math.Matrix;
    private P: math.Matrix;
    private Q: math.Matrix;
    private R: math.Matrix;
    private dt: number;
    private m: number;

    constructor(dt: number, m: number = 1.0) {
        this.dt = dt;
        this.m = m;
        this.x = math.matrix([[0.1], [0.0]]);
        this.P = math.matrix([[0.1, 0], [0, 0.1]]);
        this.Q = math.matrix([[0.00001, 0], [0, 0.00025]]);
        this.R = math.matrix([[0.01]]);
    }

    predict() {
        this.P = math.add(this.P, this.Q) as math.Matrix;
    }

    update(p: number, p_prev: number, p_prev2: number, p_eq: number) {
        const H = math.matrix([[p_prev - p_eq, -1]]);
        const H_T = math.transpose(H);

        const S = math.add(math.multiply(math.multiply(H, this.P), H_T), this.R) as math.Matrix;
        const S_inv = math.inv(S);
        
        const K_intermediate = math.multiply(this.P, H_T);
        const K = math.multiply(K_intermediate, S_inv) as math.Matrix;

        const k_val = this.x.get([0, 0]);
        const F_val = this.x.get([1, 0]);
        const p_ddot = (p - 2 * p_prev + p_prev2) / (this.dt**2);
        const hx = this.m * p_ddot + k_val * (p_prev - p_eq) - F_val;
        const y = 0 - hx;

        const Ky = math.multiply(K, y);
        this.x = math.add(this.x, Ky) as math.Matrix;
        
        const I = math.identity(2) as math.Matrix;
        const KH = math.multiply(K, H);
        const I_KH = math.subtract(I, KH) as math.Matrix;
        this.P = math.multiply(I_KH, this.P) as math.Matrix;
    }
    
    get state() {
        return { k: this.x.get([0, 0]), F: this.x.get([1, 0]) };
    }
}


// --- CORE CALCULATION FUNCTIONS ---

function savitzkyGolay(data: MarketDataPoint[], { windowSize, polynomialOrder }: { windowSize: number; polynomialOrder: number; }): { smoothed_price: number | null, price_velocity: number | null, price_acceleration: number | null }[] {
    const halfWindow = Math.floor(windowSize / 2);
    const results = [];
    for (let i = 0; i < data.length; i++) {
        if (i < halfWindow || i >= data.length - halfWindow) {
            results.push({ smoothed_price: data[i].price, price_velocity: 0, price_acceleration: 0 });
            continue;
        }
        const windowSlice = data.slice(i - halfWindow, i + halfWindow + 1);
        const t = windowSlice.map((_, j) => -halfWindow + j);
        const y = windowSlice.map(p => p.price);
        try {
            const A = math.matrix(t.map(ti => Array.from({length: polynomialOrder + 1}, (_, p) => Math.pow(ti, p))));
            const c = math.lusolve(math.multiply(math.transpose(A), A), math.multiply(math.transpose(A), y)).toArray().flat();
            results.push({
                smoothed_price: c[0] ?? data[i].price,
                price_velocity: c[1] ?? 0,
                price_acceleration: (c[2] ?? 0) * 2,
            });
        } catch (error) {
            results.push({ smoothed_price: data[i].price, price_velocity: 0, price_acceleration: 0 });
        }
    }
    return results;
}

function calculateRollingLagrangianEntropy(series: (number | null)[], { entropyWindow, numBins }: { entropyWindow: number; numBins: number; }): (number | null)[] {
    if (!series || series.length < entropyWindow) return new Array(series.length).fill(null);
    const log = Math.log2;
    let globalMin = Infinity, globalMax = -Infinity;
    series.forEach(v => {
        if (v !== null && isFinite(v)) {
            globalMin = Math.min(globalMin, v);
            globalMax = Math.max(globalMax, v);
        }
    });

    if (!isFinite(globalMin)) return new Array(series.length).fill(null);
    const binWidth = (globalMax - globalMin) / numBins;
    if (binWidth <= 0) return new Array(series.length).fill(0);
    const results: (number | null)[] = new Array(series.length).fill(null);
    const counts = new Array(numBins).fill(0);
    let validPoints = 0;
    const discretize = (v: number) => Math.floor(Math.max(0, Math.min(numBins - 1, (v - globalMin) / binWidth)));

    for (let i = 0; i < series.length; i++) {
        const val = series[i];
        if (val !== null && isFinite(val)) {
            counts[discretize(val)]++;
            validPoints++;
        }
        if (i >= entropyWindow) {
            const oldVal = series[i - entropyWindow];
            if (oldVal !== null && isFinite(oldVal)) {
                counts[discretize(oldVal)]--;
                validPoints--;
            }
        }
        if (i >= entropyWindow - 1) {
            let entropy = 0;
            if (validPoints > 0) {
                for (const count of counts) {
                    if (count > 0) {
                        const p = count / validPoints;
                        entropy -= p * log(p);
                    }
                }
            }
            results[i] = entropy;
        }
    }
    return results;
}


// --- THE MASTER CALCULATION PIPELINE ---

export function calculateStateVector(data: MarketDataPoint[], options: IndicatorOptions): StateVectorDataPoint[] {
    const n = data.length;
    if (n < options.equilibriumWindow || n < options.sgWindow) return [];

    const prices = data.map(d => d.price);
    const p_eq_series = STL(prices, { period: options.equilibriumWindow, robust: true });
    
    const ekf = new MarketPhysicsEKF(1.0);
    const kf_estimates: ({k: number, F: number})[] = [];
    for (let i = 2; i < n; i++) {
        ekf.predict();
        if(p_eq_series[i-1] !== undefined){
            ekf.update(prices[i], prices[i-1], prices[i-2], p_eq_series[i-1]);
        }
        kf_estimates.push(ekf.state);
    }
    
    const sg_results = savitzkyGolay(data, options);

    let combinedData: Partial<StateVectorDataPoint>[] = data.map((d, i) => {
        const est_idx = i - 2;
        return {
            ...d,
            p_eq: p_eq_series[i] ?? null,
            k: kf_estimates[est_idx]?.k ?? null,
            F: kf_estimates[est_idx]?.F ?? null,
            ...sg_results[i]
        };
    });

    const firstValidK = combinedData.find(d => d.k !== null)?.k ?? 0.1;
    const firstValidF = combinedData.find(d => d.F !== null)?.F ?? 0;
    for(let d of combinedData) {
        if(d.k === null) d.k = firstValidK;
        if(d.F === null) d.F = firstValidF;
    }
    
    combinedData.forEach(d => {
        const m = (d.volume && d.price) ? d.volume / d.price : 1.0;
        d.m = m > 0 ? m : 1.0;
        if (d.price_velocity !== null) d.momentum = 0.5 * d.m * (d.price_velocity ** 2);
        if (d.k !== null && d.F !== null && d.smoothed_price !== null && d.p_eq !== null) {
            d.potential = 0.5 * d.k * ((d.smoothed_price - d.p_eq) ** 2) - d.F * d.smoothed_price;
        }
    });

    const velocitySeries = combinedData.map(d => d.price_velocity);
    const entropySeries = calculateRollingLagrangianEntropy(velocitySeries, options);
    combinedData.forEach((d, i) => d.entropy = entropySeries[i]);

    const tempData = [...combinedData];
    for (let i = options.temperatureWindow; i < n; i++) {
        const window = tempData.slice(i - options.temperatureWindow, i);
        const deltas = window.slice(1).map((curr, j) => {
            const prev = window[j];
            if(curr.entropy && prev.entropy && curr.volume && prev.volume){
                return { x: curr.entropy - prev.entropy, y: curr.volume - prev.volume };
            }
            return {x: 0, y: 0};
        }).filter(p => p.x !== 0);

        if (deltas.length < 2) continue;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        deltas.forEach(p => { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x; });
        const denom = deltas.length * sumX2 - sumX * sumX;
        const slope = Math.abs(denom) > 1e-9 ? (deltas.length * sumXY - sumX * sumY) / denom : 0;
        tempData[i].temperature = Math.abs(slope) > 1e-9 ? 1 / Math.abs(slope) : Infinity;
    }
    
    return tempData as StateVectorDataPoint[];
}


// --- REGIME CLASSIFIER ---
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
        if (value === null || !this.sortedValues[key] || this.sortedValues[key].length === 0) return 0;
        
        const arr = this.sortedValues[key];
        let low = 0, high = arr.length;
        
        while (low < high) {
            const mid = Math.floor(low + (high - low) / 2);
            if (arr[mid] < value) low = mid + 1;
            else high = mid;
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

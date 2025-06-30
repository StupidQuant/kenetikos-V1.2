/**
 * This file contains the implementation for the Gaussian Mixture Hidden Markov Model
 * (GM-HMM), which forms the core of the Phase 3 "Emergent Mind" engine.
 * The implementation follows the blueprint specified in the validated research report.
 */

import * as math from 'mathjs';

// --- TYPE DEFINITIONS & INTERFACES ---

export interface HMMParameters {
    pi: number[];
    A: number[][];
    mixWeights: number[][];
    means: number[][][];
    covariances: math.Matrix[][];
}

interface Responsibilities {
    gamma: number[][];
    gammaJm: number[][][];
    xi: number[][][];
    logLikelihood: number;
}

export class EmergentMindHMM {
    private readonly nStates: number;
    private readonly nMix: number;
    private readonly dims: number = 4;
    private params: HMMParameters | null = null;
    private maxIter: number = 100;
    private tolerance: number = 1e-5;

    constructor(nStates: number, nMix: number = 1) {
        this.nStates = nStates;
        this.nMix = nMix;
    }

    public fit(data: number[][], maxIter: number = 100, tolerance: number = 1e-5): number {
        this.maxIter = maxIter;
        this.tolerance = tolerance;
        this.initializeParameters(data);

        let previousLogLikelihood = -Infinity;
        for (let i = 0; i < this.maxIter; i++) {
            const responsibilities = this.eStep(data);
            if (!responsibilities) {
                console.error("Training failed: E-Step returned null.");
                return -Infinity;
            }
            this.mStep(data, responsibilities);
            
            const { logLikelihood } = responsibilities;
            if (Math.abs(logLikelihood - previousLogLikelihood) < this.tolerance) {
                console.log(`Convergence reached at iteration ${i + 1}.`);
                return logLikelihood;
            }
            previousLogLikelihood = logLikelihood;
        }
        console.warn(`HMM training did not converge within ${this.maxIter} iterations.`);
        return previousLogLikelihood;
    }

    public predict_proba(data: number[][]): number[][] {
        if (!this.params) throw new Error("Model has not been trained. Call fit() first.");
        const responsibilities = this.eStep(data);
        if (!responsibilities) throw new Error("Failed to calculate probabilities.");
        return responsibilities.gamma;
    }

    private initializeParameters(data: number[][]): void {
        const pi = new Array(this.nStates).fill(1 / this.nStates);
        const A = Array.from({ length: this.nStates }, () => new Array(this.nStates).fill(1 / this.nStates));
        const mixWeights = Array.from({ length: this.nStates }, () => new Array(this.nMix).fill(1 / this.nMix));
        
        const dataMatrix = math.matrix(data);
        const globalMean = math.mean(dataMatrix, 0) as math.Matrix;
        const globalCov = math.cov(dataMatrix) as math.Matrix;

        const means: number[][][] = [];
        const covariances: math.Matrix[][] = [];

        for (let i = 0; i < this.nStates; i++) {
            const stateMeans: number[][] = [];
            const stateCovs: math.Matrix[] = [];
            for (let j = 0; j < this.nMix; j++) {
                const perturbation = math.random([this.dims], -0.1, 0.1);
                stateMeans.push(math.add(globalMean, perturbation).toArray() as number[]);
                stateCovs.push(globalCov.clone());
            }
            means.push(stateMeans);
            covariances.push(stateCovs);
        }
        this.params = { pi, A, mixWeights, means, covariances };
    }

    private multivariateGaussianPdf(x: number[], mean: number[], cov: math.Matrix): number {
        try {
            const k = x.length;
            const diff = math.subtract(x, mean);
            const invCov = math.inv(cov);
            const detCov = math.det(cov);
            
            if (detCov <= 0) return 0;

            const exponentTerm = math.multiply(math.multiply(diff, invCov), math.transpose(diff));
            const exponent = -0.5 * (math.isMatrix(exponentTerm) ? exponentTerm.get([0]) : exponentTerm);
            
            const coefficient = 1 / (Math.pow(2 * Math.PI, k / 2) * Math.sqrt(detCov));
            
            return coefficient * Math.exp(exponent);
        } catch (e) {
            return 0;
        }
    }

    private calculateAllEmissionProbs(data: number[][]): number[][] {
        if (!this.params) throw new Error("Parameters not initialized");
        const T = data.length;
        const emissionProbs = Array.from({ length: T }, () => new Array(this.nStates).fill(0));

        for (let t = 0; t < T; t++) {
            for (let j = 0; j < this.nStates; j++) {
                let prob = 0;
                for (let m = 0; m < this.nMix; m++) {
                    prob += this.params.mixWeights[j][m] * this.multivariateGaussianPdf(data[t], this.params.means[j][m], this.params.covariances[j][m]);
                }
                emissionProbs[t][j] = prob;
            }
        }
        return emissionProbs;
    }

    private eStep(data: number[][]): Responsibilities | null {
        if (!this.params) return null;
        const T = data.length;

        const emissionProbs = this.calculateAllEmissionProbs(data);
        const alpha = math.zeros(T, this.nStates) as math.Matrix;
        const scaleFactors = new Array(T).fill(0);

        // Alpha pass
        let alpha_t = math.dotMultiply(this.params.pi, emissionProbs[0]);
        scaleFactors[0] = math.sum(alpha_t as math.Matrix | number[]);
        alpha.subset(math.index(0, math.range(0, this.nStates)), math.divide(alpha_t, scaleFactors[0]));
        
        for (let t = 1; t < T; t++) {
            const alpha_prev_scaled = alpha.subset(math.index(t - 1, math.range(0, this.nStates))).toArray()[0] as number[];
            alpha_t = math.multiply(alpha_prev_scaled, this.params.A);
            alpha_t = math.dotMultiply(alpha_t, emissionProbs[t]);
            scaleFactors[t] = math.sum(alpha_t as math.Matrix | number[]);
            alpha.subset(math.index(t, math.range(0, this.nStates)), math.divide(alpha_t, scaleFactors[t] || 1));
        }

        const logLikelihood = math.sum(scaleFactors.map(s => Math.log(s || 1)));

        // Beta pass
        const beta = math.ones(T, this.nStates) as math.Matrix;
        for (let t = T - 2; t >= 0; t--) {
            const beta_next = beta.subset(math.index(t + 1, math.range(0, this.nStates))).toArray()[0] as number[];
            const scaled_b = math.dotMultiply(beta_next, emissionProbs[t + 1]);
            const beta_t = math.multiply(scaled_b, math.transpose(this.params.A));
            beta.subset(math.index(t, math.range(0, this.nStates)), math.divide(beta_t, scaleFactors[t + 1] || 1));
        }

        const gamma = math.dotMultiply(alpha, beta) as math.Matrix;
        
        // Xi pass
        const xi = math.zeros(T - 1, this.nStates, this.nStates) as math.Matrix;
        for (let t = 0; t < T - 1; t++) {
            const alpha_row = alpha.subset(math.index(t, math.range(0, this.nStates))).toArray()[0] as number[];
            const beta_row = beta.subset(math.index(t + 1, math.range(0, this.nStates))).toArray()[0] as number[];
            const emission_row = emissionProbs[t + 1];
            
            const numerator = math.multiply(math.diag(math.matrix(alpha_row)), this.params.A);
            const term2 = math.multiply(numerator, math.diag(math.matrix(beta_row)));
            const term3 = math.multiply(term2, math.diag(math.matrix(emission_row)));
            
            const denominator = math.sum(term3);
            xi.subset(math.index(t, math.range(0, this.nStates), math.range(0, this.nStates)), math.divide(term3, denominator || 1));
        }

        const gammaJm = this.calculateGammaJm(data, gamma.toArray() as number[][]);

        return {
            gamma: gamma.toArray() as number[][],
            xi: xi.toArray() as number[][][],
            gammaJm,
            logLikelihood
        };
    }

    private calculateGammaJm(data: number[][], gamma: number[][]): number[][][] {
        if (!this.params) throw new Error("Parameters not initialized");
        const T = data.length;
        const gammaJm = Array.from({ length: T }, () => Array.from({ length: this.nStates }, () => new Array(this.nMix).fill(0)));

        for (let t = 0; t < T; t++) {
            for (let j = 0; j < this.nStates; j++) {
                const componentEmissions = new Array(this.nMix).fill(0);
                let emissionSum = 0;
                for (let m = 0; m < this.nMix; m++) {
                    const emission = this.params.mixWeights[j][m] * this.multivariateGaussianPdf(data[t], this.params.means[j][m], this.params.covariances[j][m]);
                    componentEmissions[m] = emission;
                    emissionSum += emission;
                }
                if (emissionSum > 1e-9) {
                    for (let m = 0; m < this.nMix; m++) {
                        gammaJm[t][j][m] = gamma[t][j] * (componentEmissions[m] / emissionSum);
                    }
                }
            }
        }
        return gammaJm;
    }

    private mStep(data: number[][], responsibilities: Responsibilities): void {
        if (!this.params) return;
        const { gamma, xi, gammaJm } = responsibilities;
        const T = data.length;

        // Re-estimate pi
        this.params.pi = gamma[0];

        // Re-estimate A
        const xiSumOverT = new Array(this.nStates).fill(0).map(() => new Array(this.nStates).fill(0));
        const gammaSumOverT_minus_1 = new Array(this.nStates).fill(0);
        for (let i = 0; i < this.nStates; i++) {
            for (let t = 0; t < T - 1; t++) {
                gammaSumOverT_minus_1[i] += gamma[t][i];
                for (let j = 0; j < this.nStates; j++) {
                    xiSumOverT[i][j] += xi[t][i][j];
                }
            }
        }
        for (let i = 0; i < this.nStates; i++) {
            const denominator = gammaSumOverT_minus_1[i];
            if (denominator > 1e-9) {
                for (let j = 0; j < this.nStates; j++) {
                    this.params.A[i][j] = xiSumOverT[i][j] / denominator;
                }
            }
        }

        // Re-estimate mixture components
        const gammaSumOverT = new Array(this.nStates).fill(0);
        for (let j = 0; j < this.nStates; j++) {
            for (let t = 0; t < T; t++) gammaSumOverT[j] += gamma[t][j];
        }

        for (let j = 0; j < this.nStates; j++) {
            for (let m = 0; m < this.nMix; m++) {
                let componentRespSum = 0;
                for (let t = 0; t < T; t++) componentRespSum += gammaJm[t][j][m];

                if (gammaSumOverT[j] > 1e-9) {
                    this.params.mixWeights[j][m] = componentRespSum / gammaSumOverT[j];
                }

                if (componentRespSum > 1e-9) {
                    // Update means
                    let weightedSum = math.zeros(this.dims) as math.Matrix;
                    for (let t = 0; t < T; t++) {
                        const weightedData = math.multiply(data[t], gammaJm[t][j][m]);
                        weightedSum = math.add(weightedSum, weightedData) as math.Matrix;
                    }
                    this.params.means[j][m] = (math.divide(weightedSum, componentRespSum) as math.Matrix).toArray() as number[];

                    // Update covariances
                    let weightedCovSum = math.zeros(this.dims, this.dims) as math.Matrix;
                    const newMean = this.params.means[j][m];
                    for (let t = 0; t < T; t++) {
                        const diff = math.subtract(data[t], newMean) as math.Matrix;
                        const outerProduct = math.multiply(math.transpose(diff), diff);
                        const weightedOuter = math.multiply(outerProduct, gammaJm[t][j][m]);
                        weightedCovSum = math.add(weightedCovSum, weightedOuter) as math.Matrix;
                    }
                    this.params.covariances[j][m] = math.divide(weightedCovSum, componentRespSum) as math.Matrix;
                }
            }
        }
    }
}

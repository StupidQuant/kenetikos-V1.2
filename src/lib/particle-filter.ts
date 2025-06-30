/**
 * This file contains a robust, production-ready implementation of a Sequential
 * Importance Resampling (SIR) Particle Filter, as specified in the Phase 2
 * research report ("A Definitive Blueprint for Online Parameter Estimation...").
 */

import { MvNormal, normalPdf } from './statistics';

/**
 * Represents a single particle in the filter, containing its state vector and weight.
 */
interface Particle {
   state: number[]; // State vector, e.g., [log(k), F]
   weight: number;
}

/**
 * Configuration options for the ParticleFilter.
 */
export interface ParticleFilterOptions {
    numParticles: number;
    initialStateMean: number[];
    initialStateCov: number[][];
    processNoiseCov: number[][];
    measurementNoiseVar: number;
    essThreshold?: number; // Optional threshold to trigger resampling
}

/**
 * A robust, generic implementation of a Sequential Importance Resampling (SIR)
 * Particle Filter, designed for online parameter estimation in state-space models.
 * The implementation includes adaptive resampling and follows the best practices
 * outlined in the validated research report.
 */
export class ParticleFilter {
    private particles: Particle[] = [];
    private readonly options: ParticleFilterOptions;
    private readonly stateDim: number;
    private readonly processNoiseSampler: MvNormal;
    private readonly essThreshold: number;

    constructor(options: ParticleFilterOptions) {
        this.options = options;
        this.stateDim = options.initialStateMean.length;
        this.essThreshold = options.essThreshold ?? options.numParticles / 2;

        if (this.stateDim !== options.processNoiseCov.length) {
            throw new Error("Dimension mismatch between initial state and process noise matrix Q.");
        }

        // Initialize samplers for process noise and initial state distribution
        this.processNoiseSampler = new MvNormal(new Array(this.stateDim).fill(0), options.processNoiseCov);
        const initialSampler = new MvNormal(options.initialStateMean, options.initialStateCov);

        // Initialize particles by sampling from the initial distribution
        for (let i = 0; i < this.options.numParticles; i++) {
            this.particles.push({
                state: initialSampler.sample(),
                weight: 1.0 / this.options.numParticles
            });
        }
    }

    /**
     * The measurement function h(x_t) which maps a state to a predicted measurement.
     * This is specific to the Kinētikós Entropḗ model.
     * z_t = F_t - k_t * (p(t) - p_eq(t))
     * The state vector is [log(k), F], so k must be exponentiated.
     * @param state The state vector [log(k), F].
     * @param p The current price p(t).
     * @param p_eq The current equilibrium price p_eq(t).
     * @returns The predicted measurement.
     */
    private h(state: number[], p: number, p_eq: number): number {
        const log_k = state[0];
        const F = state[1];
        
        // This is the implementation of the "Log-Normal Proposal" for the k >= 0 constraint.
        const k = Math.exp(log_k);
        
        const displacement = p - p_eq;
        return F - k * displacement;
    }

    /**
     * PREDICT step: Propagates each particle forward in time according to the
     * state transition model (a random walk): x_t = x_{t-1} + w_t.
     */
    public predict(): void {
        for (let i = 0; i < this.options.numParticles; i++) {
            const processNoise = this.processNoiseSampler.sample();
            for (let j = 0; j < this.stateDim; j++) {
                this.particles[i].state[j] += processNoise[j];
            }
        }
    }

    /**
     * UPDATE step: Updates the weight of each particle based on the latest measurement.
     * The weight is proportional to the likelihood of the measurement given the particle's state.
     * @param measurement The actual measurement z_t = m * p_ddot(t).
     * @param p The current price p(t).
     * @param p_eq The current equilibrium price p_eq(t).
     */
    public update(measurement: number, p: number, p_eq: number): void {
        let weightSum = 0;
        for (let i = 0; i < this.options.numParticles; i++) {
            const predictedMeasurement = this.h(this.particles[i].state, p, p_eq);
            
            // Calculate likelihood using the Gaussian PDF.
            // A robust alternative (Student's t-distribution) can be used here as a future enhancement.
            const likelihood = normalPdf(measurement, predictedMeasurement, Math.sqrt(this.options.measurementNoiseVar));
            
            this.particles[i].weight *= likelihood;
            weightSum += this.particles[i].weight;
        }

        // Normalize weights
        this.normalizeWeights(weightSum);

        // Adaptive Resampling: Resample only when necessary to combat impoverishment.
        if (this.getESS() < this.essThreshold) {
            this.resample();
        }
    }

    /**
     * Normalizes particle weights so they sum to 1. Handles weight collapse.
     * @param weightSum The current sum of all particle weights.
     */
    private normalizeWeights(weightSum: number): void {
        if (weightSum > 1e-9) { // Avoid division by zero
            for (let i = 0; i < this.options.numParticles; i++) {
                this.particles[i].weight /= weightSum;
            }
        } else {
            // Catastrophic weight collapse. All particles had near-zero likelihood.
            // This indicates filter divergence. Re-initialize weights uniformly as a recovery mechanism.
            for (let i = 0; i < this.options.numParticles; i++) {
                this.particles[i].weight = 1.0 / this.options.numParticles;
            }
        }
    }

    /**
     * RESAMPLE step: Resamples particles using Systematic Resampling to combat degeneracy.
     * This method is chosen for its low variance and O(N) efficiency.
     */
    private resample(): void {
        const newParticles: Particle[] = [];
        const N = this.options.numParticles;
        const cdf = new Array(N).fill(0);
        
        cdf[0] = this.particles[0].weight;
        for (let i = 1; i < N; i++) {
            cdf[i] = cdf[i - 1] + this.particles[i].weight;
        }

        const u0 = Math.random() / N;
        let i = 0;

        for (let j = 0; j < N; j++) {
            const uj = u0 + j / N;
            while (uj > cdf[i]) {
                i++;
            }
            newParticles.push({
                state: [...this.particles[i].state], // Create a deep copy of the state array
                weight: 1.0 / N // Reset weight to be uniform
            });
        }
        this.particles = newParticles;
    }
    
    /**
     * Calculates the Effective Sample Size (ESS). ESS = 1 / sum(weights^2).
     * This is a key metric for monitoring filter health and triggering adaptive resampling.
     * @returns The ESS value, ranging from 1 to N.
     */
    public getESS(): number {
        let sumOfSquares = 0;
        for (const particle of this.particles) {
            sumOfSquares += particle.weight * particle.weight;
        }
        if (sumOfSquares < 1e-12) return 0;
        return 1.0 / sumOfSquares;
    }

    /**
     * Calculates and returns the estimated state vector (the weighted mean of all particles).
     * Transforms the state from [log(k), F] back to the physically meaningful [k, F].
     * @returns The estimated state vector [k_est, F_est].
     */
    public getEstimate(): number[] {
        const estimate = new Array(this.stateDim).fill(0);
        for (const particle of this.particles) {
            for (let j = 0; j < this.stateDim; j++) {
                estimate[j] += particle.state[j] * particle.weight;
            }
        }
        
        // Transform the estimate back to the original parameter space [k, F]
        const k_est = Math.exp(estimate[0]);
        const F_est = estimate[1];
        
        return [k_est, F_est];
    }
}

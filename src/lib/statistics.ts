/**
 * This file contains statistical utility functions required for advanced
 * filtering techniques, such as the Particle Filter.
 */

import * as math from 'mathjs';

/**
 * A class to generate samples from a Multivariate Normal (Gaussian) distribution.
 * It uses the Cholesky decomposition method for efficient and stable sampling.
 */
export class MvNormal {
    private readonly mean: math.Matrix;
    private readonly choleskyL: math.Matrix;
    private readonly stateDim: number;

    /**
     * @param mean The mean vector of the distribution.
     * @param cov The covariance matrix of the distribution.
     */
    constructor(mean: number[], cov: number[][]) {
        this.mean = math.matrix(mean);
        this.stateDim = mean.length;
        
        // The Cholesky decomposition of the covariance matrix is used to transform
        // standard normal samples into samples from the target distribution.
        // Q = L * L^T. A sample x is then mu + L * z, where z ~ N(0, I).
        this.choleskyL = math.cholesky(cov).L;
    }

    /**
     * Generates a single random sample from the distribution.
     * @returns A single sample vector (array of numbers).
     */
    public sample(): number[] {
        // 1. Generate a vector of independent standard normal random variables.
        const z: number[] = [];
        for (let i = 0; i < this.stateDim; i++) {
            // Using the Box-Muller transform for generating standard normal samples.
            // This is a common and robust method.
            const u1 = Math.random();
            const u2 = Math.random();
            const rand_std_normal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
            z.push(rand_std_normal);
        }

        // 2. Transform the standard normal sample using the Cholesky factor and mean.
        // sample = mean + L * z
        const transformed_z = math.multiply(this.choleskyL, z);
        const finalSample = math.add(this.mean, transformed_z);

        return finalSample.toArray() as number[];
    }
}

/**
 * Calculates the probability density function (PDF) of a normal distribution
 * at a given point.
 * @param x The point at which to evaluate the PDF.
 * @param mean The mean of the distribution.
 * @param stdDev The standard deviation of the distribution.
 * @returns The probability density at point x.
 */
export function normalPdf(x: number, mean: number, stdDev: number): number {
    if (stdDev <= 0) return 0;
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
    return coefficient * Math.exp(exponent);
}

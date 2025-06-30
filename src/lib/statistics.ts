/**
 * This file contains statistical utility functions required for advanced
 * filtering techniques, such as the Particle Filter.
 */

import * as math from 'mathjs';

/**
 * Custom error class for non-positive-definite matrices, thrown by the
 * custom Cholesky decomposition function.
 */
export class NonPositiveDefiniteMatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonPositiveDefiniteMatrixError';
  }
}

/**
 * Computes the Cholesky decomposition of a symmetric, positive-definite matrix A,
 * such that A = LL^T, where L is a lower-triangular matrix.
 *
 * This implementation is based on the Cholesky-Banachiewicz algorithm as described
 * in "Numerical Recipes in C" by Press et al., Section 2.9.
 *
 * @param A A square, symmetric, positive-definite matrix represented as a 2D array.
 * @returns The lower-triangular matrix L.
 * @throws {Error} if the matrix is not square.
 * @throws {NonPositiveDefiniteMatrixError} if the matrix is not positive-definite.
 */
export function cholesky(A: number[][]): number[][] {
  const n = A.length;
  if (n === 0 || A.some(row => row.length !== n)) {
    throw new Error('Input matrix must be square.');
  }

  const L = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const diagonalValue = A[i][i] - sum;
        if (diagonalValue <= 0) {
          throw new NonPositiveDefiniteMatrixError(
            `Matrix is not positive-definite. Failed at diagonal [${i}][${i}].`
          );
        }
        L[i][j] = Math.sqrt(diagonalValue);
      } else {
        if (L[j][j] === 0) {
            throw new NonPositiveDefiniteMatrixError(
                'Division by zero encountered during decomposition; matrix is not positive-definite.'
            );
        }
        L[i][j] = (1.0 / L[j][j]) * (A[i][j] - sum);
      }
    }
  }

  return L;
}


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
        
        // This now calls our new, robust, self-contained cholesky function.
        // The result is a native array, which we convert to a math.Matrix.
        const L = cholesky(cov);
        this.choleskyL = math.matrix(L);
    }

    /**
     * Generates a single random sample from the distribution.
     * @returns A single sample vector (array of numbers).
     */
    public sample(): number[] {
        const z: number[] = [];
        for (let i = 0; i < this.stateDim; i++) {
            const u1 = Math.random();
            const u2 = Math.random();
            const rand_std_normal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
            z.push(rand_std_normal);
        }

        const transformed_z = math.multiply(this.choleskyL, z);
        const finalSample = math.add(this.mean, transformed_z);

        const result = finalSample.toArray();
        return Array.isArray(result) ? (result as number[]) : [result as number];
    }
}

/**
 * Calculates the probability density function (PDF) of a normal distribution
 * at a given point.
 */
export function normalPdf(x: number, mean: number, stdDev: number): number {
    if (stdDev <= 0) return 0;
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
    return coefficient * Math.exp(exponent);
}

/**
 * Implements the Causal Savitzky-Golay filter and other causal indicators
 * based on the validated research report. This engine is designed to be
 * free of look-ahead bias and uses robust numerical methods.
 */

import * as math from 'mathjs';

// --- TYPE DEFINITIONS ---
export type CausalDerivative = {
    smoothedValue: number;
    derivative: number;
};

export type CausalBinDetails = {
    binIndex: number;
    numBins: number;
    windowSize: number;
    binWidth: number;
};


// --- CAUSAL SAVITZKY-GOLAY FILTER IMPLEMENTATION ---

/**
* Cache for pre-computed Savitzky-Golay coefficient matrices H = (A^T * A)^-1 * A^T.
* Using mathjs for matrix operations is more robust than a manual implementation.
* The key is a string in the format: `${windowSize}-${polynomialOrder}`
*/
const sgCoeffsCache: Map<string, math.Matrix> = new Map();

/**
* Computes the Savitzky-Golay coefficient matrix H using mathjs.
* This function is based on the derivation in the "Causal Financial Analysis Framework" report.
* The rows of H contain the filter weights for each polynomial coefficient (a0, a1,...).
*
* @param windowSize The number of past data points (w).
* @param polynomialOrder The order of the polynomial to fit (p).
* @returns The (p+1) x w coefficient matrix H as a math.Matrix, or null if not solvable.
*/
function getCausalSgCoeffs(windowSize: number, polynomialOrder: number): math.Matrix | null {
   const cacheKey = `${windowSize}-${polynomialOrder}`;
   if (sgCoeffsCache.has(cacheKey)) {
       return sgCoeffsCache.get(cacheKey)!;
   }

   if (polynomialOrder >= windowSize) {
       console.error("Polynomial order must be less than window size for Savitzky-Golay.");
       return null;
   }

   // Step 1: Create the design matrix A (Vandermonde matrix) for a causal window.
   // The time indices run from -(w-1) to 0, as per the research report's causal formulation.
   const A_data: number[][] = [];
   for (let i = 0; i < windowSize; i++) {
       const timeIndex = -(windowSize - 1) + i;
       const row: number[] = [];
       for (let j = 0; j <= polynomialOrder; j++) {
           row.push(Math.pow(timeIndex, j));
       }
       A_data.push(row);
   }
   const A = math.matrix(A_data);

   try {
       // Step 2: Solve the normal equations to get the coefficient matrix H.
       // H = (A^T * A)^-1 * A^T
       // This is done using lusolve for better numerical stability than direct inversion.
       const AT = math.transpose(A);
       const ATA = math.multiply(AT, A);
       
       // Solve (A^T * A) * X = A^T for X, where X is our desired coefficient matrix H
       const H = math.lusolve(ATA, AT);
       
       sgCoeffsCache.set(cacheKey, H);
       return H as math.Matrix;
   } catch (error) {
       console.error("Error calculating SG coefficients with mathjs:", error);
       return null; // Matrix may be singular or other math error.
   }
}

/**
* Applies a one-sided (causal) Savitzky-Golay filter to the most recent
* segment of a time series to calculate the smoothed value and the first derivative.
* This implementation is based on the validated research report and uses 'mathjs'.
*
* @param data A flat array of numbers representing the time series, ordered from oldest to newest.
* @param windowSize The size of the filter window (w).
* @param polynomialOrder The order of the fitting polynomial (p).
* @param deltaT The sampling interval (time between data points in seconds), defaults to 1.
* @returns An object with the smoothed value and the first derivative for the MOST RECENT point, or null if inputs are invalid.
*/
export function calculateCausalSgDerivative(
   data: number[],
   windowSize: number,
   polynomialOrder: number,
   deltaT: number = 1
): CausalDerivative | null {
   if (data.length < windowSize) {
       // Not enough data points to form a full window.
       return null;
   }

   const H = getCausalSgCoeffs(windowSize, polynomialOrder);
   if (!H) {
       // Coefficients could not be computed for the given parameters.
       return null;
   }

   const windowData = data.slice(-windowSize);
   
   // Extract the coefficient vectors from the H matrix. toArray() converts them to plain arrays.
   const smoothingCoeffs = H.subset(math.index(0, math.range(0, windowSize))).toArray()[0] as number[];
   
   const derivativeCoeffs = polynomialOrder >= 1 
       ? H.subset(math.index(1, math.range(0, windowSize))).toArray()[0] as number[]
       : null;

   // Use math.dot for a safe, type-guaranteed dot product that returns a number.
   const smoothedValue = math.dot(smoothingCoeffs, windowData);
   
   let derivativeTerm = 0;
   if (derivativeCoeffs) {
       derivativeTerm = math.dot(derivativeCoeffs, windowData);
   }

   // The raw derivative is with respect to the time index. Scale by the sampling
   // interval deltaT to get the true derivative with respect to time.
   const derivative = derivativeTerm / deltaT;

   return { smoothedValue, derivative };
}


// --- CAUSAL & DYNAMIC ENTROPY CALCULATION ---

/**
* Calculates the value at a given percentile in a sorted numeric array.
* Uses linear interpolation for positions between indices.
* @param sortedData A pre-sorted array of numbers.
* @param percentile A number between 0 and 100.
* @returns The value at the specified percentile.
*/
function getPercentile(sortedData: number[], percentile: number): number {
   if (sortedData.length === 0 || percentile < 0 || percentile > 100) {
       return NaN;
   }
   if (sortedData.length === 1) {
       return sortedData[0];
   }
   
   const index = (percentile / 100) * (sortedData.length - 1);
   const lowerIndex = Math.floor(index);
   const upperIndex = Math.ceil(index);

   if (lowerIndex === upperIndex) {
       return sortedData[lowerIndex];
   }

   const lowerValue = sortedData[lowerIndex];
   const upperValue = sortedData[upperIndex];
   const weight = index - lowerIndex;

   return lowerValue * (1 - weight) + upperValue * weight;
}

/**
* A comprehensive, causal algorithm for determining the histogram bin assignment
* for a new data point based on a rolling window of historical data. This directly
* implements the "Master Causal Entropy Algorithm" from the research report.
*
* @param latestValue The most recent data point to be binned.
* @param historicalWindow An array of historical data points from the rolling window.
* @returns An object containing the bin index for the latest value, the total number of bins,
*          the window size, and the calculated bin width, or null if calculation is not possible.
*/
export function getCausalBinAssignment(
   latestValue: number,
   historicalWindow: number[],
): CausalBinDetails | null {
   if (historicalWindow.length === 0) {
       return null;
   }

   const windowSize = historicalWindow.length;
   const rollingMin = Math.min(...historicalWindow);
   const rollingMax = Math.max(...historicalWindow);
   const dataRange = rollingMax - rollingMin;

   const sortedWindow = [...historicalWindow].sort((a, b) => a - b);
   const q1 = getPercentile(sortedWindow, 25);
   const q3 = getPercentile(sortedWindow, 75);
   const iqr = q3 - q1;

   let binWidth: number;
   if (iqr > 0) {
       // Freedman-Diaconis rule: h = 2 * IQR / n^(1/3)
       binWidth = (2 * iqr) / Math.pow(windowSize, 1 / 3);
   } else if (dataRange > 0) {
       // Fallback for zero IQR (common in low-volatility): use a fraction of the range,
       // which is more robust than assuming normality with Scott's rule.
       binWidth = dataRange / 10; // Default to 10 bins if range is positive
   } else {
       // All points in the window are identical. Only one bin is needed.
       return { binIndex: 0, numBins: 1, windowSize, binWidth: 1 };
   }
   
   if (binWidth <= 1e-9) { // Handle potential floating point issues
       return { binIndex: 0, numBins: 1, windowSize, binWidth: dataRange || 1 };
   }

   const numBins = Math.max(1, Math.ceil(dataRange / binWidth));
   const clampedValue = Math.max(rollingMin, Math.min(latestValue, rollingMax));
   
   let binIndex = Math.floor((clampedValue - rollingMin) / binWidth);
   if (binIndex >= numBins) {
       binIndex = numBins - 1;
   }

   return { binIndex, numBins, windowSize, binWidth };
}

/**
 * This file contains the logic for automatically selecting the optimal number of
 * states (k) for the Hidden Markov Model, based on the Bayesian Information
 * Criterion (BIC), as specified in the Phase 3 research blueprint.
 */

import { EmergentMindHMM, HMMParameters } from './hmm';

/**
 * Calculates the total number of free parameters in a GM-HMM, which is a
 * required component for calculating the BIC score.
 * @param nStates The number of hidden states (k).
 * @param nMix The number of Gaussian mixture components per state (M).
 * @param dims The dimensionality of the data (D).
 * @returns The total number of free parameters.
 */
function calculateFreeParameters(nStates: number, nMix: number, dims: number): number {
    // Initial state probabilities (pi): k - 1
    const piParams = nStates - 1;
    // Transition matrix (A): k * (k - 1)
    const aParams = nStates * (nStates - 1);
    // Mixture weights (c): k * (M - 1)
    const cParams = nStates * (nMix - 1);
    // Mixture means (mu): k * M * D
    const meanParams = nStates * nMix * dims;
    // Mixture covariances (Sigma): k * M * D * (D + 1) / 2 (for symmetric matrices)
    const covParams = nStates * nMix * (dims * (dims + 1) / 2);

    return piParams + aParams + cParams + meanParams + covParams;
}

/**
 * Calculates the Bayesian Information Criterion (BIC) for a trained HMM.
 * BIC = K * ln(T) - 2 * ln(L)
 * where K is the number of free parameters, T is the number of observations,
 * and L is the maximized log-likelihood.
 * @param model The trained HMM model.
 * @param logLikelihood The log-likelihood of the data given the model.
 * @param nObservations The number of data points (T).
 * @returns The BIC score for the model.
 */
function calculateBIC(model: EmergentMindHMM, logLikelihood: number, nObservations: number): number {
    // @ts-ignore - Accessing private members for calculation
    const nStates = model.nStates;
    // @ts-ignore
    const nMix = model.nMix;
    // @ts-ignore
    const dims = model.dims;

    const K = calculateFreeParameters(nStates, nMix, dims);
    const T = nObservations;

    const bic = K * Math.log(T) - 2 * logLikelihood;
    return bic;
}

/**
 * Orchestrates the model selection process to find the optimal number of states (k).
 * It trains multiple HMMs for a range of k values and selects the one
 * with the best (lowest) BIC score.
 * 
 * @param data The training data.
 * @param k_range An array specifying the range of k values to test, e.g., [2, 3, 4, 5].
 * @returns An object containing the best trained HMM and its BIC score.
 */
export async function findOptimalHMM(
    data: number[][],
    k_range: number[]
): Promise<{ bestModel: EmergentMindHMM; bestK: number; bestBic: number; }> {
    let bestModel: EmergentMindHMM | null = null;
    let bestK = -1;
    let bestBic = Infinity;

    console.log("Starting HMM model selection...");

    for (const k of k_range) {
        console.log(`Training HMM with k=${k}...`);
        const model = new EmergentMindHMM(k, 1); // Using nMix=1 for simplicity first
        
        // The report recommends a multi-start procedure here.
        // For now, we use a single run for simplicity.
        const logLikelihood = model.fit(data);

        if (logLikelihood > -Infinity) {
            const bic = calculateBIC(model, logLikelihood, data.length);
            console.log(`HMM with k=${k} finished. LogLikelihood: ${logLikelihood.toFixed(2)}, BIC: ${bic.toFixed(2)}`);

            if (bic < bestBic) {
                bestBic = bic;
                bestK = k;
                bestModel = model;
            }
        } else {
            console.error(`Training failed for HMM with k=${k}.`);
        }
    }

    if (!bestModel) {
        throw new Error("Failed to train any HMM model successfully.");
    }

    console.log(`Optimal model found with k=${bestK} (BIC: ${bestBic.toFixed(2)})`);
    return { bestModel, bestK, bestBic };
}

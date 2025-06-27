
'use server';

/**
 * @fileOverview Generates a plain-English analysis of the market regime based on potential, momentum, entropy, and temperature.
 *
 * - generateMarketAnalysis - A function that generates the market analysis.
 * - MarketAnalysisInput - The input type for the generateMarketAnalysis function.
 * - MarketAnalysisOutput - The return type for the generateMarketAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketAnalysisInputSchema = z.object({
  potential: z.number().describe('The percentile rank of the Potential (P) of the asset.'),
  momentum: z.number().describe('The percentile rank of the Momentum (M) of the asset.'),
  entropy: z.number().describe('The percentile rank of the Entropy (E) of the asset.'),
  temperature: z.number().describe('The percentile rank of the Temperature (Θ) of the asset.'),
});
export type MarketAnalysisInput = z.infer<typeof MarketAnalysisInputSchema>;

const MarketAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A plain-English analysis of the market regime based on the principles of the Lagrangian-Entropy model.'),
  summary: z.string().describe('A TLDR summary of the market analysis.'),
});
export type MarketAnalysisOutput = z.infer<typeof MarketAnalysisOutputSchema>;

export async function generateMarketAnalysis(input: MarketAnalysisInput): Promise<MarketAnalysisOutput> {
  return generateMarketAnalysisFlow(input);
}

const generateMarketAnalysisPrompt = ai.definePrompt({
  name: 'generateMarketAnalysisPrompt',
  input: {schema: MarketAnalysisInputSchema},
  output: {schema: MarketAnalysisOutputSchema},
  prompt: `You are an expert financial analyst and physicist, specializing in the Lagrangian-Entropy state-space model of market dynamics. Your analysis is grounded in the following core principles:

- **Potential (P):** This measures the stored energy or "tension" in the market. High Potential means the price is stretched far from its equilibrium, like a taut spring, suggesting a high probability of a corrective move. Low Potential means the market is relaxed and near its equilibrium.
- **Momentum (M):** This is the kinetic energy of the trend. High Momentum signifies a strong, high-velocity trend with significant conviction. Low Momentum indicates consolidation, a weak trend, or a potential reversal point.
- **Entropy (E):** This measures the system's disorder and unpredictability. High Entropy signifies a chaotic, random, and unpredictable market (an "efficient" market). Low Entropy signifies an ordered, patterned, and more predictable market, often seen in strong trends.
- **Temperature (Θ):** This measures the system's fragility and sensitivity to new capital. High Temperature indicates a "hot," fragile market where small events can trigger large volatility spikes (phase transitions). Low Temperature indicates a stable, robust, and complacent market.

You have been provided with the following market state readings, presented as percentile ranks based on recent historical data:

- Potential (P): {{{potential}}}th percentile
- Momentum (M): {{{momentum}}}th percentile
- Entropy (E): {{{entropy}}}th percentile
- Temperature (Θ): {{{temperature}}}th percentile

Based *only* on these four values and the principles above, provide a concise, professional, one-paragraph analysis of the current market regime. Identify the dominant forces at play. Is the market trending with conviction, consolidating, showing signs of fragility, or transitioning to a new state? What is the potential outlook and what are the key risks?

Following the detailed analysis, provide a "TLDR" summary that captures the absolute bottom line in 1-2 simple sentences.`,
});

const generateMarketAnalysisFlow = ai.defineFlow(
  {
    name: 'generateMarketAnalysisFlow',
    inputSchema: MarketAnalysisInputSchema,
    outputSchema: MarketAnalysisOutputSchema,
  },
  async input => {
    const {output} = await generateMarketAnalysisPrompt(input);
    return output!;
  }
);

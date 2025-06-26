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
  potential: z.number().describe('The potential energy of the asset.'),
  momentum: z.number().describe('The momentum of the asset.'),
  entropy: z.number().describe('The economic entropy of the asset.'),
  temperature: z.number().describe('The temperature of the asset.'),
});
export type MarketAnalysisInput = z.infer<typeof MarketAnalysisInputSchema>;

const MarketAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A plain-English analysis of the market regime.'),
  summary: z.string().describe('A TLDR summary of the market analysis.'),
});
export type MarketAnalysisOutput = z.infer<typeof MarketAnalysisOutputSchema>;

export async function generateMarketAnalysis(input: MarketAnalysisInput): Promise<MarketAnalysisOutput> {
  return generateMarketAnalysisFlow(input);
}

const identifyPercentileRanges = ai.defineTool({
  name: 'identifyPercentileRanges',
  description: 'Identifies the percentile ranges (low, medium, high) for potential, momentum, entropy, and temperature based on historical data.',
  inputSchema: z.object({
    potential: z.number().describe('The potential energy of the asset.'),
    momentum: z.number().describe('The momentum of the asset.'),
    entropy: z.number().describe('The economic entropy of the asset.'),
    temperature: z.number().describe('The temperature of the asset.'),
  }),
  outputSchema: z.object({
    potentialRange: z.string().describe('The percentile range for potential (low, medium, high).'),
    momentumRange: z.string().describe('The percentile range for momentum (low, medium, high).'),
    entropyRange: z.string().describe('The percentile range for entropy (low, medium, high).'),
    temperatureRange: z.string().describe('The percentile range for temperature (low, medium, high).'),
  }),
},
async (input) => {
    // Mock implementation for percentile ranges.  A real implementation would
    // calculate these based on historical data.
    const getRange = (value: number): string => {
      if (value < 25) return 'low';
      if (value < 75) return 'medium';
      return 'high';
    };

    return {
      potentialRange: getRange(input.potential),
      momentumRange: getRange(input.momentum),
      entropyRange: getRange(input.entropy),
      temperatureRange: getRange(input.temperature),
    };
  }
);

const generateMarketAnalysisPrompt = ai.definePrompt({
  name: 'generateMarketAnalysisPrompt',
  input: {schema: MarketAnalysisInputSchema},
  output: {schema: MarketAnalysisOutputSchema},
  tools: [identifyPercentileRanges],
  prompt: `You are an expert financial analyst.  Based on the provided market data, generate a concise, plain-English analysis of the current market regime.

  Potential: {{{potential}}}
  Momentum: {{{momentum}}}
  Entropy: {{{entropy}}}
  Temperature: {{{temperature}}}

  Consider the percentile ranges of potential, momentum, entropy, and temperature to provide context to the analysis.  Use the identifyPercentileRanges tool to determine these ranges, if necessary.

  Specifically:
  - Explain the current market dynamics.
  - Identify potential risks and opportunities.
  - Summarize the analysis in a TLDR format that is easy to understand.
  `,
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

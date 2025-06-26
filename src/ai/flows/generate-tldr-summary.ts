// src/ai/flows/generate-tldr-summary.ts
'use server';

/**
 * @fileOverview Generates a TLDR (Too Long; Didn't Read) summary of the market analysis.
 *
 * - generateTLDRSummary - A function that generates a concise summary of the market analysis.
 * - GenerateTLDRSummaryInput - The input type for the generateTLDRSummary function.
 * - GenerateTLDRSummaryOutput - The return type for the generateTLDRSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTLDRSummaryInputSchema = z.object({
  marketRegime: z.string().describe('The current market regime.'),
  potential: z.number().describe('The potential energy of the asset.'),
  momentum: z.number().describe('The momentum of the asset.'),
  entropy: z.number().describe('The entropy of the asset.'),
  temperature: z.number().describe('The temperature of the asset.'),
});
export type GenerateTLDRSummaryInput = z.infer<typeof GenerateTLDRSummaryInputSchema>;

const GenerateTLDRSummaryOutputSchema = z.object({
  tldrSummary: z.string().describe('A concise summary of the market analysis.'),
});
export type GenerateTLDRSummaryOutput = z.infer<typeof GenerateTLDRSummaryOutputSchema>;

export async function generateTLDRSummary(input: GenerateTLDRSummaryInput): Promise<GenerateTLDRSummaryOutput> {
  return generateTLDRSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTLDRSummaryPrompt',
  input: {schema: GenerateTLDRSummaryInputSchema},
  output: {schema: GenerateTLDRSummaryOutputSchema},
  prompt: `You are an expert financial analyst. Generate a concise, easy-to-understand TLDR summary of the current market situation based on the following information:

Market Regime: {{{marketRegime}}}
Potential Energy: {{{potential}}}
Momentum: {{{momentum}}}
Entropy: {{{entropy}}}
Temperature: {{{temperature}}}

Focus on providing actionable insights for a general audience. Keep the summary under 50 words.`,
});

const generateTLDRSummaryFlow = ai.defineFlow(
  {
    name: 'generateTLDRSummaryFlow',
    inputSchema: GenerateTLDRSummaryInputSchema,
    outputSchema: GenerateTLDRSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

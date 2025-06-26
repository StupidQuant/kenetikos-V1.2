# **App Name**: kinētikós entropḗ

## Core Features:

- Fetch Crypto Data: Fetch cryptocurrency price and volume data from CoinGecko's public API using the asset ID, start date and end date specified by the user. Default to a bitcoin price time series.
- Estimate Market Parameters: Use Savitzky-Golay filter to estimate real-time potential energy, kinetic energy, economic entropy and temperature of the asset over a period, presenting the values using a dashboard including dials.
- Visualize State-Space Trajectory: Display a 4D state-space trajectory. Plot Potential, Momentum, and Entropy on the x, y, and z axes of a 3D chart, and represent Temperature with a heat map coloring.
- Enable Precise Calculations: Enable users to adjust Savitzky-Golay windows sizes for more precise calculation.
- Generate an analysis: Generate a paragraph of plain-English AI analysis for interpreting each market regime based on the state vector.The system has a tool for identifying the percentile ranges of Potential, Momentum, Entropy, and Temperature, then use them to decide whether to include such info into the analysis.
- Simplify market overview: Generate a TLDR summary that will be simple enough to allow the information to be digestible and for easy user accessibility.
- Categorize market regime: Classify current market dynamics into recognizable market regimes and assign score between 0 and 100 to quantify which regime the market resembles. Regimes include "Fragile topping/reversal risk", "Chaotic indecision", "Stable bull/bear trend", "Coiling Spring (High Tension)", "Low volatility/Orderly"

## Style Guidelines:

- Primary color: Indigo (#6366F1), reflecting technical precision with a touch of creativity, suggesting data analysis and forward-thinking strategies.
- Background color: Dark slate (#0F172A) with subtle radial gradients to enhance depth and focus, minimizing distraction and maximizing data visibility.
- Accent color: Teal (#2DD4BF), provides clear call-to-action notifications without being over bearing.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, and highly readable UI, ensuring clarity and focus on complex data visualizations.
- Code font: 'Source Code Pro' for displaying code snippets.
- Simple, geometric icons (e.g., Remix Icon) to represent dashboard metrics (Potential, Momentum, Entropy, Temperature). Use icons that subtly represent their meaning.
- Implement a modern 'glass panel' effect using backdrop-filter to create visually distinct layers.
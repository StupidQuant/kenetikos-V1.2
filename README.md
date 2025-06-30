# kinētikós entropḗ: A State-Space Analysis of Market Dynamics (v1.0)

## 1. High-Level Overview

`kinētikós entropḗ` is a sophisticated, multi-dimensional financial analysis tool designed to provide a deep, quantitative understanding of market dynamics. It moves beyond traditional technical analysis by modeling financial markets as a physical system, applying principles from Lagrangian mechanics and information theory to create a four-dimensional "state-space" of the market.

This application is **not a simple signal generator**. It is a **regime-detection dashboard** that quantifies the market's state through four unique lenses: Potential, Momentum, Entropy, and Temperature. By visualizing the trajectory of an asset through this 4D state-space, an analyst can gain unparalleled insight into the market's character, its stability, its fragility, and its underlying conviction.

---

## 2. Core Concepts: The Four Dimensions of Market State

The indicator's power comes from its unique, physics-based state vector: **Ψ(t) = ⟨P, M, E, Θ⟩**. Each component is a carefully derived metric representing a fundamental aspect of market dynamics.

### Dimension 1: Potential (P)
- **Concept:** Represents the asset's stored energy due to its position relative to a calculated market equilibrium (`p_eq`). It quantifies the "tension" in the market. A high Potential value does not mean the price is high; it means the price is *far* from its perceived fair value.
- **Why it Matters:** High Potential signals that the market is stretched, like a taut spring. This stored energy is often released in a sharp, corrective move back towards equilibrium. It is a measure of mean-reversion pressure.
- **Calculation:** Derived from the potential energy term of the financial Lagrangian: `V(p) = 0.5 * k * (p - p_eq)² - F*p`, where `k` is the mean-reversion "stiffness" and `F` is a persistent trend force.

### Dimension 2: Momentum (M)
- **Concept:** Represents the kinetic energy of the current price trend. It quantifies the power and conviction of the ongoing move.
- **Why it Matters:** High Momentum indicates a strong, high-velocity trend (either bullish or bearish) that is likely to persist. Low Momentum signals consolidation, a weak trend, or a turning point where price velocity is near zero.
- **Calculation:** Derived from the kinetic energy term of the financial Lagrangian: `T = 0.5 * m * (price_velocity)²`, where `m` is the "market mass" (proxied by volume/price), representing the asset's inertia.

### Dimension 3: Entropy (E)
- **Concept:** Represents the system's disorder, randomness, and unpredictability, as measured by Shannon Entropy. The input to this calculation is not the price itself, but the *distribution* of the price's rate of change (`price_velocity`).
- **Why it Matters:** Entropy provides a direct measure of the market's "predictive climate."
    - **Low Entropy:** A strong, clear trend is an *ordered* state. The price velocity is consistent, leading to a narrow distribution and low entropy. This is a more predictable market.
    - **High Entropy:** A choppy, sideways market is a *disordered* state. The price velocity fluctuates erratically, leading to a wide distribution and high entropy. This is a random, unpredictable market, consistent with the Efficient Market Hypothesis.
- **Calculation:** Calculated using a rolling window over the Savitzky-Golay smoothed `price_velocity`. The continuous velocity data is discretized into bins, and the Shannon Entropy formula `H(X) = -Σ p(i) * log(p(i))` is applied to the resulting probability distribution.

### Dimension 4: Temperature (Θ)
- **Concept:** Represents the system's sensitivity, fragility, or "excitability" to new information or capital flows.
- **Why it Matters:** Temperature is a forward-looking risk metric.
    - **Low Temperature:** A stable, robust, and complacent market that can easily absorb capital flows without a significant change in its character.
    - **High Temperature:** A fragile, "hot" market where even a small injection of capital can cause a large increase in disorder (Entropy). It is a system on the brink of a "phase transition"—a sudden spike in volatility. A rising temperature can be a powerful leading indicator of an impending crash or breakout.
- **Calculation:** Derived from the relationship between Entropy and capital (proxied by volume): `Θ ∝ (dE / dVolume)⁻¹`. This derivative is robustly estimated using a rolling linear regression.

---

## 3. System Architecture & Data Flow

This application is a single-page web application built with a modern tech stack.

- **Frontend:** Next.js, React, TypeScript
- **UI Components:** ShadCN UI
- **Styling:** Tailwind CSS
- **Charting:** Plotly.js (for the 3D chart) and Recharts (for the 2D dials)
- **Generative AI:** Google Gemini via the Genkit framework

The data flows through the system in a clear, sequential pipeline:

1.  **Fetch Data (`page.tsx`):** When a user selects an asset or date range, the application fetches historical price and volume data from the **CoinGecko API**.
2.  **Store Raw Data (`page.tsx`):** The raw, unfiltered data is stored in the `rawMarketData` state variable.
3.  **Calculate State Vector (`lib/indicator.ts`):** Whenever `rawMarketData` or any control parameter changes, the entire dataset is passed to the `calculateStateVector` function. This master function orchestrates the entire physics-based calculation pipeline, calling helper functions to compute derivatives, estimate market parameters, and calculate the final 4D state vector time series.
4.  **Classify & Visualize (`page.tsx` & components):** The results are stored in the `calculatedParams` state variable.
    - A `RegimeClassifier` instance calculates percentile ranks for the latest data point.
    - These percentiles are passed to the `ParameterDial`, `RadarChart`, and `MarketRegimes` components for visualization.
    - The full 4D trajectory is passed to the `StateSpaceChart` component.
5.  **Generate AI Analysis (`ai/flows/generate-market-analysis.ts`):** The percentile ranks for the four dimensions are sent to the AI backend via the Genkit framework. The AI uses these values and a detailed system prompt to generate a professional, narrative interpretation of the market state.

---

## 4. How to Use the Application

1.  **Select Asset & Date Range:** Begin in the **Configuration** panel. Choose a cryptocurrency asset and the historical date range you wish to analyze. The application will fetch this data once.
2.  **Fine-Tune Parameters:** Use the sliders to adjust the parameters of the underlying physics model. These changes re-run the calculations instantly on the already-fetched data, allowing for rapid experimentation.
    -   **SG Window/Poly Order:** Controls the initial price smoothing. Larger windows create smoother, longer-term trend lines, filtering out short-term noise. Think of this as adjusting the **"lens sharpness"** of the model.
    -   **Regression/Equilibrium Window:** Defines the lookback period for calculating the market's "stiffness" (`k`) and "equilibrium price" (`p_eq`). This controls the **"market's memory."** A longer window creates a more stable, long-term sense of fair value.
    -   **Entropy Window/Bins:** Defines the lookback and granularity for measuring market disorder. This tunes the **"disorder meter."**
    -   **Temperature Window:** Defines the lookback for measuring market fragility. This tunes the **"fragility meter."**
3.  **Analyze the Visuals:** Observe the dashboard components to understand the market state at the end of your selected period.
4.  **Generate AI Analysis:** Once you have a parameter set you are interested in, click **"Generate Analysis"** to get a detailed narrative interpretation from the AI expert.

---

## 5. How to Read the Dashboard & Interpret Patterns

Your goal is to identify the market's current **regime** by observing the patterns in the state-space.

### Reading the 4D State-Space Trajectory

This is your primary view. The *shape* and *color* of the trajectory tell a story.

-   **Stable Trend:** Look for a smooth, clean arc moving through a *blue/green* (low Temperature) region. It will have high Momentum (high on the Y-axis) and low Entropy (low on the Z-axis). This is a market with strong, orderly conviction.
-   **Consolidation / "Coiling Spring":** Look for a tight, inward spiral where the trajectory converges on a single point. This indicates energy is leaving the system (`P` and `M` are decreasing), and the market is building cause for its next major move.
-   **Fragile Topping / Bottoming:** This is a critical warning sign. Look for a trajectory that enters a *red/yellow* (high Temperature) region while its Momentum (Y-axis value) begins to decline. The market is becoming fragile and sensitive even as the trend's energy fades. This suggests a high risk of a "phase transition"—a sharp reversal or volatility spike.
-   **Chaotic Indecision:** Look for an erratic, tangled, and unpredictable path that occupies a region of high Entropy (high on the Z-axis) and high Temperature (red/yellow). Predictive models are least likely to work here. This is a time for caution.

---

## 6. Critical Caveat: Look-Ahead Bias in v1.0

It is essential to understand a critical nuance in this version of the application. The current system is a **Historical Analysis Tool**, not a pure real-time predictive engine.

-   **The Issue:** The `RegimeClassifier` calculates percentile ranks (e.g., "Temperature is at the 94th percentile") by comparing the current value against the **entire historical dataset** loaded in the chart.
-   **The Consequence:** This means the analysis for a day in March uses knowledge of the maximum and minimum values that occurred in April, May, and June. This is called **look-ahead bias**.
-   **Why It's Still Useful:** This approach creates the clearest, most stable, and most visually informative charts for understanding the dynamics of *past market events*. It provides a "god-like" view of history. However, it cannot be used for direct, real-time trading signals, as a live system would not have access to future data. Addressing this is a key part of the future roadmap.

---

## 7. Future Roadmap: The Path to a Living Indicator

This v1.0 is a stable foundation. The future development roadmap is focused on transforming the application into a truly adaptive, real-time analytical system.

### Tier 1 (Most Profound): The "Historian vs. Causal" Dual View
-   **Concept:** Implement a second, parallel 4D chart called the "Causal View." This chart would use a calculation engine that is strictly free of look-ahead bias, using a rolling window for all normalizations.
-   **Impact:** This would allow an analyst to compare the "perfect hindsight" view with the "fog of war" view for any point in history, providing an unparalleled tool for developing market intuition and validating strategies.

### Tier 2 (Highly Useful): The "Living Model" - Dynamic Parameter Estimation
-   **Concept:** Instead of using lookback windows to infer parameters like `k` (stiffness) and `F` (force), use advanced statistical filters (e.g., a Particle Filter) to *estimate* their values in real-time.
-   **Impact:** The system would learn and adapt its internal physics model to the market's changing character. The evolution of `k(t)` and `F(t)` would become powerful new indicators themselves.

### Tier 3 (Useful & Accessible): Unsupervised Regime Discovery
-   **Concept:** Replace the current rule-based `RegimeClassifier` with an unsupervised machine learning algorithm (e.g., a Gaussian Mixture Model).
-   **Impact:** The system would autonomously discover the natural market regimes present in the data, free from human bias. This could reveal non-obvious market archetypes and provide a probabilistic, more nuanced classification (e.g., "70% Bull Trend, 30% Fragile Top").

---

## 8. Mathematical & Logic Appendix

The core of the indicator is derived from these foundational concepts:

-   **The Lagrangian (L):** `L = T - V` (Kinetic Energy - Potential Energy)
-   **Kinetic Energy (T):** `T = 0.5 * m * (price_velocity)²`
-   **Potential Energy (V):** `V(p) = 0.5 * k * (p - p_eq)² - F*p`
-   **Shannon Entropy (H):** `H(X) = -Σ p(i) * log(p(i))`
-   **Economic Temperature (Θ):** `Θ ∝ (dE / dVolume)⁻¹`

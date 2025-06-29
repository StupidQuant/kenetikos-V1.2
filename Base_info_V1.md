# Base_info_V1: The `kinētikós entropḗ` Indicator

## 1. High-Level Overview

`kinētikós entropḗ` is a sophisticated, multi-dimensional financial analysis tool designed to provide a deep, quantitative understanding of market dynamics. It moves beyond traditional technical analysis by modeling financial markets as a physical system, applying principles from Lagrangian mechanics and information theory to create a four-dimensional "state-space" of the market.

This tool is not a simple signal generator. It is a **regime-detection dashboard** that quantifies the market's state through four unique lenses: Potential, Momentum, Entropy, and Temperature. By visualizing the trajectory of an asset through this 4D state-space, an analyst can gain unparalleled insight into the market's character, its stability, its fragility, and its underlying conviction.

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

The application is a single-page web application built with Next.js and TypeScript.

**Data Flow:**
1.  **Fetch:** The application fetches raw price and volume data from the **CoinGecko API** when the user selects an asset or date range. This happens in `src/app/page.tsx`.
2.  **Store:** The raw, unfiltered data is stored in the `rawMarketData` state variable within the main page component.
3.  **Calculate:** Whenever `rawMarketData` or any of the indicator's control parameters (e.g., `sgWindow`) change, the entire dataset is passed to the `calculateStateVector` function in `src/lib/indicator.ts`. This function performs the entire physics-based calculation pipeline and returns a full time series of the 4D state vector.
4.  **Classify & Visualize:** The results are stored in the `calculatedParams` state variable. The latest data point is used to derive percentile ranks for the dials and the radar chart. The full trajectory is passed to the `StateSpaceChart` component for rendering. The regime scores are calculated by the `RegimeClassifier` and passed to the `MarketRegimes` component.
5.  **Analyze:** The percentile ranks for the four dimensions are sent to the **Google AI (Gemini) API** via the Genkit framework (`src/ai/flows/generate-market-analysis.ts`) to generate a professional, narrative interpretation.

---

## 4. Code & Logic Breakdown

-   **`src/app/page.tsx`**: The central orchestrator.
    -   Manages all application state (`controlState`, `rawMarketData`, `calculatedParams`).
    -   Contains the two primary `useEffect` hooks that decouple data fetching from calculation for efficiency.
    -   Renders the main layout, arranging all the individual components.
    -   Handles the dynamic import of the `StateSpaceChart` to prevent server-side rendering errors.

-   **`src/lib/indicator.ts`**: The core financial engine. This is the heart of your intellectual property.
    -   `savitzkyGolay`: Smooths the raw price data and calculates the first and second derivatives (`price_velocity`, `price_acceleration`).
    -   `estimateMarketParameters`: Uses a rolling regression to find the best-fit values for `k` (mean-reversion) and `F` (trend force).
    -   `calculateRollingLagrangianEntropy`: The crucial function that takes the `price_velocity` series and calculates its rolling Shannon Entropy.
    -   `calculateTemperature`: Calculates the "economic temperature" by finding the derivative of volume with respect to entropy.
    -   `calculateStateVector`: The master function that orchestrates the entire pipeline, calling the above functions in the correct order to produce the final 4D data series.
    -   `RegimeClassifier`: A class that takes the historical state vector data, calculates percentile ranks for each dimension, and scores the current market state against a set of predefined regime rules.

-   **`src/components/`**: The library of reusable UI components.
    -   `controls.tsx`: The left-hand panel containing all the sliders and inputs for fine-tuning the indicator's parameters.
    -   `state-space-chart.tsx`: The primary visualization. A `react-plotly.js` component that renders the 3D `scatter3d` plot of the state-space trajectory.
    -   `radar-chart.tsx`: A `react-plotly.js` component that renders the `scatterpolar` plot for a quick visual summary of the four dimensions.
    -   `market-regimes.tsx`: Displays the classification scores from the `RegimeClassifier` as a series of labeled progress bars.
    -   `parameter-dial.tsx`: The four gauges at the top of the screen, showing the percentile rank of each dimension.
    -   `analysis.tsx`: The panel that displays the AI-generated market analysis and summary.

-   **`src/ai/flows/`**: The AI integration layer.
    -   `generate-market-analysis.ts`: Contains the master prompt that "teaches" the AI how to be an expert in the Lagrangian-Entropy model. It instructs the AI on the meaning of P, M, E, and Θ and how to interpret their combination.

---

## 5. How to Use the Application

1.  **Asset & Date Range:** Begin by selecting a cryptocurrency asset and the historical date range you wish to analyze from the **Configuration** panel on the left. The application will fetch this data once.
2.  **Fine-Tune Parameters:** Use the sliders to adjust the parameters of the underlying physics model. These changes will re-run the calculations instantly on the already-fetched data, allowing for rapid experimentation.
    -   **SG Window/Poly Order:** Controls the degree of initial price smoothing. Larger windows create smoother, longer-term trend lines.
    -   **Regression/Equilibrium Window:** Defines the lookback for calculating the market's "stiffness" (`k`) and "equilibrium price" (`p_eq`).
    -   **Entropy Window/Bins:** Defines the lookback and granularity for measuring market disorder.
    -   **Temperature Window:** Defines the lookback for measuring market fragility.
3.  **Analyze the Visuals:** Observe the dashboard components to understand the market state.
4.  **Generate AI Analysis:** Once you have a parameter set you are interested in, click the **"Generate Analysis"** button to get a detailed narrative interpretation from the AI expert.

---

## 6. How to Read the Dashboard & Strategy

Your goal is to identify the market's current **regime** by observing the patterns in the state-space.

### Reading the Patterns

-   **4D State-Space Trajectory:** This is your primary view. The *shape* and *color* of the trajectory tell a story.
    -   **Stable Trend:** Look for a smooth, clean arc moving through a *blue/green* (low Temperature) region. It will have high Momentum (high on the Y-axis) and low Entropy (low on the Z-axis). This is a market with strong, orderly conviction.
    -   **Consolidation / "Coiling Spring":** Look for a tight, inward spiral where the trajectory converges on a single point. This indicates energy is leaving the system (`P` and `M` are decreasing), and the market is building cause for its next major move.
    -   **Fragile Topping / Bottoming:** This is a critical warning sign. Look for a trajectory that enters a *red/yellow* (high Temperature) region while its Momentum (Y-axis value) begins to decline. The market is becoming fragile and sensitive even as the trend's energy fades. This suggests a high risk of a "phase transition"—a sharp reversal or volatility spike.
    -   **Chaotic Indecision:** Look for an erratic, tangled, and unpredictable path that occupies a region of high Entropy (high on the Z-axis) and high Temperature (red/yellow). Predictive models are least likely to work here. This is a time for caution.

### Strategic Application

-   **As a Regime Filter:** This is the indicator's most powerful use. Use the state of the indicator to enable or disable other strategies.
    -   **Low Entropy / Low Temperature:** Favorable conditions for trend-following strategies.
    -   **High Entropy / Low Temperature:** Favorable conditions for mean-reversion or range-trading strategies.
    -   **High Temperature:** A universal warning sign. This is an environment to reduce position size, tighten stop-losses, or stay out of the market entirely, as the risk of a sudden, violent move is elevated.
-   **For Advanced Risk Management:** Use the Temperature dimension as a novel, forward-looking measure of portfolio risk. A portfolio with a high average Temperature is fragile and exposed to volatility shocks, even if its historical volatility is low.
-   **For Feature Engineering:** The raw `[P, M, E, Θ]` state vector is an incredibly rich, low-dimensional feature set that can be fed into a downstream machine learning model to generate explicit trading signals.

This application provides a new lens through which to view market dynamics, turning the abstract concepts of physics and information theory into a tangible and actionable analytical edge.

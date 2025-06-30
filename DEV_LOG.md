# Developer's Log & Troubleshooting Guide for `kinētikós entropḗ` v1.0

## 1. Introduction

This document serves as a living log of the significant technical challenges, bugs, and architectural decisions encountered during the development of `kinētikós entropḗ` v1.0. Its purpose is to provide context for the current stable version and to serve as a guide to prevent repeating past mistakes. The stability of this application depends on a few critical, interconnected systems. A failure in one often cascades, leading to what appear to be unrelated bugs. This log is designed to help debug those cascade failures.

---

## 2. Critical Engine Failure & The Cascade Effect (Mid-Project)

### Problem
During development, the application was extremely unstable. The dashboard would often fail to load, charts would remain empty, and the UI would be unresponsive after changing any parameters.

### Symptoms
- The 4D State-Space Trajectory chart would be blank.
- The Parameter Dials, Radar Chart, and Market Regimes panel would show no data.
- The browser console would show errors related to accessing properties of `null` or `undefined` objects, often originating from within the `page.tsx` component when trying to render the dashboard.
- The app felt completely broken and unreliable.

### Root Cause Analysis
The issue was not a UI bug, but a critical failure deep within the core calculation engine in `src/lib/indicator.ts`.

1.  **Flawed `calculateTemperature` Logic:** The original implementation of the `calculateTemperature` function was mathematically unstable. It did not properly handle edge cases where the change in Entropy or Volume was zero or near-zero within a rolling window.
2.  **`Infinity` and `NaN` Propagation:** This flawed logic was producing `Infinity` and `NaN` (Not a Number) values for the Temperature dimension.
3.  **Cascade Failure:** The `RegimeClassifier` would receive this invalid data. Its percentile calculations would then fail or produce more invalid data. The `page.tsx` component, expecting a clean array of `StateVectorDataPoint` objects, would receive an array full of `null` and `Infinity` values. When it tried to access properties like `calculatedParams.potential`, it would error out, causing the entire rendering process to halt.

### The Solution (Now Implemented)
- **Engine Replacement:** The entire `indicator.ts` file was replaced with a robust, production-ready version. The new engine includes safe division, checks for zero-variance in regressions, and gracefully handles edge cases to ensure it *never* returns `NaN` or `Infinity`. It returns `null` during the initial "burn-in" period for a window, which is expected behavior.
- **Resilient UI Logic:** The main page component (`src/app/page.tsx`) was refactored to be resilient to bad data. It now explicitly filters the results from the calculation engine to ensure it only works with a clean set of valid data points. If the engine returns no valid data (e.g., due to a very small date range), the UI now displays an informative message to the user instead of crashing.

### Key Lesson
The calculation engine is the heart of the system. A single instability there will poison the entire data pipeline and manifest as a total application failure. The UI must always be written defensively, never assuming the data it receives from the engine is perfect.

---

## 3. The Styling Dependency Chain (A Recurring Issue)

### Problem
Throughout the development process, the UI repeatedly regressed to a "fuzzy," "outdated," or visually broken state. Fonts would be incorrect, colors would be wrong, and component styling (like the dials) would have visual artifacts like "bleeding" colors.

### Root Cause Analysis
These were not isolated CSS bugs. They were symptoms of a broken **styling dependency chain**. The modern aesthetic of this app depends on four distinct parts working in perfect harmony:

1.  **Font Loading (`src/app/layout.tsx`):** The Next.js Font loader must import the correct Google Fonts (`Inter`, `Source_Code_Pro`, `Space_Grotesk`) and assign them to CSS variables (`--font-body`, `--font-headline`, etc.).
2.  **CSS Theme Variables (`src/app/globals.css`):** This file defines the entire application color palette using HSL CSS variables (e.g., `--primary: 239 85% 66%;`). This is the single source of truth for all colors.
3.  **Tailwind Configuration (`tailwind.config.ts`):** This file is the critical bridge. It tells Tailwind CSS to use the CSS variables from `globals.css` to generate its utility classes. For example, it maps `bg-primary` to `hsl(var(--primary))`. It also registers the custom font families like `font-headline`.
4.  **Component-Level Classes (`*.tsx`):** The React components must use the correct Tailwind utility classes (e.g., `font-headline`, `bg-primary`, `text-accent`).

A rollback or an isolated change can easily break one link in this chain, causing a systemic failure. For example, if `tailwind.config.ts` is reverted, the `font-headline` class might cease to exist, even if the font is still loaded in `layout.tsx`. If `globals.css` is reverted, `bg-primary` might default to a standard blue instead of our custom Indigo.

### Key Lesson
When debugging a UI issue, **always validate the entire dependency chain.** Do not make one-off style changes in a component. Instead, ensure the desired style is defined as a variable in `globals.css` and correctly referenced in `tailwind.config.ts`. This ensures consistency and prevents these hard-to-trace regressions.

---

## 4. The Look-Ahead Bias Nuance (An Intellectual 'Bug')

### Issue
The V1.0 `RegimeClassifier` calculates percentile ranks by comparing a data point against the **entire historical dataset** provided.

### Why It's a Problem for V2, But Not V1
This creates a **look-ahead bias**. The analysis for a day in March is being influenced by data from April and May. This is unacceptable for a real-time predictive system.

However, for a *historical analysis tool* (which V1.0 is), this method is intentional. It provides a "perfect hindsight" view, creating the clearest and most stable charts for understanding the dynamics of past market events.

### The Path Forward (Future Development)
This must be addressed before the system can be used for live backtesting or trading. The proposed solution is to create a dual-chart system:
1.  **The Historian View (Current):** Keeps the existing logic for clean historical analysis.
2.  **The Causal View (Future):** A new, parallel chart that uses a *rolling window* for all normalization and percentile calculations, ensuring it is strictly free of look-ahead bias.

This distinction is the most important architectural consideration for the future development of the project.


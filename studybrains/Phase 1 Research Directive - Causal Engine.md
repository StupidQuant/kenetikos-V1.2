# Technical Research Directive: Phase 1 - Causal Signal Processing Engine

**Objective:** To generate a comprehensive technical report providing the complete mathematical foundations and production-ready TypeScript/JavaScript implementations required to fix the look-ahead bias in the `kinētikós entropḗ` v1.0 engine. The successful fulfillment of this directive will yield a strictly causal signal processing pipeline, forming the non-negotiable foundation for all future development.

**Context:** The existing v1.0 engine has been found to be critically flawed with look-ahead bias in two core components, as identified in the `DEV_LOG.md` and critique documents. This directive is to procure the exact solutions to these specific problems.

---

### **Part 1: The Causal Savitzky-Golay Differentiator**

**Background:** The current `savitzkyGolay` function uses a symmetric window (`t-n` to `t+n`), which incorporates future data to calculate the state at time `t`. This is unacceptable.

**Requirement:** A technical report detailing the theory and implementation of a **one-sided, backward-looking Savitzky-Golay filter**.

**Deliverables:**

1.  **Mathematical Specification:**
    *   Provide the complete mathematical derivation for the one-sided Savitzky-Golay filter coefficients.
    *   The formulas must show how to compute a smoothed value and its first derivative at the most recent time point `t`, using only a window of past and present data `[t-n, ..., t]`.
    *   Include the matrix algebra (`(X^T X)^-1 X^T y`) used to derive these coefficients for a general polynomial order.

2.  **Production-Ready Implementation:**
    *   Deliver a dependency-free TypeScript function with the signature:
        ```typescript
        savitzkyGolayCausal(
            data: number[],
            windowSize: number,
            polynomialOrder: number
        ): { smoothedValue: number; derivative: number };
        ```
    *   This function must take an array of the most recent numbers and return the smoothed value and derivative for **only the most recent point**.
    *   The implementation must be performant, avoiding re-computation of coefficients where possible.

3.  **Comparative Analysis:**
    *   Provide a concise critique comparing the causal Savitzky-Golay filter to two simpler methods for derivative estimation:
        1.  The first-difference of an Exponential Moving Average (EMA).
        2.  The slope of a simple linear regression over the window.
    *   The analysis must focus on **phase lag**, **noise suppression**, and **frequency response**. Justify why the Savitzky-Golay approach is superior for preserving the underlying features of financial time series.

---

### **Part 2: Causal and Adaptive Histogram Binning for Entropy**

**Background:** The current `calculateRollingLagrangianEntropy` function uses a `globalMin` and `globalMax` calculated from the entire dataset to define its histogram bins. This is a severe form of look-ahead bias. The use of a fixed number of bins is also statistically naive.

**Requirement:** A report on a robust, causal, and adaptive method for discretizing a rolling window of data for entropy calculation.

**Deliverables:**

1.  **Problem Formulation:**
    *   Formally explain *why* using a global min/max for binning introduces look-ahead bias and invalidates the entropy metric for both backtesting and real-time use.

2.  **Causal Normalization Scheme:**
    *   Provide the implementation details for a **rolling-window min/max normalization**. The method must be computationally efficient for a sliding window (i.e., an O(1) or O(log N) update is preferred over an O(N) full-window scan at each time step). A double-ended queue (deque) is a common data structure for this task.

3.  **Adaptive Binning Rule:**
    *   Provide an in-depth analysis of the **Freedman-Diaconis rule** for determining the optimal number of histogram bins.
    *   The report must include the mathematical formula: `Bin Width = 2 * (IQR / n^(1/3))`.
    *   It must justify why this rule is theoretically superior to alternatives like Sturges' or Scott's rule for the typically non-Gaussian, fat-tailed distributions found in financial data, focusing on its use of the robust Interquartile Range (IQR) statistic.
    *   Deliver a well-documented TypeScript function that computes the optimal bin count for a given data window:
        ```typescript
        freedmanDiaconisBins(dataWindow: number[]): number;
        ```

This directive outlines the complete set of requirements for Phase 1. The successful completion of this research will provide the exact, vetted components needed to build a causally sound v1.1 engine.

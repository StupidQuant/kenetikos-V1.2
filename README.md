# kinētikós entropḗ v2.0: A Live Econophysics Engine

## Overview

**kinētikós entropḗ** is a professional-grade financial market analysis framework that models asset dynamics through the lens of first-principles physics. Unlike traditional technical indicators or black-box machine learning models, this tool derives a transparent, four-dimensional state-space vector at each time step, representing the market's internal mechanics:

1.  **Potential (P):** The stored "value" or mean-reverting tension in the system.
2.  **Momentum (M):** The kinetic energy of the price trend.
3.  **Total Energy (E):** The sum of Potential and Momentum.
4.  **Temperature (Θ):** The "fragility" or disorder of the system, derived from thermodynamic principles.

This repository marks the evolution from the v1.0 prototype to the **v2.0 "Living Causal Engine"**, representing a complete architectural overhaul to ensure academic rigor, methodological honesty, and practical usability for real-time analysis and backtesting.

---

## The Evolution: From Flawed Prototype to Rigorous Engine

The v1.0 engine, while conceptually innovative, was fundamentally flawed in ways that made it unsuitable for serious analysis. Its outputs, though visually compelling, were an illusion created by incorrect assumptions. The v2.0 architecture was built specifically to solve these critical issues.

### Problem 1: The Illusion of Hindsight (Look-Ahead Bias)

A rigorous internal critique revealed that the v1.0 engine was contaminated with **look-ahead bias**, the cardinal sin of quantitative analysis. This meant the model at time `t` was using information from the future (`t+1`, `t+2`, etc.), making its historical analysis invalid and its real-time use impossible.

*   **Non-Causal Derivatives:** The v1.0 engine used a standard, symmetric Savitzky-Golay filter to calculate price velocity and acceleration. This filter uses an equal number of past and future data points, tainting the analysis with future knowledge.
*   **Non-Causal Entropy:** The v1.0 entropy calculation used the *global* minimum and maximum of the entire time series to define its histogram bins. This provided the calculation at `t` with knowledge of the full future range of the data.

### **Solution: Phase 1 - The Causal Engine**

The v2.0 engine was re-architected from the ground up to be **strictly causal**. Every calculation at time `t` now uses *only* information available up to and including time `t`.

*   **Causal Savitzky-Golay Filter:** We have implemented a **one-sided, asymmetric Savitzky-Golay filter** based on the foundational academic literature. This filter uses only past data to provide a mathematically robust and causal estimate of instantaneous price derivatives.
*   **Causal & Dynamic Entropy:** The entropy calculation has been rebuilt. It now uses a **rolling-window normalization** to define its boundaries and determines the optimal number of bins at each time step using the **Freedman-Diaconis rule**, a statistically robust method designed for non-normal, outlier-prone financial data.

### Problem 2: The Static Model (Unstable Parameters)

The core physics parameters of the model—`k(t)` (stiffness) and `F(t)` (force)—were estimated using a rolling Ordinary Least Squares (OLS) regression. This method proved to be statistically unstable on noisy financial data, leading to erratic and unreliable parameter estimates.

### **Solution: Phase 2 - The Living Model**

The v2.0 engine replaces the fragile OLS regression with a sophisticated, adaptive filtering technique to bring the model to life.

*   **Particle Filter for Online Parameter Estimation:** We have implemented a **Sequential Importance Resampling (SIR) Particle Filter** to estimate `k(t)` and `F(t)` dynamically. This treats the parameters as hidden state variables and updates their estimated values at every time step based on new market data.
*   **Log-Normal Constraint for `k(t)`:** To enforce the physical constraint that stiffness (`k`) must be non-negative, the particle filter estimates `log(k)`. This elegant solution ensures `k` is always positive without introducing algorithmic biases, making the model more stable and realistic.

---

## Current State & Project Roadmap

The project has successfully completed its first two major architectural phases, resulting in a robust, causal, and adaptive analytical engine.

-   [x] **Phase 1: The Causal Engine** - Complete.
-   [x] **Phase 2: The Living Model** - Complete.
-   [ ] **Phase 3: The Emergent Mind** - In Progress. The next step is to replace the heuristic regime classifier with a data-driven, unsupervised learning model (such as a Gaussian Mixture Model or Hidden Markov Model) that can autonomously discover and probabilistically classify market regimes from the engine's 4D state-space output.

## Core Technologies

*   **Language:** TypeScript
*   **Framework:** Next.js
*   **Core Logic:** Hand-crafted statistical and filtering algorithms based on academic research.
*   **Numerical Operations:** `mathjs` for robust matrix and numerical calculations.

This project is a testament to a first-principles approach, prioritizing methodological rigor over black-box solutions to create a truly transparent and powerful analytical tool.

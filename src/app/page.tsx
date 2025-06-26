'use client';

import * as React from 'react';
import { addDays, format } from 'date-fns';
import { generateMarketAnalysis } from '@/ai/flows/generate-market-analysis';
import { useToast } from '@/hooks/use-toast';

import { Header } from '@/components/header';
import { Controls, type ControlState } from '@/components/controls';
import { ParameterDial } from '@/components/parameter-dial';
import { StateSpaceChart } from '@/components/state-space-chart';
import { MarketRegimes } from '@/components/market-regimes';
import { Analysis } from '@/components/analysis';

import { TrendingUp, Gauge, Shuffle, Thermometer } from 'lucide-react';

export type MarketDataPoint = {
  timestamp: number;
  price: number;
  volume: number;
};

export type CalculatedParameters = {
  potential: number;
  momentum: number;
  entropy: number;
  temperature: number;
  regimeScores: Record<string, number>;
  trajectory: [number, number, number, number][];
};

export type AnalysisResult = {
  analysis: string;
  summary: string;
};

export default function KinetikosEntropePage() {
  const { toast } = useToast();
  // Initialize with a state that's consistent between server and client
  const [controlState, setControlState] = React.useState<ControlState>({
    asset: 'bitcoin',
    dateRange: {}, // Start with empty date range to prevent hydration mismatch
    sgWindow: 15,
    sgPolyOrder: 3,
  });
  const [marketData, setMarketData] = React.useState<MarketDataPoint[]>([]);
  const [calculatedParams, setCalculatedParams] = React.useState<CalculatedParameters | null>(null);
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  // This effect runs once on the client after the component mounts.
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchDataAndCalculate = React.useCallback(async (state: ControlState) => {
    // Ensure we have a valid date range before proceeding
    if (!state.dateRange.from || !state.dateRange.to) {
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const { from, to } = state.dateRange;
      
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/${state.asset}/market_chart/range?vs_currency=usd&from=${from.getTime() / 1000}&to=${to.getTime() / 1000}`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      const rawData = await response.json();
      const fetchedData: MarketDataPoint[] = rawData.prices.map((p: [number, number], i: number) => ({
        timestamp: p[0],
        price: p[1],
        volume: rawData.total_volumes[i][1],
      }));
      setMarketData(fetchedData);

      // Mock calculations are now safe as they only run on the client.
      const mockParams: CalculatedParameters = {
        potential: Math.random() * 100,
        momentum: Math.random() * 100,
        entropy: Math.random() * 100,
        temperature: Math.random() * 100,
        regimeScores: {
          'Fragile topping/reversal risk': Math.random() * 100,
          'Chaotic indecision': Math.random() * 100,
          'Stable bull/bear trend': Math.random() * 100,
          'Coiling Spring (High Tension)': Math.random() * 100,
          'Low volatility/Orderly': Math.random() * 100,
        },
        trajectory: Array.from({ length: 100 }, () => [
          Math.random() * 100,
          Math.random() * 100,
          Math.random() * 100,
          Math.random(),
        ]),
      };
      setCalculatedParams(mockParams);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch or process market data. Please try again.',
      });
      setCalculatedParams(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  // This effect sets the initial state on the client side to avoid hydration mismatch.
  React.useEffect(() => {
    if (isMounted) {
      setControlState(prevState => ({
        ...prevState,
        dateRange: {
          from: addDays(new Date(), -30),
          to: new Date(),
        },
      }));
    }
  }, [isMounted]);

  // This effect fetches data when controlState changes, but only after the client has mounted.
  React.useEffect(() => {
    if (isMounted) {
      fetchDataAndCalculate(controlState);
    }
  }, [isMounted, controlState, fetchDataAndCalculate]);

  const handleGenerateAnalysis = React.useCallback(async () => {
    if (!calculatedParams) return;
    setIsAnalysisLoading(true);
    try {
      const result = await generateMarketAnalysis({
        potential: calculatedParams.potential,
        momentum: calculatedParams.momentum,
        entropy: calculatedParams.entropy,
        temperature: calculatedParams.temperature,
      });
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'Could not generate AI market analysis.',
      });
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [calculatedParams, toast]);

  const parameterDials = [
    { name: 'Potential', value: calculatedParams?.potential, icon: TrendingUp, color: 'hsl(var(--primary))' },
    { name: 'Momentum', value: calculatedParams?.momentum, icon: Gauge, color: 'hsl(var(--accent))' },
    { name: 'Entropy', value: calculatedParams?.entropy, icon: Shuffle, color: 'hsl(280, 80%, 60%)' },
    { name: 'Temperature', value: calculatedParams?.temperature, icon: Thermometer, color: 'hsl(30, 90%, 60%)' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground isolate">
      <div className="fixed inset-0 -z-10 h-full w-full bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:16px_16px]" />
      
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-3">
            <Controls
              state={controlState}
              onStateChange={setControlState}
              isLoading={isLoading}
            />
          </aside>
          
          <main className="col-span-12 md:col-span-9 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {parameterDials.map(p => (
                <ParameterDial
                  key={p.name}
                  name={p.name}
                  value={p.value ?? 0}
                  icon={p.icon}
                  color={p.color}
                  isLoading={isLoading}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-glass rounded-xl p-4 min-h-[400px]">
                <StateSpaceChart trajectory={calculatedParams?.trajectory} isLoading={isLoading} />
              </div>
              <div className="xl:col-span-1">
                <Analysis
                  result={analysisResult}
                  isLoading={isAnalysisLoading}
                  onGenerate={handleGenerateAnalysis}
                  isGenerateDisabled={isLoading || !calculatedParams}
                />
              </div>
            </div>

            <div>
              <MarketRegimes scores={calculatedParams?.regimeScores} isLoading={isLoading} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

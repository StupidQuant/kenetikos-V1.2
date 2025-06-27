'use client';

import * as React from 'react';
import { addDays } from 'date-fns';
import { generateMarketAnalysis } from '@/ai/flows/generate-market-analysis';
import { useToast } from '@/hooks/use-toast';

import { 
  calculateStateVector, 
  RegimeClassifier,
  type StateVectorDataPoint,
  type IndicatorOptions,
} from '@/lib/indicator';

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
  
  const [controlState, setControlState] = React.useState<ControlState>({
    asset: 'bitcoin',
    dateRange: {},
    sgWindow: 31,
    sgPolyOrder: 2,
    regressionWindow: 50,
    equilibriumWindow: 50,
    entropyWindow: 50,
    numBins: 10,
    temperatureWindow: 50,
  });

  // State for the raw, fetched data
  const [rawMarketData, setRawMarketData] = React.useState<MarketDataPoint[]>([]);
  const [calculatedParams, setCalculatedParams] = React.useState<CalculatedParameters | null>(null);
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    // Set initial date range on client-side to avoid hydration mismatch
    setControlState(prevState => ({
      ...prevState,
      dateRange: {
        from: addDays(new Date(), -90),
        to: new Date(),
      },
    }));
  }, []);

  // --- 1. Effect for FETCHING data ---
  // This runs ONLY when the asset or date range changes.
  React.useEffect(() => {
    if (!isMounted || !controlState.dateRange.from || !controlState.dateRange.to) {
      return;
    }

    const fetchMarketData = async () => {
      setIsLoadingData(true);
      setCalculatedParams(null); // Clear old results
      try {
        const { from, to } = controlState.dateRange;
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${controlState.asset}/market_chart/range?vs_currency=usd&from=${from.getTime() / 1000}&to=${to.getTime() / 1000}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch market data from CoinGecko: ${response.statusText}`);
        }
        const rawData = await response.json();
        if (!rawData.prices || rawData.prices.length === 0) {
          throw new Error("API returned no price data for the selected range.");
        }
        const fetchedData: MarketDataPoint[] = rawData.prices.map((p: [number, number], i: number) => ({
          timestamp: p[0],
          price: p[1],
          volume: rawData.total_volumes[i]?.[1] ?? 0,
        }));
        setRawMarketData(fetchedData);
      } catch (error: any) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Data Fetching Error',
          description: error.message || 'Failed to fetch market data.',
        });
        setRawMarketData([]); // Clear data on error
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMarketData();
  }, [isMounted, controlState.asset, controlState.dateRange, toast]);

  // --- 2. Effect for CALCULATING the indicator ---
  // This runs whenever the raw data changes OR any indicator parameter changes.
  React.useEffect(() => {
    if (rawMarketData.length === 0) {
      setCalculatedParams(null);
      return;
    }

    const runCalculations = () => {
      setIsCalculating(true);
      setAnalysisResult(null);
      try {
        const indicatorOptions: IndicatorOptions = {
          sgWindow: controlState.sgWindow,
          sgPolyOrder: controlState.sgPolyOrder,
          regressionWindow: controlState.regressionWindow,
          equilibriumWindow: controlState.equilibriumWindow,
          entropyWindow: controlState.entropyWindow,
          numBins: controlState.numBins,
          temperatureWindow: controlState.temperatureWindow
        };
        
        const stateVectorData = calculateStateVector(rawMarketData, indicatorOptions);
        
        const validData = stateVectorData.filter(d => 
          d.potential !== null && isFinite(d.potential) &&
          d.momentum !== null && isFinite(d.momentum) &&
          d.entropy !== null && isFinite(d.entropy) &&
          d.temperature !== null && isFinite(d.temperature)
        );

        if (validData.length === 0) {
          throw new Error("Calculation resulted in no valid data points. Try adjusting parameters or date range.");
        }
        
        const classifier = new RegimeClassifier(validData);
        const latestState = validData[validData.length - 1];
        const regimeScores = classifier.classify(latestState);
        
        const realParams: CalculatedParameters = {
          potential: classifier.getPercentileRank(latestState.potential, 'potential'),
          momentum: classifier.getPercentileRank(latestState.momentum, 'momentum'),
          entropy: classifier.getPercentileRank(latestState.entropy, 'entropy'),
          temperature: classifier.getPercentileRank(latestState.temperature, 'temperature'),
          regimeScores: regimeScores,
          trajectory: validData.map(d => [d.potential!, d.momentum!, d.entropy!, d.temperature!]),
        };

        setCalculatedParams(realParams);

      } catch (error: any) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Calculation Error',
          description: error.message || 'Failed to process data.',
        });
        setCalculatedParams(null);
      } finally {
        setIsCalculating(false);
      }
    };
    
    // Use a timeout to debounce calculations while sliders are being moved
    const debounceTimeout = setTimeout(runCalculations, 50);
    return () => clearTimeout(debounceTimeout);

  }, [rawMarketData, controlState.sgWindow, controlState.sgPolyOrder, controlState.regressionWindow, controlState.equilibriumWindow, controlState.entropyWindow, controlState.numBins, controlState.temperatureWindow, toast]);

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
  
  const isLoading = isLoadingData || isCalculating;

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
              isLoading={isLoadingData} // Only lock controls during data fetch
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

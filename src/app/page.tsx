
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { addDays } from 'date-fns';
import { generateMarketAnalysis } from '@/ai/flows/generate-market-analysis';
import { useToast } from '@/hooks/use-toast';

import { 
  calculateStateVector, 
  RegimeClassifier,
  type IndicatorOptions,
  type StateVectorDataPoint
} from '@/lib/indicator';

import { Header } from '@/components/header';
import { Controls, type ControlState } from '@/components/controls';
import { ParameterDial } from '@/components/parameter-dial';
import { MarketRegimes } from '@/components/market-regimes';
import { Analysis } from '@/components/analysis';
import { Skeleton } from '@/components/ui/skeleton';
import { RadarChart } from '@/components/radar-chart';
import { Card } from '@/components/ui/card';

import { TrendingUp, Gauge, Shuffle, Thermometer } from 'lucide-react';

const StateSpaceChart = dynamic(() =>
  import('@/components/state-space-chart').then(mod => mod.StateSpaceChart),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col">
        <div className="px-2">
            <p className="text-lg font-semibold">4D State-Space Trajectory</p>
            <p className="text-sm text-muted-foreground">Potential (x), Momentum (y), Entropy (z), Temperature (color)</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }
);

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
  trajectory: StateVectorDataPoint[];
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

  const [rawMarketData, setRawMarketData] = React.useState<MarketDataPoint[]>([]);
  const [calculatedParams, setCalculatedParams] = React.useState<CalculatedParameters | null>(null);
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);

  React.useEffect(() => {
    setControlState(prevState => ({
      ...prevState,
      dateRange: {
        from: addDays(new Date(), -90),
        to: new Date(),
      },
    }));
  }, []);

  React.useEffect(() => {
    if (!controlState.dateRange.from || !controlState.dateRange.to) {
      return;
    }

    const fetchMarketData = async () => {
      setIsLoadingData(true);
      setCalculatedParams(null);
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
        setRawMarketData([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMarketData();
  }, [controlState.asset, controlState.dateRange, toast]);

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
          toast({
            variant: 'destructive',
            title: 'Calculation Error',
            description: "No valid data was produced. Try adjusting parameters or using a larger date range.",
          });
          setCalculatedParams(null);
          return;
        }
        
        const classifier = new RegimeClassifier(validData);
        const latestState = validData[validData.length - 1];
        const regimeScores = classifier.classify(latestState);
        
        const realParams: CalculatedParameters = {
          potential: classifier.getPercentileRank('potential', latestState.potential),
          momentum: classifier.getPercentileRank('momentum', latestState.momentum),
          entropy: classifier.getPercentileRank('entropy', latestState.entropy),
          temperature: classifier.getPercentileRank('temperature', latestState.temperature),
          regimeScores: regimeScores,
          trajectory: validData,
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
    { name: 'Potential', value: calculatedParams?.potential, icon: TrendingUp, color: 'hsl(var(--chart-1))' },
    { name: 'Momentum', value: calculatedParams?.momentum, icon: Gauge, color: 'hsl(var(--chart-2))' },
    { name: 'Entropy', value: calculatedParams?.entropy, icon: Shuffle, color: 'hsl(var(--chart-4))' },
    { name: 'Temperature', value: calculatedParams?.temperature, icon: Thermometer, color: 'hsl(var(--chart-3))' },
  ];
  
  const radarScores = calculatedParams ? {
      potential: calculatedParams.potential,
      momentum: calculatedParams.momentum,
      entropy: calculatedParams.entropy,
      temperature: calculatedParams.temperature,
  } : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-3">
            <Controls
              state={controlState}
              onStateChange={setControlState}
              isLoading={isLoadingData}
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
              
              <Card className="xl:col-span-2 p-4 min-h-[400px]">
                <StateSpaceChart trajectory={calculatedParams?.trajectory} isLoading={isLoading} />
              </Card>

              <div className="xl:col-span-1 flex flex-col gap-6">
                <Card className="p-4">
                  <RadarChart scores={radarScores} isLoading={isLoading} />
                </Card>
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

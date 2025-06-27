'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndicatorOptions } from '@/lib/indicator';

export interface ControlState extends IndicatorOptions {
  asset: string;
  dateRange: DateRange;
}

interface ControlsProps {
  state: ControlState;
  onStateChange: (newState: ControlState) => void;
  isLoading: boolean;
}

const assets = [
  { id: 'bitcoin', name: 'Bitcoin' },
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'solana', name: 'Solana' },
  { id: 'dogecoin', name: 'Dogecoin' },
];

export function Controls({ state, onStateChange, isLoading }: ControlsProps) {
  const handleValueChange = <K extends keyof ControlState>(key: K, value: ControlState[K]) => {
    onStateChange({ ...state, [key]: value });
  };

  const handleSliderChange = (key: keyof ControlState, value: number[]) => {
    onStateChange({ ...state, [key]: value[0] });
  }

  return (
    <Card className="bg-glass sticky top-4">
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="asset">Asset</Label>
          <Select
            value={state.asset}
            onValueChange={(value) => handleValueChange('asset', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="asset">
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-range">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-range"
                variant={'outline'}
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !state.dateRange && 'text-muted-foreground'
                )}
                disabled={isLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {state.dateRange?.from ? (
                  state.dateRange.to ? (
                    <>
                      {format(state.dateRange.from, 'LLL dd, y')} - {format(state.dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(state.dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={state.dateRange?.from}
                selected={state.dateRange}
                onSelect={(range) => handleValueChange('dateRange', range ?? {})}
                numberOfMonths={2}
                disabled={isLoading}
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2">
            <h3 className="text-sm font-medium">Indicator Parameters</h3>
            <div className="space-y-4 pt-2">
                <ParameterSlider label="SG Window" value={state.sgWindow} onValueChange={(val) => handleSliderChange('sgWindow', val)} min={5} max={151} step={2} disabled={isLoading} />
                <ParameterSlider label="SG Poly Order" value={state.sgPolyOrder} onValueChange={(val) => handleSliderChange('sgPolyOrder', val)} min={2} max={6} step={1} disabled={isLoading} />
                <ParameterSlider label="Regression Window" value={state.regressionWindow} onValueChange={(val) => handleSliderChange('regressionWindow', val)} min={10} max={200} step={5} disabled={isLoading} />
                <ParameterSlider label="Equilibrium Window" value={state.equilibriumWindow} onValueChange={(val) => handleSliderChange('equilibriumWindow', val)} min={10} max={200} step={5} disabled={isLoading} />
                <ParameterSlider label="Entropy Window" value={state.entropyWindow} onValueChange={(val) => handleSliderChange('entropyWindow', val)} min={10} max={200} step={5} disabled={isLoading} />
                <ParameterSlider label="Entropy Bins" value={state.numBins} onValueChange={(val) => handleSliderChange('numBins', val)} min={5} max={50} step={1} disabled={isLoading} />
                <ParameterSlider label="Temperature Window" value={state.temperatureWindow} onValueChange={(val) => handleSliderChange('temperatureWindow', val)} min={10} max={200} step={5} disabled={isLoading} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ParameterSliderProps {
    label: string;
    value: number;
    onValueChange: (value: number[]) => void;
    min: number;
    max: number;
    step: number;
    disabled: boolean;
}

function ParameterSlider({ label, value, onValueChange, min, max, step, disabled}: ParameterSliderProps) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between">
                <Label>{label}</Label>
                <span className="text-sm text-muted-foreground">{value}</span>
            </div>
            <Slider
                min={min}
                max={max}
                step={step}
                value={[value]}
                onValueChange={onValueChange}
                disabled={disabled}
            />
        </div>
    )
}

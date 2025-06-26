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

export interface ControlState {
  asset: string;
  dateRange: DateRange;
  sgWindow: number;
  sgPolyOrder: number;
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
            <h3 className="text-sm font-medium">Savitzky-Golay Filter</h3>
            <div className="space-y-4 pt-2">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label htmlFor="sg-window">Window Size</Label>
                        <span className="text-sm text-muted-foreground">{state.sgWindow}</span>
                    </div>
                    <Slider
                        id="sg-window"
                        min={5}
                        max={51}
                        step={2}
                        value={[state.sgWindow]}
                        onValueChange={([value]) => handleValueChange('sgWindow', value)}
                        disabled={isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label htmlFor="sg-poly-order">Polynomial Order</Label>
                        <span className="text-sm text-muted-foreground">{state.sgPolyOrder}</span>
                    </div>
                    <Slider
                        id="sg-poly-order"
                        min={2}
                        max={6}
                        step={1}
                        value={[state.sgPolyOrder]}
                        onValueChange={([value]) => handleValueChange('sgPolyOrder', value)}
                        disabled={isLoading}
                    />
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

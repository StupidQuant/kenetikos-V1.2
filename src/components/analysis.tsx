'use client';

import * as React from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalysisResult } from '@/app/page';

interface AnalysisProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  isGenerateDisabled: boolean;
  onGenerate: () => void;
}

export function Analysis({ result, isLoading, isGenerateDisabled, onGenerate }: AnalysisProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>AI Market Analysis</CardTitle>
        <CardDescription>Generative analysis of the current market regime.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-primary mb-2">TLDR Summary</h4>
              <p className="text-sm text-muted-foreground font-code">{result.summary}</p>
            </div>
            <div>
              <h4 className="font-semibold text-accent mb-2">Detailed Analysis</h4>
              <p className="text-sm text-muted-foreground">{result.analysis}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-10">
            <p>Click the button below to generate an AI analysis based on the current parameters.</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onGenerate} disabled={isGenerateDisabled || isLoading} className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Analysis
        </Button>
      </CardFooter>
    </Card>
  );
}

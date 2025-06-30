import * as React from 'react';
import { cn } from '@/lib/utils';

export function Header() {
  return (
    <header className="container mx-auto px-4 pt-12 pb-8 text-center">
      <h1 className={cn(
        "font-headline text-5xl md:text-6xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-primary mb-2"
      )}>
        kinētikós entropḗ
      </h1>
      <p className="text-lg text-slate-400">
        A State-Space Analysis of Market Dynamics
      </p>
    </header>
  );
}

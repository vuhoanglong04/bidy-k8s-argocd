'use client';

import { Suspense, type ReactNode } from 'react';

interface SearchParamsWrapperProps {
  children: ReactNode;
}

// Specific fallback for search params loading
const SearchParamsFallback = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-muted rounded w-32 mb-2"></div>
    <div className="h-8 bg-muted rounded w-full"></div>
  </div>
);

export function SearchParamsWrapper({ children }: SearchParamsWrapperProps) {
  return (
    <Suspense fallback={<SearchParamsFallback />}>
      {children}
    </Suspense>
  );
}

export default SearchParamsWrapper;
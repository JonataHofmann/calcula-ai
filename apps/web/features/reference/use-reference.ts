'use client';

import { useQuery } from '@tanstack/react-query';
import { getBanks, getBrands, getColors, getIcons } from './reference-api';

const HOUR = 60 * 60 * 1000;

export function useBanks() {
  return useQuery({
    queryKey: ['reference', 'banks'],
    queryFn: getBanks,
    staleTime: HOUR,
    select: (d) => d.banks,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['reference', 'brands'],
    queryFn: getBrands,
    staleTime: HOUR,
    select: (d) => d.brands,
  });
}

export function useIcons() {
  return useQuery({
    queryKey: ['reference', 'icons'],
    queryFn: getIcons,
    staleTime: HOUR,
    select: (d) => d.icons,
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['reference', 'colors'],
    queryFn: getColors,
    staleTime: HOUR,
    select: (d) => d.colors,
  });
}

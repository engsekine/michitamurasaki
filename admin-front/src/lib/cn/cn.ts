import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind クラスを条件付きで結合し、競合を解決する */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

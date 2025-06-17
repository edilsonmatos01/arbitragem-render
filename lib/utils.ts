import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function adjustToUTC(date: Date): Date {
  return new Date(date.getTime() + (3 * 60 * 60 * 1000));
} 
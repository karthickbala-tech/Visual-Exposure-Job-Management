import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui helper: join class names and let later Tailwind classes win over earlier ones.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

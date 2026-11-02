import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export interface Me {
	user: { id: string; email: string; firstName: string; lastName: string };
	roles: string[];
	person: Record<string, unknown> | null;
}

export const useHealth = () =>
	useQuery({ queryKey: ['health'], queryFn: () => api<{ ok: boolean }>('/health'), retry: false });

export const useMe = () =>
	useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), retry: false, staleTime: 5 * 60_000 });

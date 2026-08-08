import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "---";
  
  // Se a data vier no formato YYYY-MM-DD (do banco)
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  return dateString;
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function calculateNextDrawDate(now: Date) {
  const next = new Date(now);
  const hour = next.getHours();
  const day = next.getDay();
  if (day === 0) {
    next.setDate(next.getDate() + 1);
  } else if (day === 6 && hour >= 20) {
    next.setDate(next.getDate() + 2);
  } else if (hour >= 20) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(20, 0, 0, 0);
  return next;
}
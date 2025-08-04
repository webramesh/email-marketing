import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract tenant subdomain from hostname
 */
export function getTenantSubdomain(hostname?: string): string | null {
  if (!hostname) return null;
  
  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // If it's localhost or an IP address, return null
  if (parts.length < 2 || cleanHostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHostname)) {
    return null;
  }
  
  // Return the first part as subdomain (assuming format: subdomain.domain.com)
  return parts[0];
}
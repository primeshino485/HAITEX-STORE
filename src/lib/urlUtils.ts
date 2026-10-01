/**
 * Utility functions for validating and formatting download URLs.
 */

export function isValidHttpsDownloadUrl(url: unknown): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  
  // Must explicitly start with https://
  if (!trimmed.startsWith('https://')) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    
    // Hostname must exist and have at least one dot (e.g., example.com, drive.google.com)
    if (!parsed.hostname || parsed.hostname.length < 3 || !parsed.hostname.includes('.')) {
      return false;
    }
    
    // Disallow local or pseudo hosts like https://localhost or https://test
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

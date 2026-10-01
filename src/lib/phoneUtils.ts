/**
 * WhatsApp Phone Number utilities for Haiti and International numbers
 */
export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function normalizeWhatsAppNumber(raw: string): PhoneValidationResult {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return {
      valid: false,
      normalized: '',
      error: 'Le numéro WhatsApp est obligatoire pour ce produit.',
    };
  }

  // Remove spaces, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Haiti 8-digit local number (e.g., 34584287, 41234567, 31234567)
  if (/^[2-5]\d{7}$/.test(cleaned)) {
    cleaned = '+509' + cleaned;
  }
  // Haiti 11-digit with country code without plus (e.g. 50934584287)
  else if (/^509[2-5]\d{7}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }
  // Haiti standard format with plus (+50934584287)
  else if (/^\+509[2-5]\d{7}$/.test(cleaned)) {
    // Valid Haiti format
  }
  // General E.164 international format (+ followed by 7 to 15 digits)
  else if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    // Valid international format
  } else {
    return {
      valid: false,
      normalized: '',
      error: 'Format de numéro WhatsApp invalide. Veuillez saisir un numéro valide (ex: +509 3458 4287 ou +509XXXXXXXX).',
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Formats a normalized or raw phone number for friendly UI display
 * e.g., +50934584287 -> +509 34 58 4287
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+509') && cleaned.length === 12) {
    return `+509 ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}

/**
 * Builds a clean WhatsApp link for opening WhatsApp web/app
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const cleanDigits = (phone || '').replace(/\D/g, '');
  const baseUrl = `https://wa.me/${cleanDigits}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
}

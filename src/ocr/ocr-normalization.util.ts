export function parseDistanceToMeters(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase().replace(',', '.').trim();
  const numberMatch = normalized.match(/(\d+(\.\d+)?)/);
  if (!numberMatch) {
    return null;
  }

  const amount = Number(numberMatch[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  if (normalized.includes('km')) {
    return Math.round(amount * 1000);
  }
  if (normalized.includes('mi') || normalized.includes('mile')) {
    return Math.round(amount * 1609.34);
  }
  if (normalized.includes('m')) {
    return Math.round(amount);
  }

  if (amount < 100) {
    return Math.round(amount * 1000);
  }

  return Math.round(amount);
}

export function parsePaceToSecPerKm(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function parseDurationToSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();
  const parts = cleaned.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    // Continue with token-based parsing below.
  } else {
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  const hoursMatch = cleaned.match(/(\d+)\s*h/);
  const minutesMatch = cleaned.match(/(\d+)\s*m/);
  const secondsMatch = cleaned.match(/(\d+)\s*s/);
  if (!hoursMatch && !minutesMatch && !secondsMatch) {
    return null;
  }

  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  const seconds = secondsMatch ? Number(secondsMatch[1]) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseActivityDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function stripBase64DataPrefix(raw: string): string {
  const dataPrefixMatch = raw.match(/^data:[^;]+;base64,(.+)$/);
  if (!dataPrefixMatch) {
    return raw;
  }

  return dataPrefixMatch[1];
}

export function parseBase64DataUri(raw: string): {
  mimeType: string | null;
  extension: string;
  data: string;
} {
  const dataPrefixMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!dataPrefixMatch) {
    return {
      mimeType: null,
      extension: 'bin',
      data: raw,
    };
  }

  const mimeType = dataPrefixMatch[1].toLowerCase();
  return {
    mimeType,
    extension: extensionFromMimeType(mimeType),
    data: dataPrefixMatch[2],
  };
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  return 'bin';
}

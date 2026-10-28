export interface PasswordStrength {
  /** 0–100 para la barra. */
  percent: number;
  label: string;
  color: string;
}

const LEVELS: PasswordStrength[] = [
  { percent: 0, label: '', color: 'transparent' },
  { percent: 20, label: 'Muy débil', color: '#e5484d' },
  { percent: 40, label: 'Débil', color: '#f76b15' },
  { percent: 60, label: 'Aceptable', color: '#d68a00' },
  { percent: 80, label: 'Fuerte', color: '#2f9e5b' },
  { percent: 100, label: 'Muy fuerte', color: '#2f9e5b' },
];

/** Estimación sencilla de la fortaleza de una contraseña. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return LEVELS[0];
  let score = 1;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return LEVELS[Math.min(score, LEVELS.length - 1)];
}

/** Contraseña aleatoria (para la de propietario, que el usuario no necesita conocer). */
export function randomPassword(bytes = 24): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

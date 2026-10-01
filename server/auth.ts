import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../src/types.js';

// Secret for signing tokens - generated or loaded from environment
const JWT_SECRET = process.env.JWT_SECRET || 'grexus-tech-my-store-secure-jwt-secret-key-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  exp: number;
}

export function hashPassword(password: string): string {
  // Production-grade bcrypt hashing with work factor 10
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  
  // 1. If stored as bcrypt hash ($2a$ or $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(password, storedHash);
    } catch {
      return false;
    }
  }

  // 2. Legacy fallback for existing salt:hash (PBKDF2) to ensure no accounts are broken
  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }

  return false;
}

export function generateToken(user: { id: string; email: string; role: UserRole; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSignature) return null;

    const payload: AuthPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export interface AdminSession {
  sessionId: string;
  userId: string;
  email: string;
  role: 'ADMIN';
  createdAt: number;
  expiresAt: number;
}

// In-memory active server admin session store
const activeAdminSessions = new Map<string, AdminSession>();
const revokedSessionIds = new Set<string>();

export const AUTHORIZED_ADMIN_EMAIL = 'k6379700@gmail.com';

export function secureTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function createAdminSession(user: { id: string; email: string; name: string }): { sessionId: string; token: string; expiresAt: number } {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = 8 * 60 * 60 * 1000; // 8 hours validity
  const expiresAt = Date.now() + maxAgeMs;

  const session: AdminSession = {
    sessionId,
    userId: user.id,
    email: user.email,
    role: 'ADMIN',
    createdAt: Date.now(),
    expiresAt,
  };

  activeAdminSessions.set(sessionId, session);

  // Encode payload as base64url and sign with HMAC secret
  // This allows persistent session recovery across dev server restarts and robust fallback in iframes
  const payloadStr = JSON.stringify(session);
  const payloadBase64 = Buffer.from(payloadStr, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadBase64).digest('hex');
  const token = `${payloadBase64}.${signature}`;

  return { sessionId, token, expiresAt };
}

export function validateAdminSession(signedToken: string): AdminSession | null {
  if (!signedToken || typeof signedToken !== 'string' || !signedToken.includes('.')) return null;
  const [firstPart, signature] = signedToken.split('.');
  if (!firstPart || !signature) return null;

  // 1. Verify HMAC signature against payload
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(firstPart).digest('hex');
  if (!secureTimingCompare(signature, expectedSignature)) return null;

  // Case A: Payload is base64url JSON containing AdminSession
  try {
    const jsonStr = Buffer.from(firstPart, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr) as AdminSession;
    if (parsed && parsed.sessionId && parsed.email && parsed.role === 'ADMIN') {
      if (revokedSessionIds.has(parsed.sessionId)) {
        return null;
      }
      if (Date.now() > parsed.expiresAt) {
        activeAdminSessions.delete(parsed.sessionId);
        return null;
      }
      if (parsed.email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        return null;
      }
      // Rehydrate in-memory cache in case of server/container restart
      activeAdminSessions.set(parsed.sessionId, parsed);
      return parsed;
    }
  } catch {
    // Continue to legacy session check
  }

  // Case B: Legacy hex sessionId
  const session = activeAdminSessions.get(firstPart);
  if (!session) return null;

  if (revokedSessionIds.has(session.sessionId) || Date.now() > session.expiresAt) {
    activeAdminSessions.delete(firstPart);
    return null;
  }

  return session;
}

export function destroyAdminSession(signedToken: string): void {
  if (!signedToken || typeof signedToken !== 'string' || !signedToken.includes('.')) return;
  const [firstPart] = signedToken.split('.');
  if (!firstPart) return;

  try {
    const jsonStr = Buffer.from(firstPart, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed?.sessionId) {
      revokedSessionIds.add(parsed.sessionId);
      activeAdminSessions.delete(parsed.sessionId);
      return;
    }
  } catch {}

  revokedSessionIds.add(firstPart);
  activeAdminSessions.delete(firstPart);
}

/**
 * Robust Admin Portal Login Handler:
 * - Retrieves ADMIN_PASSWORD from environment variables
 * - Enforces authorized administrator email (AUTHORIZED_ADMIN_EMAIL)
 * - Timing-safe password validation protecting against timing attacks
 * - Generates cryptographically signed server-side session
 * - Sets secure HTTP-only SameSite cookie (session_admin and admin_session)
 * - Returns sanitized admin profile AND token for iframe/header compatibility
 */
export function adminLoginHandler(
  req: Request,
  res: Response,
  getAdminUser?: () => User | undefined
): void | Response {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email administrateur et mot de passe requis.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const configuredAdminPassword = process.env.ADMIN_PASSWORD;

    if (!configuredAdminPassword) {
      console.error('[SECURITY CRITICAL] ADMIN_PASSWORD environment variable is not configured.');
      return res.status(500).json({ error: 'Configuration de sécurité du serveur incomplète.' });
    }

    // 1. Validate administrator email
    const isEmailValid = normalizedEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase();

    // 2. Perform timing-safe credential verification
    const targetPassword = isEmailValid ? configuredAdminPassword : 'dummy-timing-protection-value';
    const isPasswordValid = secureTimingCompare(password, targetPassword);

    if (!isEmailValid || !isPasswordValid) {
      return res.status(401).json({ error: 'Identifiants administrateur incorrects.' });
    }

    // 3. Retrieve or construct admin user profile
    let adminUser = getAdminUser ? getAdminUser() : undefined;
    if (!adminUser) {
      adminUser = {
        id: 'usr-admin-master',
        email: AUTHORIZED_ADMIN_EMAIL,
        name: 'Administrateur Principal',
        role: 'ADMIN',
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    // 4. Create cryptographically signed server-side admin session
    const { token, expiresAt } = createAdminSession(adminUser);

    // 5. Initiate secure HTTP-only session cookies
    // For iframe environments (e.g. AI Studio preview), SameSite=None and Secure=true are essential when on HTTPS
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: (isSecure ? 'none' : 'lax') as 'none' | 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/',
    };

    res.cookie('session_admin', token, cookieOptions);
    res.cookie('admin_session', token, cookieOptions);

    // 6. Return response with sanitized user data AND signed session token
    // Providing the token in the response payload guarantees admin functionality even if the browser blocks third-party cookies in the iframe
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN' as const,
        status: adminUser.status,
        createdAt: adminUser.createdAt,
      },
      expiresAt,
      message: 'Authentification administrateur réussie.',
    });
  } catch (err: any) {
    console.error('[Admin Login Error]:', err);
    return res.status(500).json({ error: 'Erreur interne lors de l\'authentification administrateur.' });
  }
}

/**
 * Admin Session Verification Handler
 */
export function adminCheckHandler(req: AuthenticatedRequest, res: Response): void | Response {
  if (
    req.user &&
    req.user.role === 'ADMIN' &&
    req.user.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase() &&
    req.adminSession
  ) {
    return res.status(200).json({
      authenticated: true,
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name,
        role: 'ADMIN',
      },
    });
  }
  return res.status(200).json({ authenticated: false });
}

/**
 * Admin Session Revocation (Logout) Handler
 */
export function adminLogoutHandler(req: AuthenticatedRequest, res: Response): void | Response {
  const adminCookie = req.cookies?.session_admin || req.cookies?.admin_session;
  const adminHeader = req.headers['x-admin-token'] || req.headers['x-session-admin'];
  const authHeader = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : undefined;

  const tokenToDestroy = (typeof adminCookie === 'string' ? adminCookie : '') ||
                         (typeof adminHeader === 'string' ? adminHeader : '') ||
                         (typeof authHeader === 'string' ? authHeader : '');

  if (tokenToDestroy) {
    destroyAdminSession(tokenToDestroy);
  }
  res.clearCookie('session_admin', { path: '/' });
  res.clearCookie('admin_session', { path: '/' });
  return res.status(200).json({ success: true, message: 'Déconnexion administrateur effectuée avec succès.' });
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
  adminSession?: AdminSession;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Allow OPTIONS preflight requests to bypass auth inspection
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 1. Check HTTP-only cookie for Admin session (supporting both session_admin and admin_session)
  const adminCookie = req.cookies?.session_admin || req.cookies?.admin_session;
  if (adminCookie && typeof adminCookie === 'string') {
    const adminSession = validateAdminSession(adminCookie);
    if (adminSession && adminSession.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      req.adminSession = adminSession;
      req.user = {
        userId: adminSession.userId,
        email: adminSession.email,
        role: 'ADMIN',
        name: 'Administrateur',
        exp: Math.floor(adminSession.expiresAt / 1000),
      };
      return next();
    }
  }

  // 1b. Check x-admin-token / x-session-admin header (vital for iframe embedded environments)
  const adminHeader = req.headers['x-admin-token'] || req.headers['x-session-admin'];
  if (adminHeader && typeof adminHeader === 'string') {
    const adminSession = validateAdminSession(adminHeader);
    if (adminSession && adminSession.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      req.adminSession = adminSession;
      req.user = {
        userId: adminSession.userId,
        email: adminSession.email,
        role: 'ADMIN',
        name: 'Administrateur',
        exp: Math.floor(adminSession.expiresAt / 1000),
      };
      return next();
    }
  }

  // 2. Check Bearer token (can be admin session token or customer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Check if it's an admin session token first
    const adminSession = validateAdminSession(token);
    if (adminSession && adminSession.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      req.adminSession = adminSession;
      req.user = {
        userId: adminSession.userId,
        email: adminSession.email,
        role: 'ADMIN',
        name: 'Administrateur',
        exp: Math.floor(adminSession.expiresAt / 1000),
      };
      return next();
    }

    // Otherwise check regular token (JWT)
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      if (user.role === 'ADMIN' && user.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        // Automatically provide adminSession for verified admin JWT tokens
        req.adminSession = {
          sessionId: `jwt-${user.userId}`,
          userId: user.userId,
          email: user.email,
          role: 'ADMIN',
          createdAt: Date.now(),
          expiresAt: user.exp ? user.exp * 1000 : Date.now() + 8 * 3600 * 1000,
        };
      }
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Non autorisé. Veuillez vous connecter.' });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Allow preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 1. Must be authenticated
  if (!req.user) {
    return res.status(403).json({ error: 'Accès interdit. Authentification administrateur requise.' });
  }

  // 2. Must strictly have role ADMIN
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès interdit. Droits administrateur requis.' });
  }

  // 3. Must match the authorized administrator email
  if (req.user.email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Accès interdit. Compte non autorisé pour l\'administration.' });
  }

  // 4. Must have a valid, active server admin session
  if (req.adminSession) {
    if (Date.now() > req.adminSession.expiresAt) {
      return res.status(403).json({ error: 'Session administrateur expirée. Veuillez vous reconnecter.' });
    }
  } else {
    return res.status(403).json({ error: 'Session administrateur inexistante ou expirée.' });
  }

  next();
}

// ==================== ABUSE PROTECTION & RATE LIMITING ====================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class SimpleRateLimiter {
  private hits = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxHits: number;

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
  }

  public check(key: string): { allowed: boolean; remainingSeconds: number } {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now > entry.resetTime) {
      this.hits.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, remainingSeconds: Math.ceil(this.windowMs / 1000) };
    }

    if (entry.count >= this.maxHits) {
      return { allowed: false, remainingSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)) };
    }

    entry.count += 1;
    return { allowed: true, remainingSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)) };
  }
}

// Limiters for authentication endpoints
export const authLoginLimiter = new SimpleRateLimiter(60 * 1000, 10); // 10 attempts per minute
export const authRegisterLimiter = new SimpleRateLimiter(60 * 1000, 5); // 5 registers per minute
export const authVerifyLimiter = new SimpleRateLimiter(60 * 1000, 10); // 10 verify checks per minute
export const authResendLimiter = new SimpleRateLimiter(60 * 1000, 3); // 3 resends per minute
export const authForgotLimiter = new SimpleRateLimiter(60 * 1000, 5); // 5 requests per minute
export const authResetLimiter = new SimpleRateLimiter(60 * 1000, 5); // 5 resets per minute

// ==================== PENDING REGISTRATIONS WITH EMAIL VERIFICATION ====================

export interface PendingSignup {
  email: string;
  name: string;
  passwordHash: string;
  codeHash: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
}

const pendingSignups = new Map<string, PendingSignup>();

/**
 * Creates or updates a pending customer registration.
 * Single-use 6-digit code is securely hashed.
 */
export function createPendingSignup(data: {
  email: string;
  name: string;
  passwordHash: string;
  code: string;
  termsAccepted?: boolean;
}): { pending: PendingSignup; code: string } {
  const normalizedEmail = data.email.trim().toLowerCase();
  const codeHash = hashPassword(data.code);
  const now = Date.now();

  const pending: PendingSignup = {
    email: normalizedEmail,
    name: data.name.trim() || 'Client',
    passwordHash: data.passwordHash,
    codeHash,
    attempts: 0,
    createdAt: now,
    expiresAt: now + (15 * 60 * 1000), // 15 minutes TTL
    lastSentAt: now,
    termsAccepted: data.termsAccepted ?? true,
    termsAcceptedAt: new Date().toISOString(),
  };

  pendingSignups.set(normalizedEmail, pending);
  return { pending, code: data.code };
}

export function getPendingSignup(email: string): PendingSignup | null {
  const normalizedEmail = email.trim().toLowerCase();
  const pending = pendingSignups.get(normalizedEmail);
  if (!pending) return null;

  // Auto clean if expired
  if (Date.now() > pending.expiresAt) {
    pendingSignups.delete(normalizedEmail);
    return null;
  }

  return pending;
}

export function recordPendingSignupAttempt(email: string): { attempts: number; maxReached: boolean } {
  const normalizedEmail = email.trim().toLowerCase();
  const pending = pendingSignups.get(normalizedEmail);
  if (!pending) return { attempts: 0, maxReached: true };

  pending.attempts += 1;
  if (pending.attempts >= 5) {
    // Invalidate immediately after 5 failed attempts
    pendingSignups.delete(normalizedEmail);
    return { attempts: pending.attempts, maxReached: true };
  }

  return { attempts: pending.attempts, maxReached: false };
}

export function removePendingSignup(email: string): void {
  pendingSignups.delete(email.trim().toLowerCase());
}

export function refreshPendingSignupCode(email: string, newCode: string): PendingSignup | null {
  const normalizedEmail = email.trim().toLowerCase();
  const pending = pendingSignups.get(normalizedEmail);
  if (!pending) return null;

  const now = Date.now();
  pending.codeHash = hashPassword(newCode);
  pending.attempts = 0;
  pending.expiresAt = now + (15 * 60 * 1000);
  pending.lastSentAt = now;

  return pending;
}

// ==================== PASSWORD RESET TOKENS ====================

export interface PasswordResetRecord {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const passwordResetStore = new Map<string, PasswordResetRecord>();

export function createPasswordResetRecord(userId: string, email: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + (60 * 60 * 1000); // 1 hour validity

  const record: PasswordResetRecord = {
    token,
    userId,
    email: email.trim().toLowerCase(),
    createdAt: now,
    expiresAt,
    used: false,
  };

  passwordResetStore.set(token, record);
  return { token, expiresAt };
}

export function validatePasswordResetToken(token: string, email?: string): PasswordResetRecord | null {
  if (!token || typeof token !== 'string') return null;
  const record = passwordResetStore.get(token);
  if (!record) return null;

  if (record.used) return null;
  if (Date.now() > record.expiresAt) {
    passwordResetStore.delete(token);
    return null;
  }

  if (email && record.email.toLowerCase() !== email.trim().toLowerCase()) {
    return null;
  }

  return record;
}

export function markPasswordResetUsed(token: string): boolean {
  const record = passwordResetStore.get(token);
  if (!record || record.used) return false;
  record.used = true;
  passwordResetStore.delete(token);
  return true;
}


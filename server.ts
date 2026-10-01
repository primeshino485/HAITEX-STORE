import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { imageSize } from 'image-size';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { paymentService } from './server/payments/paymentService.js';
import { gameVerificationService } from './server/services/gameVerification.js';
import { emailService } from './server/services/emailService.js';
import { ChatbotService } from './server/services/chatbotService.js';
import {
  authenticate,
  requireAuth,
  requireAdmin,
  generateToken,
  hashPassword,
  verifyPassword,
  createAdminSession,
  destroyAdminSession,
  AUTHORIZED_ADMIN_EMAIL,
  secureTimingCompare,
  AuthenticatedRequest,
  adminLoginHandler,
  adminCheckHandler,
  adminLogoutHandler,
  authLoginLimiter,
  authRegisterLimiter,
  authVerifyLimiter,
  authResendLimiter,
  authForgotLimiter,
  authResetLimiter,
  createPendingSignup,
  getPendingSignup,
  recordPendingSignupAttempt,
  removePendingSignup,
  refreshPendingSignupCode,
  createPasswordResetRecord,
  validatePasswordResetToken,
  markPasswordResetUsed,
} from './server/auth.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing with generous limit for mobile image uploads (base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Parse HTTP cookies (for secure HTTP-only admin session cookies)
app.use(cookieParser());

// Global authentication middleware
app.use(authenticate);

// Persistent uploads storage directory
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve persistent uploads statically (from data/uploads as primary, and ./uploads as fallback)
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
const LEGACY_UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (fs.existsSync(LEGACY_UPLOADS_DIR)) {
  app.use('/uploads', express.static(LEGACY_UPLOADS_DIR, { maxAge: '7d' }));
}
app.use('/uploads', (req, res) => {
  res.status(404).json({ error: 'Fichier introuvable dans le répertoire de téléversement.' });
});

// ==================== PUBLIC API ENDPOINTS ====================

// ==================== MONCASH ARCHITECTURE CONFIGURATION ====================
// Architecture prepared for future official MonCash API integration.
// As instructed: No invented API keys, secrets, or fake endpoints.
// MONCASH_MODE is strictly set to 'manual'.
export const MONCASH_MODE: 'manual' | 'automatic' = 'manual';
export const MONCASH_CONFIG = {
  mode: MONCASH_MODE,
  phoneNumber: '34584287',
  recipientName: 'carlentz',
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'MY STORE API', timestamp: new Date().toISOString() });
});

// Site Settings
app.get('/api/site-settings', (req, res) => {
  res.json(db.getSiteSettings());
});

// Categories (Public: returns active only, ordered by displayOrder ASC)
app.get('/api/categories', (req, res) => {
  res.json(db.getCategories(false));
});

// Platforms & Games
app.get('/api/platforms', (req, res) => {
  const { categoryId } = req.query;
  if (categoryId && typeof categoryId === 'string') {
    res.json(db.getPlatformsByCategory(categoryId));
  } else {
    res.json(db.getPlatforms());
  }
});

// Sanitize product for public exposure (never expose downloadUrl before purchase)
function sanitizeProductForPublic(product: any): any {
  if (!product) return product;
  const { downloadUrl, protectedContent, protectedTutorial, accountCredentials, ...rest } = product;
  return {
    ...rest,
    hasProtectedContent: Boolean(
      product.downloadUrl || 
      product.protectedContent || 
      product.protectedTutorial || 
      product.protectedContentTitle
    ),
  };
}

// Products catalog (public with filters & sorting)
app.get('/api/products', (req, res) => {
  const { categoryId, subcategoryId, featured, search, sortBy, productType } = req.query;
  const products = db.getProducts({
    categoryId: categoryId as string,
    subcategoryId: subcategoryId as string,
    featured: featured === 'true',
    search: search as string,
    sortBy: sortBy as any,
    productType: productType as string,
    status: 'published',
  });
  res.json(products.map(sanitizeProductForPublic));
});

// Single product
app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }
  res.json(sanitizeProductForPublic(product));
});

// Protected Content / Post-purchase resource endpoint
app.get('/api/products/:id/protected-content', requireAuth, (req: AuthenticatedRequest, res) => {
  const productId = req.params.id;
  const product = db.getProductById(productId);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  // Admins can always view
  if (req.user?.role === 'ADMIN') {
    return res.json({
      productId,
      title: product.protectedContentTitle || 'Tutoriel / Ressource réservée',
      content: product.protectedContent || product.protectedTutorial || '',
      downloadUrl: product.downloadUrl || null,
    });
  }

  // Verify that the customer has an approved/delivered order containing this product
  const userOrders = db.getOrdersForUser(req.user!.userId);
  const hasPurchased = userOrders.some(
    o => (o.status === 'COMPLETED' || o.digitalDeliveryStatus === 'DELIVERED') &&
         o.items.some(item => item.productId === productId)
  );

  if (!hasPurchased) {
    return res.status(403).json({
      error: 'Accès refusé. Ce contenu protégé est réservé aux clients ayant commandé et reçu ce produit.',
    });
  }

  res.json({
    productId,
    title: product.protectedContentTitle || 'Tutoriel / Ressource réservée',
    content: product.protectedContent || product.protectedTutorial || '',
    downloadUrl: product.downloadUrl || null,
  });
});

// Payment Methods
app.get('/api/payment-methods', (req, res) => {
  res.json(db.getPaymentMethods());
});

// ==================== UNIVERSAL GAME PLAYER ID VERIFICATION ====================

// Public endpoint for customer or checkout ID verification
app.post('/api/games/verify-id', async (req, res) => {
  try {
    const { platformId, productId, playerIdentifier, region, server } = req.body;

    if (!playerIdentifier || !playerIdentifier.trim()) {
      return res.status(400).json({ error: 'Identifiant joueur requis.' });
    }

    let platform = platformId ? db.getPlatforms().find(p => p.id === platformId) : null;
    if (!platform && productId) {
      const prod = db.getProductById(productId);
      if (prod) {
        platform = db.getPlatforms().find(p => p.id === ((prod as any).platformId || prod.subcategoryId));
      }
    }

    if (!platform) {
      return res.status(404).json({ error: 'Jeu / plateforme introuvable.' });
    }

    if (!platform.idVerification || !platform.idVerification.verificationEnabled) {
      return res.status(400).json({ error: `La vérification d'identifiant n'est pas activée pour ${platform.name}.` });
    }

    const result = await gameVerificationService.verifyPlayer({
      gameId: platform.id,
      gameSlug: platform.slug,
      gameName: platform.name,
      playerIdentifier,
      region,
      server,
      config: platform.idVerification,
    });

    if (!result.verified) {
      return res.status(422).json({
        success: false,
        error: result.errorMessage || 'Joueur introuvable.',
        result,
      });
    }

    res.json({
      success: true,
      result,
      message: `Joueur trouvé : ${result.playerName}`,
    });
  } catch (err: any) {
    console.error('Error during player verification:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la vérification de l\'identifiant.' });
  }
});

// Admin test endpoint to verify connectivity with any configured provider
app.post('/api/admin/verification/test', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { platformId, playerIdentifier, region, server, customConfig } = req.body;

    const platform = db.getPlatforms().find(p => p.id === platformId);
    if (!platform && !customConfig) {
      return res.status(404).json({ error: 'Plateforme introuvable et aucune configuration fournie.' });
    }

    const effectiveConfig = customConfig || platform?.idVerification;
    if (!effectiveConfig) {
      return res.status(400).json({ error: 'Aucune configuration de vérification disponible pour le test.' });
    }

    const result = await gameVerificationService.verifyPlayer({
      gameId: platform ? platform.id : 'test-game',
      gameSlug: platform ? platform.slug : 'test-game',
      gameName: platform ? platform.name : 'Jeu Test',
      playerIdentifier: playerIdentifier || '123456789',
      region: region || 'LATAM',
      server: server,
      config: effectiveConfig,
    });

    res.json({
      success: result.verified,
      result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du test de vérification.' });
  }
});

// ==================== AUTHENTICATION ====================

// Email Service Configuration Status
app.get('/api/auth/oauth/status', (req, res) => {
  res.json({
    emailConfigured: emailService.isConfigured(),
  });
});

// SMTP Diagnostic Endpoint for Admin & Internal Health Checks (Never exposes secrets/passwords)
app.get('/api/admin/smtp/diagnostic', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const diagnostic = await emailService.testDiagnostic();
    return res.json(diagnostic);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors du diagnostic SMTP.' });
  }
});

app.get('/api/internal/smtp/diagnostic', async (req, res) => {
  try {
    const diagnostic = await emailService.testDiagnostic();
    return res.json(diagnostic);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur lors du diagnostic SMTP.' });
  }
});

// Customer Registration Initiation with Mandatory Email Verification
app.post('/api/auth/register', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const rateCheck = authRegisterLimiter.check(`reg:${ip}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Twòp tantativ enskripsyon. Tanpri tann ${rateCheck.remainingSeconds} segonn.`,
      });
    }

    const { name, email, password, confirmPassword, termsAccepted } = req.body || {};

    if (!termsAccepted) {
      return res.status(400).json({
        error: 'Ou dwe aksepte Kondisyon Itilizasyon yo ak Règleman sou Vi Prive a pou kreye yon kont.',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Tanpri ranpli tout chan obligatwa yo.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Fòma adrès imèl sa a pa valab.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Modpas la dwe gen omwen 8 karaktè.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'De modpas yo pa koresponn.' });
    }

    // Check if email already exists as an active verified user in database
    const existingUser = db.getUserByEmail(cleanEmail);
    if (existingUser && existingUser.emailVerified && existingUser.status === 'active') {
      return res.status(409).json({
        code: 'EMAIL_ALREADY_EXISTS',
        error: 'Sa imel sa deja asosye ak yon kont ki verifye.',
      });
    }

    // Check email service configuration
    if (!emailService.isConfigured()) {
      return res.status(503).json({
        code: 'EMAIL_NOT_CONFIGURED',
        error: 'Sèvis voye imel la poko konfigire sou sèvè a (variab SMTP manke nan anviwònman an). Tanpri kontakte sipò a.',
      });
    }

    // 1. Create the customer account in status "email non vérifié"
    const passwordHash = hashPassword(password);
    db.createOrUpdateUnverifiedCustomer({
      name: String(name).trim() || 'Client',
      email: cleanEmail,
      passwordHash,
      termsAccepted: !!termsAccepted,
    });

    // 2. Generate real cryptographically random 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString();

    createPendingSignup({
      email: cleanEmail,
      name: String(name).trim() || 'Client',
      passwordHash,
      code,
      termsAccepted: !!termsAccepted,
    });

    // 3. Send real email via SMTP
    try {
      await emailService.sendVerificationCode({
        to: cleanEmail,
        name: String(name).trim(),
        code,
      });
    } catch (smtpErr: any) {
      // If delivery failed, rollback unverified account & pending state
      db.deleteUnverifiedCustomer(cleanEmail);
      removePendingSignup(cleanEmail);
      console.error('[Register] Échec de transmission SMTP pour:', emailService.maskEmail(cleanEmail));
      return res.status(503).json({
        code: 'EMAIL_DELIVERY_FAILED',
        email: cleanEmail,
        canResend: true,
        cooldownSeconds: 60,
        error: 'Nou pa kapab voye kòd verifikasyon an pou kounye a. Tanpri eseye ankò pita.',
      });
    }

    return res.status(200).json({
      success: true,
      email: cleanEmail,
      message: 'Nou voye yon kòd verifikasyon sou adrès imel ou.',
      cooldownSeconds: 60,
    });
  } catch (err: any) {
    console.error('[Register Error]:', err);
    return res.status(500).json({ error: 'Erè pandan kreyasyon kont lan. Tanpri eseye ankò.' });
  }
});

// Verify 6-Digit Email Code & Activate Customer Account
app.post('/api/auth/verify-email', (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const rateCheck = authVerifyLimiter.check(`verify:${ip}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Twòp tantativ verifikasyon. Tanpri tann ${rateCheck.remainingSeconds} segonn.`,
      });
    }

    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Adrès imèl ak kòd verifikasyon an obligatwa.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const pending = getPendingSignup(cleanEmail);
    if (!pending) {
      return res.status(400).json({
        error: 'Kòd verifikasyon an ekspire oswa enskripsyon an pa jwenn. Tanpri rekòmanse enskripsyon an.',
      });
    }

    // Verify code against stored hash
    const isCodeValid = verifyPassword(cleanCode, pending.codeHash);
    if (!isCodeValid) {
      const { attempts, maxReached } = recordPendingSignupAttempt(cleanEmail);
      if (maxReached) {
        return res.status(429).json({
          error: 'Twòp tantativ kòd kòrèk (maksimòm 5). Pou rezon sekirite, tanpri rekòmanse enskripsyon an.',
        });
      }
      return res.status(400).json({
        error: 'Kòd verifikasyon an pa kòrèk.',
        remainingAttempts: 5 - attempts,
      });
    }

    // Code is valid! Activate the customer account
    let activatedUser = db.activateCustomer(cleanEmail);
    if (!activatedUser) {
      activatedUser = db.createVerifiedCustomer({
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        authMethod: 'EMAIL',
        termsAccepted: pending.termsAccepted,
        termsAcceptedAt: pending.termsAcceptedAt,
      });
    }

    removePendingSignup(cleanEmail);

    const token = generateToken({
      id: activatedUser.id,
      email: activatedUser.email,
      role: 'CUSTOMER',
      name: activatedUser.name,
    });

    return res.status(200).json({
      success: true,
      user: activatedUser,
      token,
      message: 'Imel ou verifye avèk siksè.',
    });
  } catch (err: any) {
    console.error('[Verify Email Error]:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de la vérification de l\'email.' });
  }
});

// Resend 6-Digit Email Code with Cooldown Timer
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Adrès imèl obligatwa.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const pending = getPendingSignup(cleanEmail);

    if (!pending) {
      return res.status(400).json({
        error: 'Enskripsyon an pa jwenn oswa li ekspire. Tanpri rekòmanse enskripsyon an.',
      });
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - pending.lastSentAt) / 1000);
    const cooldownSeconds = 60;

    if (elapsedSeconds < cooldownSeconds) {
      const waitRemaining = cooldownSeconds - elapsedSeconds;
      return res.status(429).json({
        error: `Ou ka voye yon nouvo kòd nan ${waitRemaining} segonn.`,
        remainingSeconds: waitRemaining,
      });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({
        error: 'Sèvis imel la poko konfigire sou sèvè a.',
      });
    }

    const newCode = crypto.randomInt(100000, 999999).toString();
    refreshPendingSignupCode(cleanEmail, newCode);

    try {
      await emailService.sendVerificationCode({
        to: cleanEmail,
        name: pending.name,
        code: newCode,
      });
    } catch (smtpErr: any) {
      console.error('[Resend Code] Échec de transmission SMTP pour:', emailService.maskEmail(cleanEmail));
      return res.status(503).json({
        code: 'EMAIL_DELIVERY_FAILED',
        error: 'Nou pa kapab voye kòd verifikasyon an pou kounye a. Tanpri eseye ankò pita.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Nou voye yon kòd 6 chif sou adrès imel ou.',
      cooldownSeconds: 60,
    });
  } catch (err: any) {
    console.error('[Resend Code Error]:', err);
    return res.status(500).json({ error: 'Erè pandan voye kòd la. Tanpri eseye ankò pita.' });
  }
});

// Public-Safe Auth Flow Check Endpoint
// Allows the public frontend to detect if an email belongs to admin flow
// without revealing passwords, roles, tokens, or private data.
app.post('/api/auth/check-flow', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Adrès imèl obligatwa.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const isAdmin = cleanEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase() || db.getUserByEmail(cleanEmail)?.role === 'ADMIN';
    return res.json({
      flow: isAdmin ? 'admin' : 'customer',
      redirectTo: isAdmin ? '/admin/connexion' : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erè sèvè.' });
  }
});

// Public Customer Login & Admin Redirection
app.post('/api/auth/login', (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const rateCheck = authLoginLimiter.check(`login:${ip}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Twòp tantativ koneksyon. Tanpri tann ${rateCheck.remainingSeconds} segonn.`,
      });
    }

    const { email, password } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Tanpri ranpli imèl ou.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const isAdminAccount = cleanEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase() || db.getUserByEmail(cleanEmail)?.role === 'ADMIN';

    // CRITICAL: When an administrator enters their email in the public login form:
    // DO NOT return HTTP 403!
    // DO NOT return "Forbidden"!
    // Instead, safely guide the client to redirect to the dedicated admin portal (/admin/connexion).
    // Note: No admin session is created here, no credentials or tokens are issued.
    if (isAdminAccount) {
      return res.status(200).json({
        success: true,
        redirectTo: '/admin/connexion',
        message: 'Redireksyon vè pòtay administrasyon an...',
      });
    }

    if (!password) {
      return res.status(400).json({ error: 'Tanpri ranpli imèl ak modpas ou.' });
    }

    const user = db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Imèl oswa modpas pa kòrèk.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Kont sa a sispann. Tanpri kontakte sipò kliyan an.' });
    }

    if (user.emailVerified === false || user.status === 'pending') {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Adrès imèl sa a poko verifye. Tanpri antre kòd verifikasyon ou an.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Imèl oswa modpas pa kòrèk.' });
    }

    db.updateUserLastLogin(user.id);

    // Issue customer token strictly with role CUSTOMER
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'CUSTOMER',
      name: user.name,
    });

    const { passwordHash, ...safeUser } = user;
    safeUser.role = 'CUSTOMER';

    return res.json({
      success: true,
      user: safeUser,
      token,
      message: 'Koneksyon reyisi avèk siksè.',
    });
  } catch (err: any) {
    console.error('[Login Error]:', err);
    return res.status(500).json({ error: 'Erè pandan koneksyon an.' });
  }
});

// Forgot Password Request (Never reveals whether email exists)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const rateCheck = authForgotLimiter.check(`forgot:${ip}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Twòp demann. Tanpri tann ${rateCheck.remainingSeconds} segonn.`,
      });
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Adrès imèl obligatwa.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!emailService.isConfigured()) {
      return res.status(503).json({
        error: 'Sèvis voye imel la poko konfigire sou sèvè a (SMTP manke). Tanpri kontakte sipò a.',
      });
    }

    const user = db.getUserByEmail(cleanEmail);

    // Security: Only send reset if customer exists and is not ADMIN
    if (user && user.role === 'CUSTOMER') {
      const { token } = createPasswordResetRecord(user.id, user.email);
      const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
      const resetUrl = `${appUrl}/#reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

      await emailService.sendPasswordResetLink({
        to: user.email,
        name: user.name,
        resetUrl,
      }).catch(err => {
        console.error('[Forgot Password Email Error]:', err);
      });
    }

    // MANDATORY REQUIREMENT 8: Standard reassuring message, never leak user existence
    return res.json({
      success: true,
      message: 'Si imel sa a asosye ak yon kont, n ap voye enstriksyon pou rekipere aksè ou.',
    });
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err);
    return res.status(500).json({ error: 'Erè pandan demann rekipere modpas la.' });
  }
});

// Reset Password with Single-Use Secure Token
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const rateCheck = authResetLimiter.check(`reset:${ip}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Twòp tantativ. Tanpri tann ${rateCheck.remainingSeconds} segonn.`,
      });
    }

    const { token, email, newPassword, confirmPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token ak nouvo modpas obligatwa.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Nouvo modpas la dwe gen omwen 8 karaktè.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'De modpas yo pa koresponn.' });
    }

    const record = validatePasswordResetToken(token, email);
    if (!record) {
      return res.status(400).json({
        error: 'Lyen reyinitializasyon sa a pa valab oswa li ekspire. Tanpri fè yon nouvo demann.',
      });
    }

    // Update password
    const newHash = hashPassword(newPassword);
    const updated = db.updateUserPassword(record.userId, newHash);
    if (!updated) {
      return res.status(404).json({ error: 'Itilizatè introuvable.' });
    }

    markPasswordResetUsed(token);

    return res.json({
      success: true,
      message: 'Modpas ou chanje avèk siksè. Ou ka konekte kounye a.',
    });
  } catch (err: any) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ error: 'Erè pandan chanjman modpas la.' });
  }
});

// Get current logged-in user profile & wallet
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.getUserById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  const wallet = db.getWalletByUserId(user.id);
  const { passwordHash, ...safeUser } = user as any;

  res.json({
    user: safeUser,
    wallet,
  });
});

// Update customer preferred language
app.post('/api/user/language', requireAuth, (req: AuthenticatedRequest, res) => {
  const { language } = req.body;
  if (!language || !['ht', 'fr', 'en'].includes(language)) {
    return res.status(400).json({ error: 'Langue invalide. Valeurs acceptées: ht, fr, en' });
  }
  const updatedUser = db.updateUserLanguage(req.user!.userId, language);
  if (!updatedUser) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  res.json({ success: true, language });
});

// Get customer user preferences
app.get('/api/user/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const prefs = db.getUserPreferences(req.user!.userId);
  res.json(prefs);
});

// Update customer user preferences (theme, language, communication preferences)
app.put('/api/user/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateUserPreferences(req.user!.userId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour des préférences.' });
  }
});

// Update customer profile (name, phone, whatsapp)
app.put('/api/user/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updatedUser = db.updateUserProfile(req.user!.userId, req.body);
    const { passwordHash, ...safeUser } = updatedUser as any;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour du profil.' });
  }
});

// Change customer password securely
app.put('/api/user/password', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = db.changeUserPassword(req.user!.userId, currentPassword, newPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du changement de mot de passe.' });
  }
});

// Customer logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session_customer', { path: '/' });
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Déconnexion effectuée avec succès.' });
});

// ==================== CUSTOMER WALLET & RECHARGE ====================

// Get customer wallet
app.get('/api/wallet', requireAuth, (req: AuthenticatedRequest, res) => {
  const wallet = db.getWalletByUserId(req.user!.userId);
  res.json(wallet);
});

// Get customer wallet transactions
app.get('/api/wallet/transactions', requireAuth, (req: AuthenticatedRequest, res) => {
  const transactions = db.getWalletTransactions(req.user!.userId);
  res.json(transactions);
});

// List payment providers and configuration state
app.get('/api/payments/providers', (req, res) => {
  try {
    const providers = paymentService.listProviders();
    res.json(providers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Calculate server-side fees for a given payment method and amount
app.post('/api/payments/calculate-fees', (req, res) => {
  try {
    const { amountHTG, paymentMethod } = req.body;
    const amount = parseFloat(amountHTG);
    const fees = paymentService.calculateFees(amount, paymentMethod || 'moncash');
    res.json(fees);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Submit recharge request (MonCash / NatCash) with server validation and idempotency
app.post('/api/recharges/manual', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { amountHTG, transcode, paymentDate, screenshotUrl, paymentMethod, idempotencyKey } = req.body;
    const amount = parseFloat(amountHTG);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide en Gourdes (HTG).' });
    }
    const cleanTranscode = (transcode || '').trim();
    if (!cleanTranscode || cleanTranscode.length < 4) {
      return res.status(400).json({ error: 'Numéro de référence ou transcode de transaction obligatoire.' });
    }

    const user = db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    // Call resilient paymentService
    const request = await paymentService.createRecharge({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      amountHTG: amount,
      paymentMethod: paymentMethod || 'moncash',
      transcode: cleanTranscode,
      paymentDate,
      screenshotUrl,
      idempotencyKey,
    });

    const methodTitle = (paymentMethod || 'moncash').toUpperCase();

    res.status(201).json({
      message: `Votre demande de recharge ${methodTitle} (${amount} HTG) a été enregistrée avec succès (Statut: PENDING). L'administrateur va vérifier votre transfert avant de créditer votre solde.`,
      request,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la soumission de la recharge.' });
  }
});

// Customer's recharge requests
app.get('/api/recharges/my', requireAuth, (req: AuthenticatedRequest, res) => {
  const requests = db.getRechargeRequests(req.user!.userId);
  res.json(requests);
});

// ==================== UNIVERSAL PAYMENT WEBHOOKS (NATCASH / MONCASH) ====================

app.post('/api/payments/:provider/webhook', async (req, res) => {
  try {
    const { provider } = req.params;
    const headers = req.headers as Record<string, string>;

    const result = await paymentService.handleProviderWebhook(provider, req.body, headers);
    res.status(result.httpStatus || 200).json(result);
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: err.message || 'Erreur de traitement du webhook de paiement.' });
  }
});

// NatCash backward compatibility webhook route
app.post('/api/payments/natcash/webhook', async (req, res) => {
  try {
    const headers = req.headers as Record<string, string>;
    const result = await paymentService.handleProviderWebhook('natcash', req.body, headers);
    res.status(result.httpStatus || 200).json(result);
  } catch (err: any) {
    console.error('Webhook NatCash error:', err);
    res.status(400).json({ error: err.message || 'Erreur de traitement du webhook NatCash.' });
  }
});

// ==================== SHOPPING CART PERSISTENCE & CHECKOUT ====================

// Get server-authoritative customer cart
app.get('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const items = db.getUserCart(req.user!.userId);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erè pandan rekipere panye a.' });
  }
});

// Overwrite/Sync customer cart
app.post('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Fòma atik panye a pa valab.' });
    }
    const updated = db.setUserCart(req.user!.userId, items);
    res.json({ success: true, items: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erè pandan anrejistreman panye a.' });
  }
});

// Add item to customer cart
app.post('/api/cart/add', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { item } = req.body || {};
    if (!item || !item.product || !item.product.id) {
      return res.status(400).json({ error: 'Pwodui sa a pa valab.' });
    }
    const updated = db.addToUserCart(req.user!.userId, item);
    res.json({ success: true, items: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erè pandan ajoute nan panye a.' });
  }
});

// Update item quantity or details in cart
app.put('/api/cart/item', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { productId, quantity, details } = req.body || {};
    if (!productId) {
      return res.status(400).json({ error: 'Id pwodui a obligatwa.' });
    }
    const updated = db.updateUserCartItem(req.user!.userId, productId, Number(quantity || 1), details);
    res.json({ success: true, items: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erè pandan modifikasyon panye a.' });
  }
});

// Remove item from cart
app.delete('/api/cart/item/:productId', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.removeFromUserCart(req.user!.userId, req.params.productId);
    res.json({ success: true, items: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erè pandan retire atik nan panye a.' });
  }
});

// Clear customer cart
app.delete('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    db.clearUserCart(req.user!.userId);
    res.json({ success: true, items: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erè pandan vide panye a.' });
  }
});

// Secure atomic checkout from wallet balance
app.post('/api/cart/checkout', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { items, customerWhatsApp, idempotencyKey, couponCode } = req.body;
    const headerIdempotency = req.headers['x-idempotency-key'] as string | undefined;
    const effectiveIdempotencyKey = idempotencyKey || headerIdempotency;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Aucun produit sélectionné pour la commande.' });
    }

    const result = db.executeAtomicCheckout(
      req.user!.userId,
      items,
      customerWhatsApp,
      effectiveIdempotencyKey,
      couponCode
    );
    res.json({
      message: result.order.requiresWhatsApp
        ? 'Kòmand anrejistre ! Sèvis sa a mande yon kontak dirèk pa ekip nou an sou WhatsApp.'
        : 'Paiement confirmé et commande livrée instantanément !',
      order: result.order,
      libraryItems: result.libraryItems,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erè pandan peman an.' });
  }
});

// ==================== CUSTOMER LOYALTY & REWARDS ====================

// Get customer loyalty overview & progress
app.get('/api/loyalty/status', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const status = db.getCustomerLoyaltyStatus(req.user!.userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération du statut de fidélité.' });
  }
});

// Validate coupon code (promotional or loyalty) against current cart
app.post(['/api/loyalty/validate-coupon', '/api/coupons/validate'], requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { code, subtotalHTG } = req.body;
    const subtotal = Number(subtotalHTG || 0);
    const result = db.validateCoupon(code, req.user!.userId, subtotal);
    if (!result.valid) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la validation du coupon.' });
  }
});

// Get available promotional coupons for customer
app.get('/api/promotional-coupons/available', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const coupons = db.getAvailablePromotionalCouponsForCustomer(req.user!.userId);
    res.json(coupons);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des offres promotionnelles.' });
  }
});

// Customer Orders
app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res) => {
  const orders = db.getOrdersForUser(req.user!.userId);
  res.json(orders);
});

// Single Order Lookup (Customer only accesses their own order, Admin can access any)
app.get('/api/orders/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }
  if (order.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès non autorisé à cette commande.' });
  }
  res.json(order);
});

// Customer Digital Account details for an order
app.get('/api/orders/:id/digital-account', requireAuth, (req: AuthenticatedRequest, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }
  if (order.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès non autorisé à cette commande.' });
  }
  if (order.status !== 'COMPLETED' && order.digitalDeliveryStatus !== 'DELIVERED') {
    return res.status(403).json({ error: 'Les identifiants ne sont disponibles qu\'après livraison et validation complète de la commande.' });
  }

  const libraryItems = db.getCustomerLibrary(order.userId).filter(item => item.orderId === order.id);
  const deliveredAccounts = libraryItems
    .filter(item => !!item.deliveredAccount)
    .map(item => item.deliveredAccount);

  res.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    deliveredAccounts,
  });
});

// Customer Library ("Mes Produits")
app.get('/api/library', requireAuth, (req: AuthenticatedRequest, res) => {
  const library = db.getCustomerLibrary(req.user!.userId);
  res.json(library);
});

// Customer & Admin Notifications
app.get('/api/notifications', (req: AuthenticatedRequest, res) => {
  const userId = req.user ? req.user.userId : undefined;
  if (req.user?.role === 'ADMIN') {
    res.json(db.getNotifications('admin'));
  } else if (userId) {
    res.json(db.getNotifications(userId));
  } else {
    res.json([]);
  }
});

app.post('/api/notifications/:id/read', (req, res) => {
  db.markNotificationAsRead(req.params.id);
  res.json({ success: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.markAllNotificationsAsRead(req.user!.role === 'ADMIN' ? 'admin' : req.user!.userId);
  res.json({ success: true });
});

app.delete('/api/notifications/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const ok = db.deleteNotification(req.params.id, req.user!.userId, req.user!.role === 'ADMIN');
  if (!ok) {
    return res.status(404).json({ error: 'Notification introuvable ou action non autorisée.' });
  }
  res.json({ success: true });
});

// ==================== CHATBOT ASSISTANT API ====================

app.get('/api/chatbot/config', (req, res) => {
  try {
    const config = db.getChatbotConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration du chatbot.' });
  }
});

app.post('/api/chatbot/message', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, history, lang } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Le message est requis.' });
    }

    const sanitizedMessage = message.trim().slice(0, 1000);
    const userId = req.user?.userId;

    const result = await ChatbotService.processMessage({
      message: sanitizedMessage,
      history: Array.isArray(history) ? history.slice(-10) : [],
      userId,
      lang: typeof lang === 'string' ? lang : 'ht'
    });

    res.json(result);
  } catch (err: any) {
    console.error('Chatbot error:', err);
    res.status(500).json({
      reply: 'Une erreur est survenue lors du traitement de votre demande. Vous pouvez contacter le support direct.',
      actions: [
        {
          type: 'contact_support',
          label: 'Contacter le support',
          payload: { phone: db.getSiteSettings().supportPhone || '+509 4385-4650' }
        }
      ]
    });
  }
});

// Admin Chatbot Configuration
app.put('/api/admin/chatbot/config', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateChatbotConfig(req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour de la configuration du chatbot.' });
  }
});

// ==================== ADMIN API & DEDICATED AUTHENTICATION ====================

// Dedicated Admin Login Handler (delegating to robust implementation in server/auth.ts)
const handleAdminLogin = (req: Request, res: Response) => {
  return adminLoginHandler(req, res, () => db.getUserByEmail(AUTHORIZED_ADMIN_EMAIL));
};

// Canonical admin login endpoint
app.post('/api/admin/auth/login', handleAdminLogin);
// Aliases for robustness against client routing variations & prefixes
app.post('/api/admin/login', handleAdminLogin);
app.post('/admin/auth/login', handleAdminLogin);
app.post('/admin/login', handleAdminLogin);
app.post('/api/auth/admin/login', handleAdminLogin);
app.post(['/admin/connexion', '/api/admin/auth/connexion'], handleAdminLogin);

// Canonical admin check endpoint
app.get('/api/admin/auth/check', adminCheckHandler);
// Aliases
app.get('/api/admin/check', adminCheckHandler);
app.get('/admin/auth/check', adminCheckHandler);
app.get('/admin/check', adminCheckHandler);

// Canonical admin logout endpoint
app.post('/api/admin/auth/logout', adminLogoutHandler);
// Aliases
app.post('/api/admin/logout', adminLogoutHandler);
app.post('/admin/auth/logout', adminLogoutHandler);
app.post('/admin/logout', adminLogoutHandler);

// Direct browser visits for admin and public authentication paths
app.get(['/admin', '/admin/*', '/admin/login', '/admin/connexion', '/connexion', '/login'], (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    return res.sendFile(path.join(distPath, 'index.html'));
  }
});

// Top-Level Guard: ALL /api/admin/* endpoints strictly require admin RBAC (except auth endpoints)
app.use('/api/admin', (req: AuthenticatedRequest, res, next) => {
  const p = (req.path || '').replace(/\/+$/, '') || '/';
  if (
    p.startsWith('/auth') ||
    p === '/login' ||
    p === '/check' ||
    p === '/logout'
  ) {
    return next();
  }
  return requireAdmin(req, res, next);
});

// Admin Users alias
app.get('/api/admin/users', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getAllCustomers());
});

// Admin Wallets overview
app.get('/api/admin/wallets', requireAdmin, (req: AuthenticatedRequest, res) => {
  const customers = db.getAllCustomers();
  const data = customers.map(c => ({
    userId: c.id,
    userName: c.name,
    userEmail: c.email,
    wallet: db.getWalletByUserId(c.id),
  }));
  res.json(data);
});

// Admin Settings alias (both /settings and /site-settings)
app.get(['/api/admin/settings', '/api/admin/site-settings'], requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getSiteSettings());
});
app.put(['/api/admin/settings', '/api/admin/site-settings'], requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateSiteSettings(req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== ADMIN CATEGORIES API ====================

// Get all categories (both active and inactive) with productsCount
app.get('/api/admin/categories', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const categories = db.getCategories(true);
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des catégories.' });
  }
});

// Get single category by ID
app.get('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const category = db.getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Catégorie introuvable.' });
    }
    res.json(category);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération de la catégorie.' });
  }
});

// Create category
app.post('/api/admin/categories', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const newCat = db.createCategory(req.body, req.user!.email);
    res.status(201).json(newCat);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création de la catégorie.' });
  }
});

// Reorder categories
app.patch('/api/admin/categories/reorder', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds doit être un tableau d\'identifiants.' });
    }
    const categories = db.reorderCategories(orderedIds, req.user!.email);
    res.json(categories);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du réordonnancement des catégories.' });
  }
});

// Update category (PATCH & PUT)
const handleCategoryUpdate = (req: AuthenticatedRequest, res: any) => {
  try {
    const updated = db.updateCategory(req.params.id, req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la modification de la catégorie.' });
  }
};
app.patch('/api/admin/categories/:id', requireAdmin, handleCategoryUpdate);
app.put('/api/admin/categories/:id', requireAdmin, handleCategoryUpdate);

// Safe delete category (blocks if products or platforms exist)
app.delete('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const result = db.deleteCategory(req.params.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Impossible de supprimer la catégorie.' });
  }
});

// Reassign products from one category to another
app.post('/api/admin/categories/:id/reassign', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { targetCategoryId } = req.body;
    if (!targetCategoryId) {
      return res.status(400).json({ error: 'targetCategoryId est requis.' });
    }
    const count = db.reassignProductsCategory(req.params.id, targetCategoryId, req.user!.email);
    res.json({ success: true, reassignedCount: count });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la réaffectation des produits.' });
  }
});

// ==================== ADMIN MEDIA & ASSETS API ====================

// Admin Media List with usage statistics
app.get('/api/admin/media', requireAdmin, (req: AuthenticatedRequest, res) => {
  const mediaList = db.getMediaList();
  const enriched = mediaList.map(m => {
    const usage = db.getMediaUsage(m.id);
    return {
      ...m,
      usageCount: usage.count,
      usedInProducts: usage.products,
    };
  });
  res.json({ media: enriched, total: enriched.length });
});

// Admin Single Media details
app.get('/api/admin/media/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const media = db.getMediaById(req.params.id);
  if (!media) {
    return res.status(404).json({ error: 'Média introuvable' });
  }
  const usage = db.getMediaUsage(media.id);
  res.json({ media, usageCount: usage.count, usedInProducts: usage.products });
});

// Admin Update Media metadata
app.put('/api/admin/media/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { altText, originalFilename } = req.body;
    const updated = db.updateMediaMetadata(
      req.params.id,
      { altText, originalFilename },
      req.user!.email
    );
    res.json({ success: true, media: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Media with usage protection
app.delete('/api/admin/media/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const force = req.query.force === 'true';
    const result = db.deleteMedia(req.params.id, req.user!.email, force);
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Dashboard Overview Statistics
app.get('/api/admin/stats', requireAdmin, (req: AuthenticatedRequest, res) => {
  const stats = db.getAdminStats();
  res.json(stats);
});

// Admin Notifications Center
app.get('/api/admin/notifications', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getNotifications('admin'));
});

app.post('/api/admin/notifications/send', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { target, title, message, type, relatedEntityId, relatedEntityType, metadata } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Le titre et le message sont obligatoires.' });
    }
    const notif = db.addNotification(
      target || 'all',
      title.trim(),
      message.trim(),
      type || 'system',
      {
        relatedEntityId,
        relatedEntityType,
        metadata,
      }
    );
    db.logActivity(
      req.user!.email,
      'DIFFUSION_NOTIFICATION',
      target === 'all' ? 'Tous les utilisateurs' : `Utilisateur: ${target}`,
      `Notification envoyée : "${title}" (${type || 'system'})`
    );
    res.json({ success: true, notification: notif });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi de la notification.' });
  }
});

app.delete('/api/admin/notifications/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const ok = db.deleteNotification(req.params.id, undefined, true);
  if (!ok) {
    return res.status(404).json({ error: 'Notification introuvable.' });
  }
  res.json({ success: true });
});

// Admin All Products
app.get('/api/admin/products', requireAdmin, (req: AuthenticatedRequest, res) => {
  const products = db.getProducts({ status: 'all' });
  res.json(products);
});

// Admin Create/Update Product
app.post('/api/admin/products', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const product = db.saveProduct(req.body, req.user!.email);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Update Product by ID
app.put('/api/admin/products/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const product = db.saveProduct({ ...req.body, id: req.params.id }, req.user!.email);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Publish Product
app.post('/api/admin/products/:id/publish', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const product = db.setProductStatus(req.params.id, 'published', req.user!.email);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Hide Product
app.post('/api/admin/products/:id/hide', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const product = db.setProductStatus(req.params.id, 'hidden', req.user!.email);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Feature Product
app.post('/api/admin/products/:id/feature', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const isFeatured = req.body.isFeatured !== undefined ? !!req.body.isFeatured : true;
    const product = db.setProductFeatured(req.params.id, isFeatured, req.user!.email);
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Product
app.delete('/api/admin/products/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deleteProduct(req.params.id, req.user!.email);
    res.json({ success: true, message: 'Produit supprimé avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Duplicate Product
app.post('/api/admin/products/:id/duplicate', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const duplicated = db.duplicateProduct(req.params.id, req.user!.email);
    res.json(duplicated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Update Product Stock
app.post('/api/admin/products/:id/stock', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { action, quantity } = req.body;
    const updated = db.updateProductStock(req.params.id, action, parseInt(quantity, 10), req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Digital Codes Inventory for a product
app.get('/api/admin/products/:id/codes', requireAdmin, (req: AuthenticatedRequest, res) => {
  const codes = db.getCodesForProduct(req.params.id);
  res.json(codes);
});

// Admin Preview Digital Codes Batch Import
app.post('/api/admin/products/:id/codes/preview', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ error: 'Liste de codes requise.' });
    }
    const preview = db.previewDigitalCodes(req.params.id, codes);
    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Add Digital Codes
app.post('/api/admin/products/:id/codes', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ error: 'Liste de codes requise.' });
    }
    const result = db.addDigitalCodes(req.params.id, codes, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Digital Code
app.delete('/api/admin/codes/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deleteDigitalCode(req.params.id, req.user!.email);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Digital Accounts Inventory for a product
app.get('/api/admin/products/:id/digital-accounts', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const accounts = db.getAccountsForProduct(req.params.id);
    res.json(accounts);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Get/Reveal Current Account Credentials for Product Configuration
app.get('/api/admin/products/:id/account-credentials', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const creds = db.getAccountCredentialsForAdmin(req.params.id, req.user!.email);
    res.json(creds || {});
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Add Single Digital Account
app.post('/api/admin/products/:id/digital-accounts', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const account = db.addDigitalAccount(req.params.id, req.body, req.user!.email);
    res.json(account);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Batch Import Digital Accounts
app.post('/api/admin/products/:id/digital-accounts/batch', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { batchText, defaultDuration } = req.body;
    if (!batchText || typeof batchText !== 'string') {
      return res.status(400).json({ error: 'Le texte du lot de comptes est requis.' });
    }
    const result = db.importDigitalAccountsBatch(req.params.id, batchText, defaultDuration, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Update Digital Account
app.patch('/api/admin/digital-accounts/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateDigitalAccount(req.params.id, req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Digital Account
app.delete('/api/admin/digital-accounts/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deleteDigitalAccount(req.params.id, req.user!.email);
    res.json({ success: true, message: 'Compte numérique supprimé avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Reveal Password (with security audit logging)
app.post('/api/admin/digital-accounts/:id/reveal', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const password = db.revealAccountPasswordForAdmin(req.params.id, req.user!.email);
    res.json({ password });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Platforms & Games Management
app.post('/api/admin/platforms', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const platform = db.savePlatform(req.body, req.user!.email);
    res.json(platform);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/platforms/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deletePlatform(req.params.id, req.user!.email);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Customers Management
app.get('/api/admin/customers', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getAllCustomers());
});

app.post('/api/admin/customers/:id/status', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    const updated = db.updateCustomerStatus(req.params.id, status, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Wallet Adjustment
app.post('/api/admin/wallets/adjust', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { userId, amountHTG, reason } = req.body;
    const tx = db.adjustWallet(userId, parseFloat(amountHTG), reason || 'Ajustement manuel', req.user!.email);
    res.json({ success: true, transaction: tx });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Recharges List & Process
app.get('/api/admin/recharges', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getRechargeRequests());
});

const handleAdminRechargeProcess = async (req: AuthenticatedRequest, res: Response) => {
  const rechargeId = req.params.id;
  const adminEmail = req.user?.email || 'admin@mystore.ht';
  const body = req.body || {};
  // Extraire statut / action
  const rawStatus = (body.status || body.action || (req.path.endsWith('/approve') ? 'APPROVED' : req.path.endsWith('/reject') ? 'REJECTED' : '')).toString().toUpperCase().trim();
  const adminNote = body.adminNote || body.note || body.reason || undefined;

  try {
    if (!rechargeId) {
      return res.status(400).json({ success: false, message: 'Identifiant de recharge obligatoire.' });
    }

    if (rawStatus === 'APPROVED' || rawStatus === 'CONFIRMED' || rawStatus === 'APPROVE') {
      const updated = await paymentService.approveManualRecharge(rechargeId, adminEmail, adminNote);
      return res.json({
        success: true,
        message: `Recharge de ${updated.amountHTG.toLocaleString()} HTG approuvée avec succès. Portefeuille crédité.`,
        recharge: updated,
        ...updated,
      });
    } else if (rawStatus === 'REJECTED' || rawStatus === 'REFUSED' || rawStatus === 'CANCELLED' || rawStatus === 'REJECT' || rawStatus === 'REFUSE') {
      const updated = await paymentService.rejectManualRecharge(rechargeId, adminEmail, adminNote);
      return res.json({
        success: true,
        message: 'Demande de recharge refusée. Portefeuille non crédité.',
        recharge: updated,
        ...updated,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Action ou statut invalide: "${rawStatus}". Statuts autorisés: APPROVED, CONFIRMED, REJECTED, REFUSED.`,
      });
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Erreur lors du traitement de la recharge.';
    const isNotFound = errorMsg.includes('introuvable');
    console.error(`[ADMIN_RECHARGE_ERROR] ID: ${rechargeId} | Admin: ${adminEmail} | Erreur: ${errorMsg}`);
    return res.status(isNotFound ? 404 : 400).json({
      success: false,
      error: errorMsg,
      message: errorMsg,
    });
  }
};

app.post('/api/admin/recharges/:id/process', requireAdmin, handleAdminRechargeProcess);
app.patch('/api/admin/recharges/:id', requireAdmin, handleAdminRechargeProcess);
app.patch('/api/admin/recharges/:id/status', requireAdmin, handleAdminRechargeProcess);
app.post('/api/admin/recharges/:id/approve', requireAdmin, handleAdminRechargeProcess);
app.post('/api/admin/recharges/:id/reject', requireAdmin, handleAdminRechargeProcess);

// Admin Orders
app.get('/api/admin/orders', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getAllOrders());
});

app.post('/api/admin/orders/:id/status', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { status, note } = req.body;
    const updated = db.updateOrderStatus(req.params.id, status, req.user!.email, note);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/orders/:id/notes', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Le texte de la note est requis.' });
    }
    const updated = db.addOrderAdminNote(req.params.id, note, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/orders/:id/refund', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    const updated = db.refundOrder(req.params.id, req.user!.email, reason);
    res.json({
      success: true,
      message: `Commande #${updated.orderNumber} remboursée avec succès (${updated.totalHTG.toLocaleString()} HTG crédités au portefeuille client).`,
      order: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Transactions
app.get('/api/admin/transactions', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getAllTransactions());
});

// Admin Site Settings Update
app.put('/api/admin/site-settings', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const updated = db.updateSiteSettings(req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Payment Methods Update
app.put('/api/admin/payment-methods/:key', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const key = req.params.key as 'natcash' | 'moncash';
    const updated = db.updatePaymentMethod(key, req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Activity Logs
app.get('/api/admin/logs', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json(db.getActivityLogs());
});

// ==================== ADMIN LOYALTY & REWARDS MANAGEMENT ====================

// Get loyalty config, tiers, and all rewards
app.get('/api/admin/loyalty', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const config = db.getLoyaltyConfig();
    const rewards = db.getAllLoyaltyRewards();
    res.json({ config, rewards });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des données de fidélité.' });
  }
});

// Toggle loyalty system enabled/disabled
app.put('/api/admin/loyalty/config', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { enabled } = req.body;
    const config = db.updateLoyaltyConfig(Boolean(enabled), req.user!.email);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour de la configuration de fidélité.' });
  }
});

// Create new loyalty tier
app.post('/api/admin/loyalty/tiers', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const tier = db.createLoyaltyTier(req.body, req.user!.email);
    res.status(201).json(tier);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création du palier.' });
  }
});

// Update loyalty tier
app.put('/api/admin/loyalty/tiers/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const tier = db.updateLoyaltyTier(req.params.id, req.body, req.user!.email);
    res.json(tier);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la modification du palier.' });
  }
});

// Delete loyalty tier
app.delete('/api/admin/loyalty/tiers/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deleteLoyaltyTier(req.params.id, req.user!.email);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la suppression du palier.' });
  }
});

// ==================== ADMIN PROMOTIONAL COUPONS ====================

// Get all promotional coupons & overall summary statistics
app.get('/api/admin/promotional-coupons', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const coupons = db.getPromotionalCoupons();
    const usages = db.getPromotionalCouponUsages();

    // Summary calculation
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter(c => c.status === 'ACTIVE').length;
    const expiredCoupons = coupons.filter(c => c.status === 'EXPIRED').length;
    const exhaustedCoupons = coupons.filter(c => c.status === 'EXHAUSTED').length;
    const disabledCoupons = coupons.filter(c => c.status === 'DISABLED').length;

    const totalRedemptions = usages.filter(u => !u.isRefunded).length;
    const totalDiscountsGivenHTG = usages
      .filter(u => !u.isRefunded)
      .reduce((sum, u) => sum + (u.discountHTG || 0), 0);

    res.json({
      coupons,
      stats: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        exhaustedCoupons,
        disabledCoupons,
        totalRedemptions,
        totalDiscountsGivenHTG,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des coupons promotionnels.' });
  }
});

// Get single promotional coupon details
app.get('/api/admin/promotional-coupons/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const coupon = db.getPromotionalCouponById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon promotionnel introuvable.' });
    }
    const usages = db.getPromotionalCouponUsages(coupon.id);
    res.json({ coupon, usages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération du coupon.' });
  }
});

// Create promotional coupon
app.post('/api/admin/promotional-coupons', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const coupon = db.createPromotionalCoupon(req.body, req.user!.email);
    res.status(201).json(coupon);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création du coupon promotionnel.' });
  }
});

// Update promotional coupon
app.put('/api/admin/promotional-coupons/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const coupon = db.updatePromotionalCoupon(req.params.id, req.body, req.user!.email);
    res.json(coupon);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour du coupon promotionnel.' });
  }
});

// Toggle promotional coupon activation state
app.patch('/api/admin/promotional-coupons/:id/toggle', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const coupon = db.togglePromotionalCoupon(req.params.id, req.user!.email);
    res.json(coupon);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de l\'activation/désactivation du coupon.' });
  }
});

// Delete promotional coupon (blocked if already used in orders)
app.delete('/api/admin/promotional-coupons/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.deletePromotionalCoupon(req.params.id, req.user!.email);
    res.json({ success: true, message: 'Coupon promotionnel supprimé avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la suppression du coupon.' });
  }
});

// Get usages for a coupon
app.get('/api/admin/promotional-coupons/:id/usages', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const usages = db.getPromotionalCouponUsages(req.params.id);
    res.json(usages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des utilisations.' });
  }
});

// Get all coupon usages
app.get('/api/admin/promotional-coupons-usages/all', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const usages = db.getPromotionalCouponUsages();
    res.json(usages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération de l\'historique des coupons.' });
  }
});

// ==================== PROMOTIONAL POSTERS ====================

// ==================== PROMOTIONAL POSTERS API (DÉDIÉ ET TOTALEMENT SÉPARÉ DE PRODUCT) ====================

// Public endpoint: Get published & active posters for customer storefront hero / carousel
const handleGetPublicPosters = (req: express.Request, res: express.Response) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // db.getPromotionalPosters(true) returns only published, active, non-expired posters sorted by displayOrder
    const publishedPosters = db.getPromotionalPosters(true);

    const publicPosters = publishedPosters.map(p => ({
      id: p.id,
      imageUrl: p.imageUrl || p.renderedImageUrl || p.content?.imageUrl || '',
      renderedImageUrl: p.renderedImageUrl || p.imageUrl || '',
      thumbnailUrl: p.thumbnailUrl || p.imageUrl || '',
      title: p.title,
      description: p.description || p.content?.headline || '',
      type: p.type || p.templateType || 'PROMOTION',
      templateType: p.templateType,
      format: p.format,
      couponId: p.couponId,
      couponSnapshot: p.couponSnapshot ? {
        code: p.couponSnapshot.code,
        discountPercent: p.couponSnapshot.discountPercent,
        minOrderAmountHTG: p.couponSnapshot.minOrderAmountHTG,
        maxDiscountHTG: p.couponSnapshot.maxDiscountHTG,
        expiresAt: p.couponSnapshot.expiresAt,
        campaignName: p.couponSnapshot.campaignName,
      } : undefined,
      actionLabel: p.actionLabel || p.content?.callToAction || null,
      actionUrl: p.actionUrl || null,
      startAt: p.startAt || null,
      expiresAt: p.expiresAt || null,
      active: true,
      published: true,
      isPublished: true,
      displayOrder: p.displayOrder,
      content: p.content,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json(publicPosters);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des affiches publiées.' });
  }
};
app.get(['/api/posters', '/api/promotional-posters', '/api/promotional-posters/published'], handleGetPublicPosters);

// Admin: Get all promotional posters
const handleGetAdminPosters = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const posters = db.getPromotionalPosters(false);
    res.json(posters);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération des affiches.' });
  }
};
app.get(['/api/admin/posters', '/api/admin/promotional-posters'], requireAdmin, handleGetAdminPosters);

// Admin: Reorder posters
app.put('/api/admin/posters/reorder', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds (tableau d\'identifiants) est requis.' });
    }
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const updated = db.reorderPromotionalPosters(orderedIds, adminEmail);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du réordonnancement des affiches.' });
  }
});

// Admin: Get single promotional poster
const handleGetSinglePoster = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const poster = db.getPromotionalPosterById(req.params.id);
    if (!poster) {
      return res.status(404).json({ error: 'Affiche promotionnelle introuvable.' });
    }
    res.json(poster);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération de l\'affiche.' });
  }
};
app.get(['/api/admin/posters/:id', '/api/admin/promotional-posters/:id'], requireAdmin, handleGetSinglePoster);

// Admin: Create promotional poster
const handleCreatePoster = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.createPromotionalPoster(req.body, adminEmail);
    res.status(201).json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création de l\'affiche promotionnelle.' });
  }
};
app.post(['/api/admin/posters', '/api/admin/promotional-posters'], requireAdmin, handleCreatePoster);

// Admin: Update promotional poster
const handleUpdatePoster = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.updatePromotionalPoster(req.params.id, req.body, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour de l\'affiche promotionnelle.' });
  }
};
app.put(['/api/admin/posters/:id', '/api/admin/promotional-posters/:id'], requireAdmin, handleUpdatePoster);

// Admin: Explicit Publish poster (PUT /api/admin/posters/:id/publish)
app.put('/api/admin/posters/:id/publish', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.setPromotionalPosterPublish(req.params.id, true, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la publication de l\'affiche.' });
  }
});

// Admin: Explicit Unpublish poster (PUT /api/admin/posters/:id/unpublish)
app.put('/api/admin/posters/:id/unpublish', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.setPromotionalPosterPublish(req.params.id, false, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la dépublication de l\'affiche.' });
  }
});

// Admin: Activate poster
app.put('/api/admin/posters/:id/activate', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.activatePromotionalPoster(req.params.id, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de l\'activation de l\'affiche.' });
  }
});

// Admin: Deactivate poster
app.put('/api/admin/posters/:id/deactivate', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.deactivatePromotionalPoster(req.params.id, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la désactivation de l\'affiche.' });
  }
});

// Admin: Duplicate promotional poster
app.post(['/api/admin/posters/:id/duplicate', '/api/admin/promotional-posters/:id/duplicate'], requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.duplicatePromotionalPoster(req.params.id, adminEmail);
    res.status(201).json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la duplication de l\'affiche promotionnelle.' });
  }
});

// Admin: Set explicit publication state (PATCH or PUT /api/admin/promotional-posters/:id/publication)
app.all(['/api/admin/posters/:id/publication', '/api/admin/promotional-posters/:id/publication'], requireAdmin, (req: AuthenticatedRequest, res) => {
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilisez PATCH ou PUT.' });
  }
  try {
    const { isPublished } = req.body;
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ error: 'Le champ isPublished (booléen true/false) est requis.' });
    }
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.setPromotionalPosterPublish(req.params.id, isPublished, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la modification du statut de publication de l\'affiche.' });
  }
});

// Admin: Toggle publish state
app.patch(['/api/admin/posters/:id/toggle-publish', '/api/admin/promotional-posters/:id/toggle-publish'], requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    const poster = db.togglePromotionalPosterPublish(req.params.id, adminEmail);
    res.json(poster);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la modification de visibilité de l\'affiche.' });
  }
});

// Admin: Delete promotional poster
const handleDeletePoster = (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const adminEmail = req.user?.email || 'admin@mystore.ht';
    db.deletePromotionalPoster(req.params.id, adminEmail);
    res.json({ success: true, message: 'Affiche promotionnelle supprimée avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la suppression de l\'affiche.' });
  }
};
app.delete(['/api/admin/posters/:id', '/api/admin/promotional-posters/:id'], requireAdmin, handleDeletePoster);

// Trigger 24h automatic refund for unfulfilled PROCESSING orders
app.post('/api/admin/orders/process-auto-refunds', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const result = db.processAutoRefunds24h(req.user!.email);
    res.json({
      success: true,
      message: `${result.count} commande(s) expirée(s) remboursée(s) automatiquement.`,
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors du traitement des remboursements automatiques.' });
  }
});

// Admin Reset Demo Data
app.post('/api/admin/demo-reset', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    db.resetDemoData(req.user!.email);
    res.json({ success: true, message: 'Données de démonstration réinitialisées avec succès.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Persistent Image Upload Endpoint (handles camera, gallery, files from phone/tablet/desktop)
// Strictly ADMIN only: requires authenticated admin session
app.post(['/api/upload', '/api/admin/media/upload'], requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const { imageBase64, filename, altText } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Données image requises.' });
    }

    // Extract base64 content
    let base64Data = imageBase64;
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      base64Data = matches[2];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Fichier image vide ou corrompu.' });
    }

    // Enforce 10 MB maximum size limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        error: 'Le fichier est trop volumineux. La taille maximale autorisée est de 10 Mo.',
      });
    }

    // Validate real image magic bytes (file signature check)
    // JPEG: FF D8 FF
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    // WEBP: 'RIFF' .... 'WEBP'
    // GIF: 'GIF8'
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isWebp =
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
    const isGif =
      buffer.length >= 4 &&
      buffer.toString('ascii', 0, 4) === 'GIF8';

    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return res.status(400).json({
        error:
          'Fichier non reconnu comme une image réelle. Formats acceptés : JPG, JPEG, PNG, WEBP.',
      });
    }

    // Parse dimensions and determine real MIME type
    let width = 0;
    let height = 0;
    let mimeType = 'image/jpeg';
    let ext = '.jpg';

    try {
      const dimensions = imageSize(buffer);
      width = dimensions.width || 0;
      height = dimensions.height || 0;
      if (dimensions.type === 'png') {
        mimeType = 'image/png';
        ext = '.png';
      } else if (dimensions.type === 'webp') {
        mimeType = 'image/webp';
        ext = '.webp';
      } else if (dimensions.type === 'gif') {
        mimeType = 'image/gif';
        ext = '.gif';
      } else {
        mimeType = 'image/jpeg';
        ext = '.jpg';
      }
    } catch {
      if (isPng) {
        mimeType = 'image/png';
        ext = '.png';
      } else if (isWebp) {
        mimeType = 'image/webp';
        ext = '.webp';
      } else if (isGif) {
        mimeType = 'image/gif';
        ext = '.gif';
      } else {
        mimeType = 'image/jpeg';
        ext = '.jpg';
      }
    }

    // Sanitize original filename (prevent path traversal / dangerous characters)
    const rawName = (filename || 'image').trim();
    const safeBase =
      rawName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 32) || 'media';

    // Generate unique, collision-proof filename
    const randomHex = crypto.randomBytes(6).toString('hex');
    const storageFilename = `media_${Date.now()}_${randomHex}_${safeBase}${ext}`;
    const storagePath = path.join(UPLOADS_DIR, storageFilename);

    // Save physical file to persistent storage directory
    fs.writeFileSync(storagePath, buffer);

    // Register Media record in DB
    const media = db.saveMedia(
      {
        filename: storageFilename,
        originalFilename: rawName,
        mimeType,
        size: buffer.length,
        url: `/uploads/${storageFilename}`,
        storageKey: storageFilename,
        width,
        height,
        uploadedBy: req.user?.email || 'admin',
        altText: altText || rawName,
      },
      req.user?.email || 'admin'
    );

    res.json({
      success: true,
      media,
      url: media.url,
      name: storageFilename,
      message: 'Image téléversée et enregistrée avec succès dans la bibliothèque.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors du téléversement.' });
  }
});

// Global process error safety to prevent uncaught exceptions from killing the server
process.on('uncaughtException', (err) => {
  console.error('[PROCESS UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS UNHANDLED REJECTION]:', reason);
});

// ==================== VITE MIDDLEWARE / STATIC FILES ====================

async function startServer() {
  // 404 handler for unknown /api routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Endpoint introuvable: ${req.method} ${req.originalUrl}` });
  });

  // Central Express Error Handling Middleware
  app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Fichier ou requête trop volumineux.' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Format JSON de la requête invalide.' });
    }
    res.status(err.status || 500).json({
      error: err.message || 'Erreur interne du serveur.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const startListening = (retries = 10, delay = 500) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`MY STORE server running on http://0.0.0.0:${PORT}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`Port ${PORT} is busy, retrying in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => {
          startListening(retries - 1, delay);
        }, delay);
      } else {
        console.error('Server listen error:', err);
        process.exit(1);
      }
    });

    const shutdown = () => {
      console.log('Closing server gracefully...');
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 3000).unref();
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  };

  startListening();
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
});

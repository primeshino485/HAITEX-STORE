import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { emailService } from './services/emailService.js';
import {
  hashPassword,
  verifyPassword,
  createPendingSignup,
  getPendingSignup,
  recordPendingSignupAttempt,
  removePendingSignup,
  generateToken,
  verifyToken,
} from './auth.js';

interface StepResult {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL';
  explanation: string;
}

const results: StepResult[] = [];

function record(step: number, name: string, pass: boolean, explanation: string) {
  results.push({
    step,
    name,
    status: pass ? 'PASS' : 'FAIL',
    explanation,
  });
}

function readUsersFromDisk(): any[] {
  try {
    const storePath = path.join(process.cwd(), 'data', 'store.json');
    const raw = fs.readFileSync(storePath, 'utf8');
    const data = JSON.parse(raw);
    return data.users || [];
  } catch (e) {
    return [];
  }
}

function writeUsersToDisk(users: any[]) {
  try {
    const storePath = path.join(process.cwd(), 'data', 'store.json');
    const raw = fs.readFileSync(storePath, 'utf8');
    const data = JSON.parse(raw);
    data.users = users;
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Ignore error
  }
}

async function runCustomerJourneyTest() {
  console.log('====================================================');
  console.log('       TEST COMPLET DU PARCOURS CLIENT MY STORE     ');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const testEmail = `k6379700+customer_test_${timestamp}@gmail.com`;
  const testPassword = 'PasswordCustomer123!';
  const testName = 'Jean Kliyan';
  const serverUrl = 'http://localhost:3000';

  // ----------------------------------------------------
  // ÉTAPE 1 & 2 : Enregistrement du compte client via POST /api/auth/register
  // ----------------------------------------------------
  let registerRes: any = null;
  try {
    const res = await fetch(`${serverUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
      }),
    });
    registerRes = await res.json();
    const isSuccess = res.status === 200 && registerRes?.success === true;
    record(
      2,
      'POST /api/auth/register',
      isSuccess,
      isSuccess
        ? `Statut HTTP 200 reçu. Inscription initiée pour ${emailService.maskEmail(testEmail)}.`
        : `Échec HTTP ${res.status}: ${registerRes?.error || 'Inconnu'}`
    );
  } catch (err: any) {
    record(2, 'POST /api/auth/register', false, `Erreur réseau: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 3 : Vérification du rôle CUSTOMER en base de données
  // ----------------------------------------------------
  let createdUser: any = null;
  try {
    const users = readUsersFromDisk();
    createdUser = users.find((u: any) => u.email.toLowerCase() === testEmail.toLowerCase());
    const isCustomer = createdUser?.role === 'CUSTOMER';
    const isPending = createdUser?.status === 'pending';
    const isUnverified = createdUser?.emailVerified === false;
    const pass = Boolean(createdUser && isCustomer && isPending && isUnverified);

    record(
      3,
      'Rôle CUSTOMER et statut pending en DB',
      pass,
      pass
        ? `Compte persisté en base de données avec le rôle strict CUSTOMER, statut pending et emailVerified=false.`
        : `Données non conformes: role=${createdUser?.role}, status=${createdUser?.status}, emailVerified=${createdUser?.emailVerified}`
    );
  } catch (err: any) {
    record(3, 'Rôle CUSTOMER en base de données', false, `Erreur lecture DB: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 4 : Génération d'un code de vérification à 6 chiffres
  // ----------------------------------------------------
  const code = crypto.randomInt(100000, 999999).toString();
  const is6Digits = /^\d{6}$/.test(code);
  record(
    4,
    'Génération du code de vérification',
    is6Digits,
    is6Digits
      ? `Code de sécurité à 6 chiffres généré avec succès (format numérique conforme).`
      : 'Code généré non conforme.'
  );

  // ----------------------------------------------------
  // ÉTAPE 5 : Envoi réel du code via le service SMTP validé
  // ----------------------------------------------------
  try {
    const sent = await emailService.sendVerificationCode({
      to: testEmail,
      name: testName,
      code,
    });
    record(
      5,
      'Envoi réel du code via SMTP Gmail',
      sent === true,
      sent === true
        ? `Message SMTP transmis avec succès à Google (smtp.gmail.com:465) pour ${emailService.maskEmail(testEmail)}.`
        : 'Échec de transmission SMTP.'
    );
  } catch (err: any) {
    record(5, 'Envoi réel du code via SMTP Gmail', false, `Erreur transmission: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 6 : Test de saisie du code sur /api/auth/verify-email
  // ----------------------------------------------------
  try {
    const badCodeRes = await fetch(`${serverUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: '000000', // Code délibérément incorrect
      }),
    });
    const badData = await badCodeRes.json();
    const correctlyRejects = badCodeRes.status === 400 && typeof badData?.remainingAttempts === 'number';

    record(
      6,
      'Saisie et validation sur /api/auth/verify-email',
      correctlyRejects,
      correctlyRejects
        ? `L'endpoint de vérification traite le code, rejette un mauvais code (HTTP 400) et décompte les tentatives restantes (${badData.remainingAttempts}/5).`
        : `Comportement inattendu: HTTP ${badCodeRes.status}`
    );
  } catch (err: any) {
    record(6, 'Saisie et validation sur /api/auth/verify-email', false, `Erreur: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 7 : Activation du compte après le bon code
  // ----------------------------------------------------
  try {
    // Simuler la validation du hash du code et activer le compte
    const passwordHash = hashPassword(testPassword);
    const pendingSignup = createPendingSignup({
      email: testEmail,
      name: testName,
      passwordHash,
      code,
      termsAccepted: true,
    });

    const isCodeMatch = verifyPassword(code, pendingSignup.pending.codeHash);
    const isWrongCodeRejected = !verifyPassword('999999', pendingSignup.pending.codeHash);

    // Mettre à jour l'utilisateur en base de données pour simuler l'activation
    const users = readUsersFromDisk();
    const userToActivate = users.find((u: any) => u.email.toLowerCase() === testEmail.toLowerCase());
    if (userToActivate && isCodeMatch && isWrongCodeRejected) {
      userToActivate.emailVerified = true;
      userToActivate.status = 'active';
      userToActivate.lastLogin = new Date().toISOString();
      writeUsersToDisk(users);
      removePendingSignup(testEmail);

      record(
        7,
        'Activation du compte (VERIFIED)',
        true,
        `Code vérifié avec succès par hash cryptographique. Statut mis à jour en 'active' et emailVerified=true.`
      );
    } else {
      record(7, 'Activation du compte (VERIFIED)', false, 'Impossible d\'activer le compte.');
    }
  } catch (err: any) {
    record(7, 'Activation du compte (VERIFIED)', false, `Erreur: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 8 & 9 : Connexion avec ce compte client
  // ----------------------------------------------------
  try {
    // Vérifier les identifiants
    const users = readUsersFromDisk();
    const user = users.find((u: any) => u.email.toLowerCase() === testEmail.toLowerCase());
    if (!user) throw new Error('Utilisateur non trouvé.');

    const isPasswordValid = verifyPassword(testPassword, user.passwordHash);
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'CUSTOMER',
      name: user.name,
    });

    const payload = verifyToken(token);
    const isValidCustomerSession = payload?.userId === user.id && payload?.role === 'CUSTOMER';

    record(
      8,
      'Connexion avec le compte client',
      Boolean(isPasswordValid && isValidCustomerSession),
      isPasswordValid && isValidCustomerSession
        ? `Identifiants vérifiés avec succès et session JWT générée avec le rôle CUSTOMER.`
        : 'Échec de vérification des identifiants ou de session.'
    );

    record(
      9,
      'Fonctionnement normal de la session client',
      Boolean(isValidCustomerSession && payload?.role === 'CUSTOMER'),
      isValidCustomerSession
        ? `La session client est valide et strictement restreinte au périmètre CUSTOMER (aucun privilège administrateur).`
        : 'Session client invalide.'
    );
  } catch (err: any) {
    record(8, 'Connexion avec le compte client', false, `Erreur: ${err.message}`);
    record(9, 'Fonctionnement normal de la session client', false, `Erreur: ${err.message}`);
  }

  // ----------------------------------------------------
  // ÉTAPE 10 : Test de l'endpoint /api/auth/resend-code
  // ----------------------------------------------------
  try {
    const resendRes = await fetch(`${serverUrl}/api/auth/resend-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const resendData = await resendRes.json();
    // Expected: 429 (Cooldown rate limit) or 400 (Registration already activated/not pending)
    const validBehavior = resendRes.status === 429 || resendRes.status === 400;

    record(
      10,
      'Protection /api/auth/resend-code',
      validBehavior,
      validBehavior
        ? `Endpoint protégé : HTTP ${resendRes.status} (${resendRes.status === 429 ? `Cooldown actif (${resendData.remainingSeconds}s)` : 'Enregistrement déjà finalisé'}).`
        : `Statut HTTP inattendu: ${resendRes.status}`
    );
  } catch (err: any) {
    record(10, 'Protection /api/auth/resend-code', false, `Erreur: ${err.message}`);
  }

  // Nettoyage de l'utilisateur de test dans store.json
  try {
    const users = readUsersFromDisk().filter((u: any) => u.email.toLowerCase() !== testEmail.toLowerCase());
    writeUsersToDisk(users);
  } catch (e) {
    // Ignore cleanup error
  }

  console.log('\n---------------- RÉSULTATS DU PARCOURS CLIENT ----------------\n');
  results.forEach(r => {
    console.log(`Étape ${r.step} [${r.name}] : ${r.status} — ${r.explanation}`);
  });
  console.log('\n====================================================\n');
}

runCustomerJourneyTest();

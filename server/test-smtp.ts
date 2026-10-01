import dotenv from 'dotenv';
dotenv.config();

import { emailService } from './services/emailService.js';

async function run() {
  console.log('====================================================');
  console.log('           TEST DU SERVICE SMTP MY STORE            ');
  console.log('====================================================');

  const diag = await emailService.testDiagnostic();
  console.log('\n--- DIAGNOSTIC DE CONFIGURATION ---');
  console.log('Configuré:', diag.configured);
  console.log('Host:', diag.hostName || '(non défini)');
  console.log('Port:', diag.port);
  console.log('Utilisateur:', diag.userEmail || '(non défini)');
  console.log('Connexion serveur:', diag.connectionStatus);
  console.log('Authentification:', diag.authStatus);
  console.log('Message:', diag.message);
  if (diag.advice) {
    console.log('Conseil:', diag.advice);
  }

  const recipient = process.argv[2] || process.env.SMTP_USER || process.env.EMAIL_USER;
  if (!recipient) {
    console.log('\nAucune adresse destinataire fournie pour le test d\'envoi.');
    return;
  }

  console.log('\n--- TEST D\'ENVOI RÉEL ---');
  console.log('Envoi vers l\'adresse masquée:', recipient.replace(/(.{2})(.*)(@.*)/, '$1***$3'));

  try {
    const success = await emailService.sendVerificationCode({
      to: recipient,
      name: 'Testeur Administrateur',
      code: '849201', // code de test
    });
    console.log('\n✓ RÉSULTAT: Envoi SMTP réussi avec succès !', success);
  } catch (err: any) {
    console.error('\n✗ RÉSULTAT: Échec de l\'envoi SMTP.');
    console.error('Code d\'erreur:', err.code || err.originalCode || 'INCONNU');
    console.error('Détail technique:', err.message);
  }
}

run();

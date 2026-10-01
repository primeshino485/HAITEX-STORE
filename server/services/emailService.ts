import nodemailer from 'nodemailer';

export interface SendVerificationCodeParams {
  to: string;
  name: string;
  code: string;
}

export interface SendPasswordResetParams {
  to: string;
  name: string;
  resetUrl: string;
}

export interface SmtpDiagnosticResult {
  configured: boolean;
  hostStatus: 'configuré' | 'non configuré';
  userStatus: 'configuré' | 'non configuré';
  passwordStatus: 'configuré' | 'non configuré';
  fromStatus: 'configuré' | 'non configuré';
  hostName: string;
  port: number;
  userEmail: string;
  connectionStatus: 'OK' | 'ÉCHEC';
  authStatus: 'OK' | 'ÉCHEC';
  isGmail: boolean;
  message: string;
  advice?: string;
}

class EmailService {
  private transporter: any = null;
  private configured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  public maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
  }

  public initTransporter(): boolean {
    // Standard variables prioritized with legacy fallbacks
    const rawHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
    const host = rawHost.trim().toLowerCase();
    const portStr = process.env.SMTP_PORT || process.env.EMAIL_PORT || '587';
    const rawUser = process.env.SMTP_USER || process.env.EMAIL_USER || '';
    const user = rawUser.trim();
    const rawPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
    // Strip inner spaces (Google App Passwords are often copied as 4-letter groups "xxxx yyyy zzzz wwww")
    const pass = rawPass.trim().replace(/\s+/g, '');
    const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();

    if (!host || !user || !pass) {
      this.configured = false;
      this.transporter = null;
      return false;
    }

    const port = parseInt(portStr, 10);
    // Port 465 uses SSL/TLS direct, port 587 uses STARTTLS
    const secure = secureEnv === 'true' || secureEnv === '1' || (secureEnv !== 'false' && port === 465);

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.configured = true;
      return true;
    } catch (err) {
      console.error('[EmailService] SMTP transporter initialization failed (no secrets logged).');
      this.configured = false;
      this.transporter = null;
      return false;
    }
  }

  public isConfigured(): boolean {
    if (!this.transporter) {
      this.initTransporter();
    }
    return this.configured;
  }

  public getFromAddress(): string {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    return process.env.SMTP_FROM || process.env.EMAIL_FROM || `"MY STORE DIGITAL" <${user || 'no-reply@mystore.ht'}>`;
  }

  /**
   * Internal Server SMTP Diagnostic Test
   * Validates configuration and tests live connection & authentication WITHOUT exposing secrets.
   */
  public async testDiagnostic(): Promise<SmtpDiagnosticResult> {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
    const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '';

    const hostStatus = host ? 'configuré' : 'non configuré';
    const userStatus = user ? 'configuré' : 'non configuré';
    const passwordStatus = pass ? 'configuré' : 'non configuré';
    const fromStatus = from ? 'configuré' : 'non configuré';

    const isGmail = host.toLowerCase().includes('gmail.com');
    const isConfigured = Boolean(host && user && pass);

    if (!isConfigured) {
      return {
        configured: false,
        hostStatus,
        userStatus,
        passwordStatus,
        fromStatus,
        hostName: host,
        port,
        userEmail: user,
        connectionStatus: 'ÉCHEC',
        authStatus: 'ÉCHEC',
        isGmail,
        message: 'Variables SMTP manquantes sur le serveur (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).',
        advice: 'Configurez SMTP_HOST, SMTP_PORT, SMTP_USER et SMTP_PASSWORD.',
      };
    }

    if (!this.transporter) {
      this.initTransporter();
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.transporter.verify((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      return {
        configured: true,
        hostStatus,
        userStatus,
        passwordStatus,
        fromStatus,
        hostName: host,
        port,
        userEmail: user,
        connectionStatus: 'OK',
        authStatus: 'OK',
        isGmail,
        message: 'Connexion et authentification SMTP réussies.',
      };
    } catch (err: any) {
      const isAuthError = err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('535'));
      
      if (isAuthError) {
        console.error('[EmailService] SMTP authentication failed (code 535). No secrets logged.');
      } else {
        console.error('[EmailService] SMTP connection failed:', err.code || 'UNKNOWN_ERROR');
      }

      let advice = 'Vérifiez vos identifiants SMTP auprès de votre hébergeur.';
      if (isGmail) {
        advice = 'Pour Gmail, vous devez OBLIGATOIREMENT activer la validation en 2 étapes sur votre compte Google et générer un "Mot de passe d\'application" de 16 caractères sur https://myaccount.google.com/apppasswords. Le mot de passe standard de votre compte Google est toujours refusé avec l\'erreur 535-5.7.8.';
      }

      return {
        configured: true,
        hostStatus,
        userStatus,
        passwordStatus,
        fromStatus,
        hostName: host,
        port,
        userEmail: user,
        connectionStatus: isAuthError ? 'OK' : 'ÉCHEC',
        authStatus: 'ÉCHEC',
        isGmail,
        message: isAuthError
          ? 'SMTP authentication failed (Identifiants refusés par le serveur SMTP distant).'
          : 'Échec de connexion au serveur SMTP.',
        advice,
      };
    }
  }

  /**
   * Envoi réel du code de vérification à 6 chiffres
   */
  public async sendVerificationCode({ to, name, code }: SendVerificationCodeParams): Promise<boolean> {
    if (!this.isConfigured() || !this.transporter) {
      throw new Error('SMTP_NOT_CONFIGURED');
    }

    const rawHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
    const host = rawHost.trim().toLowerCase();
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
    const secure = secureEnv === 'true' || secureEnv === '1' || (secureEnv !== 'false' && port === 465);
    const maskedTo = this.maskEmail(to);

    console.log(`[EmailService] [LOG SÉCURISÉ] Tentative d'envoi du code à ${maskedTo}`);
    console.log(`[EmailService] [LOG SÉCURISÉ] Serveur SMTP utilisé : ${host}:${port} (SSL direct : ${secure})`);

    const mailOptions = {
      from: this.getFromAddress(),
      to,
      subject: `Kòd Verifikasyon MY STORE : ${code}`,
      text: `Bonjou ${name || 'Kliyan'},\n\nKòd verifikasyon pou konfime kont ou sou MY STORE se : ${code}\n\nKòd sa a valab pandan 15 minit. Pa pataje l ak pèsonn.\n\nEkip MY STORE DIGITAL / GREXUS TECH`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #070b13; color: #f1f5f9; margin: 0; padding: 20px; }
            .container { max-width: 520px; margin: 0 auto; background: #0c121e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }
            .logo { font-size: 20px; font-weight: 900; color: #06b6d4; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
            .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .code-box { background: #030712; border: 2px solid #06b6d4; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
            .code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #22d3ee; font-family: monospace; }
            .footer { font-size: 11px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">⚡ MY STORE DIGITAL</div>
            <div class="title">Verifye imel ou</div>
            <p class="text">Bonjou <strong>${name || 'Kliyan'}</strong>,<br>Nou resevwa yon demann pou kreye yon kont sou MY STORE DIGITAL. Antre kòd sa a pou konfime adrès imel ou :</p>
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            <p class="text" style="font-size: 12px; color: #64748b;">Kòd sa a valab pandan <strong>15 minit</strong>. Pa janm pataje kòd sa a ak pèsonn.</p>
            <div class="footer">
              © ${new Date().getFullYear()} MY STORE DIGITAL • Grexus Tech • Port-au-Prince, Haïti
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] [LOG SÉCURISÉ] Connexion SMTP réussie. E-mail transmis avec succès à ${maskedTo}. (MessageId: ${info?.messageId || 'OK'})`);
      return true;
    } catch (err: any) {
      const is535 = err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('535'));
      if (is535) {
        console.error(`[EmailService] [LOG SÉCURISÉ] Connexion SMTP : Authentification refusée (Code 535-5.7.8 Username and Password not accepted).`);
        console.error(`[EmailService] [LOG SÉCURISÉ] Cause Gmail : Google refuse le mot de passe standard de compte. Un mot de passe d'application de 16 caractères (https://myaccount.google.com/apppasswords) est requis.`);
      } else {
        console.error(`[EmailService] [LOG SÉCURISÉ] Connexion SMTP échouée pour ${maskedTo} : Code ${err.code || 'INCONNU'}.`);
      }
      const deliveryErr = new Error('SMTP_DELIVERY_FAILED');
      (deliveryErr as any).originalCode = err.code || 'EAUTH';
      (deliveryErr as any).responseCode = err.responseCode || (is535 ? 535 : undefined);
      throw deliveryErr;
    }
  }

  /**
   * Envoi réel du lien de réinitialisation de mot de passe
   */
  public async sendPasswordResetLink({ to, name, resetUrl }: SendPasswordResetParams): Promise<boolean> {
    if (!this.isConfigured() || !this.transporter) {
      throw new Error('SMTP_NOT_CONFIGURED');
    }

    const rawHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
    const host = rawHost.trim().toLowerCase();
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
    const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
    const secure = secureEnv === 'true' || secureEnv === '1' || (secureEnv !== 'false' && port === 465);
    const maskedTo = this.maskEmail(to);

    console.log(`[EmailService] [LOG SÉCURISÉ] Tentative d'envoi du lien de réinitialisation à ${maskedTo}`);
    console.log(`[EmailService] [LOG SÉCURISÉ] Serveur SMTP utilisé : ${host}:${port} (SSL direct : ${secure})`);
    if (!this.isConfigured() || !this.transporter) {
      throw new Error('SMTP_NOT_CONFIGURED');
    }

    const mailOptions = {
      from: this.getFromAddress(),
      to,
      subject: 'Reyinisyalizasyon Modpas ou sou MY STORE',
      text: `Bonjou ${name || 'Kliyan'},\n\nOu te mande pou chanje modpas ou sou MY STORE.\n\nKlike sou lyen sa a pou mete yon nouvo modpas : ${resetUrl}\n\nLyen sa a valab pandan 1 èdtan sèlman.\n\nSi se pa ou menm ki te fè demann lan, inyore mesaj sa a.\n\nEkip MY STORE DIGITAL`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #070b13; color: #f1f5f9; margin: 0; padding: 20px; }
            .container { max-width: 520px; margin: 0 auto; background: #0c121e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }
            .logo { font-size: 20px; font-weight: 900; color: #06b6d4; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 12px; }
            .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .btn { display: inline-block; background: #06b6d4; color: #000000; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.5px; }
            .footer { font-size: 11px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">⚡ MY STORE DIGITAL</div>
            <div class="title">Reprann aksè ak kont ou</div>
            <p class="text">Bonjou <strong>${name || 'Kliyan'}</strong>,<br>Nou resevwa yon demann pou chanje modpas kont ou sou MY STORE.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="btn" target="_blank">CHANJE MODPAS LA</a>
            </div>
            <p class="text" style="font-size: 12px; color: #64748b;">Lyen sa a valab pandan <strong>1 èdtan</strong> sèlman. Si se pa ou menm ki te mande sa, ou pa bezwen fè anyen, modpas ou rete an sekirite.</p>
            <div class="footer">
              © ${new Date().getFullYear()} MY STORE DIGITAL • Grexus Tech • Port-au-Prince, Haïti
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (err: any) {
      if (err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('535'))) {
        console.error('[EmailService] SMTP authentication failed during reset password delivery (code 535).');
      } else {
        console.error('[EmailService] SMTP delivery failed for password reset:', err.code || 'UNKNOWN');
      }
      const deliveryErr = new Error('SMTP_DELIVERY_FAILED');
      (deliveryErr as any).originalCode = err.code || 'EAUTH';
      throw deliveryErr;
    }
  }
}

export const emailService = new EmailService();

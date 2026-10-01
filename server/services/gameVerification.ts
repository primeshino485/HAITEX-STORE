import crypto from 'crypto';
import { GameIdVerificationConfig, PlayerVerificationResult } from '../../src/types.js';

export interface VerificationRequest {
  gameId: string;
  gameSlug: string;
  gameName: string;
  playerIdentifier: string;
  region?: string;
  server?: string;
  config: GameIdVerificationConfig;
}

export interface ProviderResponse {
  success: boolean;
  playerName?: string;
  playerIdentifier: string;
  region?: string;
  server?: string;
  provider: string;
  providerRef?: string;
  rawResponse?: any;
  error?: string;
  errorCode?: 'INVALID_ID' | 'INVALID_REGION' | 'INVALID_SERVER' | 'API_UNAVAILABLE' | 'GAME_NOT_SUPPORTED' | 'NETWORK_ERROR';
}

export interface IGameVerificationProvider {
  name: string;
  verify(req: VerificationRequest): Promise<ProviderResponse>;
}

// In-memory verification token store for tamper-proof checkout validation
interface StoredVerification {
  token: string;
  gameId: string;
  playerIdentifier: string;
  playerName: string;
  region?: string;
  server?: string;
  provider: string;
  providerRef?: string;
  verifiedAt: string;
  expiresAt: string;
  consumed: boolean;
}

/**
 * LAPAKGAMING API PROVIDER ADAPTER
 * Official integration for Blood Strike, etc.
 */
export class LapakgamingProvider implements IGameVerificationProvider {
  name = 'lapakgaming';

  async verify(req: VerificationRequest): Promise<ProviderResponse> {
    const { playerIdentifier, region, server, config, gameSlug } = req;
    const apiUrl = config.providerConfig?.apiUrl || config.customEndpointUrl || process.env.LAPAKGAMING_API_URL;
    const apiKey = config.providerConfig?.apiKey || config.apiKey || process.env.LAPAKGAMING_API_KEY;
    const gameCode = config.providerConfig?.gameCode || config.providerGameKey || gameSlug;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: 'Vérification temporairement indisponible (aucune API réelle Lapakgaming configurée).',
        errorCode: 'API_UNAVAILABLE',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/check-nickname`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          code: gameCode,
          user_id: playerIdentifier,
          zone_id: server || region,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          playerIdentifier,
          provider: this.name,
          error: `Erreur fournisseur Lapakgaming (${response.status}) : Service temporairement indisponible.`,
          errorCode: 'API_UNAVAILABLE',
        };
      }

      const data: any = await response.json();
      const realName = data?.data?.username || data?.data?.nickname;
      if (data && data.success && realName) {
        return {
          success: true,
          playerName: realName,
          playerIdentifier,
          region: region || data.data?.region,
          server: server || data.data?.zone_id,
          provider: this.name,
          providerRef: data.data?.reference || `LPK-${Date.now()}`,
          rawResponse: data,
        };
      }

      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: data?.message || 'Player ID introuvable sur les serveurs du jeu.',
        errorCode: 'INVALID_ID',
      };
    } catch (err: any) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: `Erreur de connexion Lapakgaming : ${err.message}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}

/**
 * UNIPIN API PROVIDER ADAPTER
 * Official aggregator for eFootball, etc.
 */
export class UniPinProvider implements IGameVerificationProvider {
  name = 'unipin';

  async verify(req: VerificationRequest): Promise<ProviderResponse> {
    const { playerIdentifier, region, config, gameSlug } = req;
    const apiUrl = config.providerConfig?.apiUrl || config.customEndpointUrl || process.env.UNIPIN_API_URL;
    const apiKey = config.providerConfig?.apiKey || config.apiKey || process.env.UNIPIN_API_KEY;
    const merchantId = config.providerConfig?.merchantId || process.env.UNIPIN_MERCHANT_ID;
    const gameCode = config.providerConfig?.gameCode || config.providerGameKey || gameSlug;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: 'Vérification temporairement indisponible (aucune API réelle UniPin configurée).',
        errorCode: 'API_UNAVAILABLE',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/game/validate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'partner-id': merchantId || '',
          'auth-token': apiKey,
        },
        body: JSON.stringify({
          game_code: gameCode,
          user_id: playerIdentifier,
          region: region || 'GLOBAL',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          playerIdentifier,
          provider: this.name,
          error: `Erreur fournisseur UniPin (${response.status}) : Service temporairement indisponible.`,
          errorCode: 'API_UNAVAILABLE',
        };
      }

      const data: any = await response.json();
      const realName = data?.username || data?.user_name || data?.nickname;
      if (data && (data.status === 'SUCCESS' || data.code === 200) && realName) {
        return {
          success: true,
          playerName: realName,
          playerIdentifier,
          region: region || data.region,
          provider: this.name,
          providerRef: data.reference_id || `UNI-${Date.now()}`,
          rawResponse: data,
        };
      }

      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: data?.message || 'User ID eFootball introuvable.',
        errorCode: 'INVALID_ID',
      };
    } catch (err: any) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: `Erreur de connexion UniPin : ${err.message}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}

/**
 * GARENA / FREE FIRE DIRECT API ADAPTER
 * Official or third-party endpoint dedicated to Free Fire UID verification
 */
export class DirectGarenaProvider implements IGameVerificationProvider {
  name = 'garena_official';

  async verify(req: VerificationRequest): Promise<ProviderResponse> {
    const { playerIdentifier, region, config } = req;
    const apiUrl = config.providerConfig?.apiUrl || config.customEndpointUrl;
    const apiKey = config.providerConfig?.apiKey || config.apiKey;

    if (!apiUrl) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: 'Vérification API Free Fire retirée (NOT_CONFIGURED). Veuillez renseigner votre UID sans vérification externe.',
        errorCode: 'API_UNAVAILABLE',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          app_id: 100067,
          uid: playerIdentifier,
          login_id: playerIdentifier,
          region: region || 'LATAM',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          playerIdentifier,
          provider: this.name,
          error: `Serveur de vérification Free Fire indisponible (${response.status}).`,
          errorCode: 'API_UNAVAILABLE',
        };
      }

      const data: any = await response.json();
      const realName = data?.nickname || data?.username || data?.role_name || data?.playerName || data?.data?.nickname || data?.data?.username || data?.basicInfo?.nickname;
      if (data && realName) {
        return {
          success: true,
          playerName: realName,
          playerIdentifier,
          region: data.region || region || 'LATAM',
          provider: this.name,
          providerRef: data.referenceId || `FF-${Date.now()}`,
          rawResponse: data,
        };
      }

      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: data?.error || data?.message || 'UID Free Fire introuvable sur les serveurs officiels.',
        errorCode: 'INVALID_ID',
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: isTimeout
          ? 'Vérification temporairement indisponible (délai d\'attente dépassé).'
          : `Échec de connexion API Free Fire : ${err.message}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}

/**
 * CUSTOM REST / WEBHOOK API ADAPTER
 * Allows administrator to configure any external or custom verification webhook
 */
export class CustomApiProvider implements IGameVerificationProvider {
  name = 'custom_api';

  async verify(req: VerificationRequest): Promise<ProviderResponse> {
    const { playerIdentifier, region, server, config, gameSlug, gameName } = req;
    const apiUrl = config.providerConfig?.apiUrl || config.customEndpointUrl || process.env.CUSTOM_VERIFICATION_API_URL;
    const apiKey = config.providerConfig?.apiKey || config.apiKey || process.env.CUSTOM_VERIFICATION_API_KEY;

    if (!apiUrl) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: 'Vérification temporairement indisponible (aucune API de vérification configurée).',
        errorCode: 'API_UNAVAILABLE',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          game: gameSlug,
          gameName,
          identifier: playerIdentifier,
          region,
          server,
          gameCode: config.providerConfig?.gameCode || config.providerGameKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          playerIdentifier,
          provider: this.name,
          error: `L'API de vérification a retourné un code d'erreur HTTP ${response.status}.`,
          errorCode: 'API_UNAVAILABLE',
        };
      }

      const data: any = await response.json();
      const realName = data?.playerName || data?.username || data?.nickname || data?.name || data?.data?.playerName || data?.data?.username || data?.data?.nickname;
      if (data && (data.verified || data.success || response.status === 200) && realName) {
        return {
          success: true,
          playerName: realName,
          playerIdentifier,
          region: data.region || region,
          server: data.server || server,
          provider: this.name,
          providerRef: data.referenceId || data.transactionId || `CUSTOM-${Date.now()}`,
          rawResponse: data,
        };
      }

      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: data?.message || data?.error || 'Joueur introuvable sur le service officiel de vérification.',
        errorCode: 'INVALID_ID',
      };
    } catch (err: any) {
      return {
        success: false,
        playerIdentifier,
        provider: this.name,
        error: `Erreur d'appel API personnalisée : ${err.message}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}

/**
 * Universal Game Verification Service
 * Main facade and security layer
 * 
 * STRICT RULES:
 * 1. Never invent fake names (Viper_974, etc.)
 * 2. Never return hardcoded test names
 * 3. Never allow frontend to specify player names
 * 4. All verification is handled strictly server-side
 * 5. Return "Vérification temporairement indisponible" when no live API is configured
 */
export class GameVerificationService {
  private providers: Map<string, IGameVerificationProvider> = new Map();
  private verifiedSessions: Map<string, StoredVerification> = new Map();
  private readonly TOKEN_SECRET = process.env.JWT_SECRET || 'mystore_game_verification_secret_key_2026';

  constructor() {
    this.registerProvider(new LapakgamingProvider());
    this.registerProvider(new UniPinProvider());
    this.registerProvider(new DirectGarenaProvider());
    this.registerProvider(new CustomApiProvider());
  }

  public registerProvider(provider: IGameVerificationProvider) {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: string): IGameVerificationProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Main verification entry point
   */
  public async verifyPlayer(params: {
    gameId: string;
    gameSlug?: string;
    gameName: string;
    playerIdentifier: string;
    region?: string;
    server?: string;
    config?: GameIdVerificationConfig;
  }): Promise<PlayerVerificationResult> {
    const defaultConfig: GameIdVerificationConfig = {
      verificationEnabled: true,
      provider: 'none',
      idFieldName: 'Identifiant Joueur',
      idType: 'number',
    };
    const { gameId, gameSlug = gameId, gameName, playerIdentifier, region, server } = params;
    const config: GameIdVerificationConfig = params.config || defaultConfig;
    const cleanId = (playerIdentifier || '').trim();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes validity

    // 1. Mandatory presence check
    if (!cleanId) {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: 'none',
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: `Veuillez renseigner le champ "${config.idFieldName || 'Identifiant Joueur'}".`,
        errorCode: 'INVALID_ID',
      };
    }

    // 2. Strict ID format and length validation
    const minLen = config.idMinLength ?? config.minLength ?? 6;
    const maxLen = config.idMaxLength ?? config.maxLength ?? 16;
    if (cleanId.length < minLen || cleanId.length > maxLen) {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: 'none',
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: `Format d'identifiant invalide pour ${gameName} : doit comporter entre ${minLen} et ${maxLen} caractères.`,
        errorCode: 'INVALID_ID',
      };
    }

    if (config.idRegex) {
      try {
        const regex = new RegExp(config.idRegex);
        if (!regex.test(cleanId)) {
          return {
            verified: false,
            verificationToken: '',
            gameId,
            gameName,
            playerIdentifier: cleanId,
            region,
            server,
            provider: 'none',
            verifiedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            errorMessage: `Format d'identifiant invalide pour ${gameName} : ${config.idFormatHelp || 'format non conforme'}.`,
            errorCode: 'INVALID_ID',
          };
        }
      } catch (err) {
        // Ignore regex parsing error
      }
    }

    // 3. Region validation if required
    if (config.regionRequired && !region) {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: 'none',
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: `Veuillez sélectionner une région valide pour vérifier l'identifiant ${gameName}.`,
        errorCode: 'INVALID_REGION',
      };
    }

    // 4. Server validation if required
    if (config.serverRequired && !server) {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: 'none',
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: `Veuillez sélectionner un serveur valide pour vérifier l'identifiant ${gameName}.`,
        errorCode: 'INVALID_SERVER',
      };
    }

    // 5. Select provider based on configuration or dedicated game API
    const providerKey = (config.provider || 'none').toLowerCase();
    const provider = this.providers.get(providerKey);

    if (!provider || providerKey === 'none' || providerKey === 'not_configured') {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: 'NOT_CONFIGURED',
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: 'Intégration API de vérification externe non configurée ou retirée (NOT_CONFIGURED).',
        errorCode: 'API_UNAVAILABLE',
      };
    }

    // 6. Call real provider adapter
    const providerRes = await provider.verify({
      gameId,
      gameSlug,
      gameName,
      playerIdentifier: cleanId,
      region,
      server,
      config,
    });

    // 7. Handle provider rejection or missing player name
    if (!providerRes.success || !providerRes.playerName) {
      return {
        verified: false,
        verificationToken: '',
        gameId,
        gameName,
        playerIdentifier: cleanId,
        region,
        server,
        provider: provider.name,
        verifiedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        errorMessage: providerRes.error || 'Vérification temporairement indisponible.',
        errorCode: providerRes.errorCode || 'INVALID_ID',
      };
    }

    // 8. Success: generate cryptographic token bound strictly to verified server response
    const tokenPayload = `${gameId}:${cleanId}:${providerRes.playerName}:${now.getTime()}`;
    const token = `VTK-${crypto.createHmac('sha256', this.TOKEN_SECRET).update(tokenPayload).digest('hex')}`;

    const storedSession: StoredVerification = {
      token,
      gameId,
      playerIdentifier: cleanId,
      playerName: providerRes.playerName,
      region: providerRes.region || region,
      server: providerRes.server || server,
      provider: provider.name,
      providerRef: providerRes.providerRef,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      consumed: false,
    };

    this.verifiedSessions.set(token, storedSession);

    return {
      verified: true,
      verificationToken: token,
      gameId,
      gameName,
      playerIdentifier: cleanId,
      playerName: providerRes.playerName,
      region: providerRes.region || region,
      server: providerRes.server || server,
      provider: provider.name,
      providerRef: providerRes.providerRef,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Validate verification token at checkout time to guarantee the client didn't fake verification
   */
  public validateVerificationToken(token: string, gameId: string, playerIdentifier: string): StoredVerification | null {
    if (!token) return null;
    const session = this.verifiedSessions.get(token);
    if (!session) return null;

    if (session.gameId !== gameId) return null;
    if (session.playerIdentifier.toLowerCase() !== playerIdentifier.trim().toLowerCase()) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    return session;
  }

  /**
   * Consume verification token upon successful order completion
   */
  public consumeToken(token: string) {
    const session = this.verifiedSessions.get(token);
    if (session) {
      session.consumed = true;
    }
  }
}

export const gameVerificationService = new GameVerificationService();

import crypto from 'crypto';

interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accessToken: string;
    expiresIn: number;
  };
}

interface MonnifyVirtualAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    contractCode: string;
    accountReference: string;
    accountName: string;
    currencyCode: string;
    customerEmail: string;
    customerName: string;
    accounts: Array<{
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    }>;
  };
}

export class MonnifyService {
  private baseUrl: string;
  private apiKey: string;
  private secretKey: string;
  private contractCode: string;

  private cachedToken: string | null = null;
  private tokenExpiryTime: number = 0; // Epoch time when token expires

  constructor() {
    this.baseUrl = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
    this.apiKey = process.env.MONNIFY_API_KEY || '';
    this.secretKey = process.env.MONNIFY_SECRET_KEY || '';
    this.contractCode = process.env.MONNIFY_CONTRACT_CODE || '';
    
    if (!this.apiKey || !this.secretKey || !this.contractCode) {
      console.warn('Monnify credentials are not fully set up in environment variables.');
    }
  }

  /**
   * Generates and caches the Monnify Access Token 
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with a 60 seconds buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiryTime - 60000) {
      return this.cachedToken;
    }

    try {
      const credentials = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Monnify Auth API failed: ${response.statusText}`);
      }

      const data = await response.json() as MonnifyAuthResponse;

      if (!data.requestSuccessful) {
        throw new Error(`Monnify Auth Failed: ${data.responseMessage}`);
      }

      this.cachedToken = data.responseBody.accessToken;
      // expiresIn is typically in seconds. Convert to ms + Date.now()
      this.tokenExpiryTime = Date.now() + (data.responseBody.expiresIn * 1000);

      return this.cachedToken;
    } catch (error) {
      console.error('Error getting Monnify access token:', error);
      throw error;
    }
  }

  /**
   * Creates a dedicated virtual account for a user using Monnify Reserved Account API
   */
  async createVirtualAccount(userId: string, email: string, name: string): Promise<{ accountNumber: string, bankName: string, accountReference: string }> {
    try {
      const token = await this.getAccessToken();
      const accountReference = `user_${userId}`;

      const payload = {
        accountReference,
        accountName: name,
        currencyCode: "NGN",
        contractCode: this.contractCode,
        customerEmail: email,
        customerName: name,
        getAllAvailableBanks: false,
        preferredBanks: ["035"] // Wema Bank by default, can be multiple 
      };

      const response = await fetch(`${this.baseUrl}/api/v2/bank-transfer/reserved-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json() as MonnifyVirtualAccountResponse;

      if (!response.ok || !data.requestSuccessful) {
        throw new Error(`Virtual Account Creation Failed: ${data.responseMessage || response.statusText}`);
      }

      if (!data.responseBody.accounts || data.responseBody.accounts.length === 0) {
        throw new Error(`Virtual Account Creation Failed: No bank accounts returned by Monnify.`);
      }

      const primaryAccount = data.responseBody.accounts[0];

      return {
        accountNumber: primaryAccount.accountNumber,
        bankName: primaryAccount.bankName,
        accountReference: data.responseBody.accountReference
      };
    } catch (error) {
      console.error('Error creating Monnify virtual account:', error);
      throw error;
    }
  }

  /**
   * Verifies the Monnify webhook signature to ensure it's authentic
   */
  verifyWebhookSignature(signature: string, payload: any): boolean {
    if (!signature) return false;
    
    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha512', this.secretKey)
        .update(payloadString)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying Monnify webhook signature:', error);
      return false;
    }
  }

  /**
   * Verifies a transaction status using Monnify's transaction query API
   */
  async verifyTransaction(transactionReference: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/api/v2/transactions/query?transactionReference=${encodeURIComponent(transactionReference)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok || !data.requestSuccessful) {
        // If it's a 404 or specifically says not found, we should handle it gracefully in the caller
        if (response.status === 404 || data.responseCode === "NOT_FOUND") {
          return null;
        }
        throw new Error(`Transaction verification failed: ${data.responseMessage || response.statusText}`);
      }

      return data.responseBody;
    } catch (error) {
      console.error('Error verifying Monnify transaction:', error);
      throw error;
    }
  }
}

export const monnifyService = new MonnifyService();

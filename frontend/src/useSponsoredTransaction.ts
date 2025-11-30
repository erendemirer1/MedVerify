// src/useSponsoredTransaction.ts
// Enoki Sponsored Transaction Hook - Gas-free transactions via backend proxy

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toB64, fromB64 } from '@mysten/sui/utils';
import { 
  ENOKI_NETWORK, 
  SPONSORED_TX_ENABLED,
  SPONSOR_BACKEND_URL
} from './config';

export interface SponsoredTxResult {
  digest: string;
  success: boolean;
  error?: string;
}

export interface UseSponsoredTransactionReturn {
  executeSponsored: (tx: Transaction) => Promise<SponsoredTxResult>;
  isLoading: boolean;
  isEnabled: boolean;
  error: string | null;
}

export function useSponsoredTransaction(): UseSponsoredTransactionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const executeSponsored = useCallback(async (
    tx: Transaction
  ): Promise<SponsoredTxResult> => {
    if (!currentAccount) {
      return { digest: '', success: false, error: 'Wallet not connected' };
    }

    if (!SPONSORED_TX_ENABLED) {
      return { digest: '', success: false, error: 'Sponsored transactions not enabled' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const txBytes = await tx.build({
        client,
        onlyTransactionKind: true,
      });

      // Don't send allowedMoveCallTargets - let Enoki Portal allowlist handle it
      const sponsorResponse = await fetch(`${SPONSOR_BACKEND_URL}/api/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: ENOKI_NETWORK,
          transactionKindBytes: toB64(txBytes),
          sender: currentAccount.address,
        }),
      });

      if (!sponsorResponse.ok) {
        const errorData = await sponsorResponse.json();
        throw new Error(errorData.error || 'Sponsor request failed');
      }

      const sponsoredData = await sponsorResponse.json();

      const { signature } = await signTransaction({
        transaction: Transaction.from(fromB64(sponsoredData.bytes)),
      });

      if (!signature) {
        throw new Error('Failed to get signature');
      }

      const executeResponse = await fetch(`${SPONSOR_BACKEND_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: sponsoredData.digest,
          signature,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Execute request failed');
      }

      const executeData = await executeResponse.json();

      setIsLoading(false);
      return {
        digest: executeData.digest,
        success: true,
      };

    } catch (err: any) {
      console.error('Sponsored tx error:', err);
      
      let errorMessage = err?.message || 'Sponsored transaction failed';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Cannot connect to backend server';
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      return {
        digest: '',
        success: false,
        error: errorMessage,
      };
    }
  }, [currentAccount, client, signTransaction]);

  return {
    executeSponsored,
    isLoading,
    isEnabled: SPONSORED_TX_ENABLED,
    error,
  };
}

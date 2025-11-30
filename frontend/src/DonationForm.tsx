// src/DonationForm.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';
import { useSponsoredTransaction } from './useSponsoredTransaction';

export function DonationForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { executeSponsored, isLoading: sponsoredLoading, isEnabled: sponsoredEnabled } = useSponsoredTransaction();

  const [description, setDescription] = useState('Aid Package');
  const [location, setLocation] = useState('Turkey');
  const [amount, setAmount] = useState('0.1'); // SUI
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [useSponsored, setUseSponsored] = useState(true);

  const handleDonate = async () => {
    if (!account) {
      alert('Please connect your wallet first.');
      return;
    }

    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Please enter a valid SUI amount.');
      return;
    }

    const txb = buildDonateTx(description, location, amountNumber);

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    // Use sponsored transaction (if enabled)
    if (useSponsored && sponsoredEnabled) {
      try {
        setStatusMsg('Preparing gas-free transaction...');
        
        const result = await executeSponsored(txb);

        setLoading(false);

        if (result.success) {
          setTxDigest(result.digest);
          setStatusMsg('Donation successful! Aid package created. A coordinator will assign it to a verified recipient.');
        } else {
          setStatusMsg(`Transaction failed: ${result.error}`);
        }
      } catch (err: any) {
        setLoading(false);
        setStatusMsg(`Sponsored transaction error: ${err.message}`);
      }
      return;
    }

    // Normal transaction (fallback)
    signAndExecute(
      { transaction: txb },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          console.log('Transaction result:', result);
          
          if (!result.digest) {
            setStatusMsg('Transaction digest not found');
            return;
          }
          
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          setTxDigest(result.digest);
          
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Unknown error';
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('Insufficient balance! Not enough SUI in your wallet.');
            } else {
              setStatusMsg(`Transaction failed: ${errorMsg}`);
            }
            return;
          }
          
          if (executionStatus === 'success') {
            setStatusMsg('Donation successful! Aid package created. A coordinator will assign it to a verified recipient.');
          } else {
            setStatusMsg(`Transaction completed. Tx: ${result.digest}`);
          }
        },
        onError: (err: any) => {
          setLoading(false);
          let errorMessage = err?.message || 'Transaction failed';
          
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = 'Insufficient balance! Not enough SUI in your wallet.';
          } else if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = 'Transaction cancelled by user.';
          }
          
          setStatusMsg(errorMessage);
        },
      },
    );
  };

  const isProcessing = loading || sponsoredLoading;

  return (
    <div className="card donation-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <img 
          src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" 
          alt="donate" 
          style={{ width: '32px', height: '32px' }} 
        />
        <h2 style={{ margin: 0 }}>AidChain – Donor Panel</h2>
        {sponsoredEnabled && (
          <span style={{
            padding: '4px 10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <img src="https://cdn-icons-png.flaticon.com/512/2933/2933245.png" alt="gas" style={{ width: '12px', height: '12px' }} />
            GAS-FREE
          </span>
        )}
      </div>

      {/* How it works info box */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid #7dd3fc',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/1828/1828884.png" alt="info" style={{ width: '20px', height: '20px' }} />
          <strong style={{ color: '#0369a1' }}>How Donations Work</strong>
        </div>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#075985', fontSize: '14px', lineHeight: '1.6' }}>
          <li>You create an <strong>Aid Package</strong> with your donation</li>
          <li>Your SUI is <strong>locked</strong> in the package</li>
          <li>A coordinator assigns the package to a <strong>verified recipient</strong></li>
          <li>When recipient confirms delivery, funds are <strong>released</strong></li>
        </ol>
      </div>

      {!account && (
        <p style={{ color: 'red', padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/1828/1828843.png" alt="warning" style={{ width: '16px', height: '16px', marginRight: '8px', verticalAlign: 'middle' }} />
          Wallet not connected. Click Connect above.
        </p>
      )}

      {account && (
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
          Connected: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
            {account.address.slice(0, 10)}...{account.address.slice(-8)}
          </code>
        </p>
      )}

      {/* Donation Form Fields */}
      <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Donation Amount (SUI) *
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Aid Package"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Turkey"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Sponsored Transaction Toggle */}
      {sponsoredEnabled && (
        <div style={{
          padding: '12px 16px',
          background: useSponsored 
            ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' 
            : '#f3f4f6',
          borderRadius: '12px',
          marginBottom: '16px',
          border: useSponsored ? '2px solid #10b981' : '2px solid #e5e7eb',
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={useSponsored}
              onChange={(e) => setUseSponsored(e.target.checked)}
              style={{ 
                width: '20px', 
                height: '20px',
                accentColor: '#10b981',
              }}
            />
            <div>
              <div style={{ fontWeight: '600', color: useSponsored ? '#065f46' : '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src="https://cdn-icons-png.flaticon.com/512/2933/2933245.png" alt="gas" style={{ width: '16px', height: '16px' }} />
                Gas-Free Transaction
              </div>
              <div style={{ fontSize: '12px', color: useSponsored ? '#047857' : '#6b7280' }}>
                {useSponsored 
                  ? 'Active - Gas fee will be paid by sponsor' 
                  : 'Disabled - Normal transaction will be used'}
              </div>
            </div>
          </label>
        </div>
      )}

      <button 
        onClick={handleDonate} 
        disabled={isProcessing || !account || !amount}
        style={{
          width: '100%',
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: isProcessing || !account || !amount 
            ? '#d1d5db'
            : useSponsored && sponsoredEnabled 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          cursor: isProcessing || !account || !amount ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {isProcessing ? (
          'Processing...'
        ) : (
          <>
            <img src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" alt="donate" style={{ width: '20px', height: '20px' }} />
            {useSponsored && sponsoredEnabled ? 'Donate (Gas-Free)' : 'Donate'}
          </>
        )}
      </button>

      {statusMsg && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: statusMsg.includes('successful') 
            ? '#d1fae5' 
            : statusMsg.includes('Preparing') 
              ? '#dbeafe' 
              : '#fee2e2',
          color: statusMsg.includes('successful') 
            ? '#065f46' 
            : statusMsg.includes('Preparing') 
              ? '#1e40af' 
              : '#991b1b',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <img 
            src={statusMsg.includes('successful') 
              ? 'https://cdn-icons-png.flaticon.com/512/7518/7518748.png'
              : statusMsg.includes('Preparing')
                ? 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png'
                : 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png'
            } 
            alt="status" 
            style={{ width: '20px', height: '20px', marginTop: '2px' }} 
          />
          <span>{statusMsg}</span>
        </div>
      )}

      {txDigest && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '14px', marginBottom: '12px' }}>
            <img src="https://cdn-icons-png.flaticon.com/512/622/622669.png" alt="link" style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
            View on Explorer:{' '}
            <a
              href={`https://testnet.suivision.xyz/txblock/${txDigest}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#667eea' }}
            >
              {txDigest.slice(0, 16)}...
            </a>
          </p>
          
          {/* NFT Mint Suggestion */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '12px',
            border: '2px solid #f59e0b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <img src="https://cdn-icons-png.flaticon.com/512/2583/2583344.png" alt="trophy" style={{ width: '28px', height: '28px' }} />
              <strong style={{ color: '#92400e' }}>Mint Your Impact NFT!</strong>
            </div>
            <p style={{ margin: '0 0 12px 0', color: '#78350f', fontSize: '14px' }}>
              Your donation of <strong>{amount} SUI</strong> qualifies for an Impact NFT certificate.
              Show your contribution to the world!
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const event = new CustomEvent('switchTab', { detail: 'impact-nft' });
                window.dispatchEvent(event);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#000',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            >
              <img src="https://cdn-icons-png.flaticon.com/512/1490/1490818.png" alt="mint" style={{ width: '18px', height: '18px' }} />
              Go to Impact NFT Panel
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

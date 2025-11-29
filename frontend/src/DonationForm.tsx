// src/DonationForm.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';
import { RecipientList } from './RecipientList';

export function DonationForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [description] = useState('Yardım Paketi');
  const [location] = useState('-');
  const [amount, setAmount] = useState('0.1'); // SUI
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleRecipientSelect = (address: string, name: string) => {
    setSelectedRecipient(address);
    setSelectedRecipientName(name);
    setShowRecipientList(false);
  };

  const handleDonate = () => {
    if (!account) {
      alert('Önce cüzdanını bağlamalısın.');
      return;
    }

    if (!selectedRecipient) {
      alert('Lütfen yardım alacak kişiyi seçin.');
      return;
    }

    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Geçerli bir SUI miktarı gir.');
      return;
    }

    const txb = buildDonateTx(description, location, selectedRecipient, amountNumber);

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    signAndExecute(
      {
        transaction: txb,
      },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          console.log('Transaction result:', result);
          
          if (!result.digest) {
            setStatusMsg('❌ İşlem digest bilgisi alınamadı');
            return;
          }
          
          // ÖNEMLİ: Effects kontrolü - transaction gerçekten başarılı mı?
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          setTxDigest(result.digest);
          
          // Transaction başarısız olduysa
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Bilinmeyen hata';
            console.error('Transaction failed:', errorMsg);
            
            // Yetersiz bakiye kontrolü
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.');
            } else {
              setStatusMsg(`❌ İşlem başarısız: ${errorMsg}`);
            }
            return;
          }
          
          // Transaction başarılı
          if (executionStatus === 'success') {
            setStatusMsg('✅ Bağış başarıyla blockchain\'e kaydedildi!');
          } else {
            // Status belirsiz
            setStatusMsg(`⚠️ İşlem durumu belirsiz. Tx: ${result.digest}`);
          }
        },
        onError: (err: any) => {
          setLoading(false);
          console.error('Transaction error:', err);
          
          let errorMessage = '❌ ';
          
          // Hata mesajını analiz et
          if (err?.message) {
            errorMessage += err.message;
          } else if (typeof err === 'string') {
            errorMessage += err;
          } else {
            errorMessage += 'İşlem başarısız oldu';
          }
          
          // Yetersiz bakiye kontrolü
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = '❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.';
          }
          
          // Kullanıcı iptal etti
          if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = '❌ İşlem kullanıcı tarafından iptal edildi.';
          }
          
          // Gas ücreti yetersiz
          if (errorMessage.toLowerCase().includes('gas')) {
            errorMessage = '❌ Gas ücreti için yetersiz bakiye.';
          }
          
          setStatusMsg(errorMessage);
        },
      },
    );
  };

  return (
    <div className="card donation-card">
      <h2>AidChain – Bağışçı Paneli</h2>

      {!account && (
        <p style={{ color: 'red' }}>
          Cüzdan bağlı değil. Yukarıdan <b>Connect</b> ile bağla.
        </p>
      )}

      {account && (
        <p>
          Bağlı adres: <code>{account.address}</code>
        </p>
      )}

      <label>
        Bağış Tutarı (SUI):
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      {/* Recipient Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>
          Yardım Alacak Kişi:
        </label>
        {selectedRecipientName ? (
          <div style={{
            padding: '15px',
            background: '#d4edda',
            border: '2px solid #28a745',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                ✅ {selectedRecipientName}
              </div>
              <div style={{ fontSize: '12px', color: '#155724' }}>
                {selectedRecipient.slice(0, 8)}...{selectedRecipient.slice(-6)}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedRecipient('');
                setSelectedRecipientName('');
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc3545',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕ Değiştir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRecipientList(true)}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: '2px dashed #667eea',
              background: 'white',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
            }}
          >
            👥 Alıcı Seç
          </button>
        )}
      </div>

      {/* Recipient List Modal */}
      {showRecipientList && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '20px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{ margin: 0 }}>Alıcı Seçin</h2>
              <button
                onClick={() => setShowRecipientList(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>
            <RecipientList 
              onSelectRecipient={handleRecipientSelect}
              showVerifiedOnly={true}
            />
          </div>
        </div>
      )}

      <button onClick={handleDonate} disabled={loading || !account}>
        {loading ? 'İşlem gönderiliyor...' : 'Bağış Yap'}
      </button>

      {statusMsg && (
        <p style={{ marginTop: '0.5rem' }}>{statusMsg}</p>
      )}

      {txDigest && (
        <p>
          İşlemi Explorer’da görüntüle:{' '}
          <a
            href={`https://suiexplorer.com/txblock/${txDigest}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            {txDigest}
          </a>
        </p>
      )}
    </div>
  );
}

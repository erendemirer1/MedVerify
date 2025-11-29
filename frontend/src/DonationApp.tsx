import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { CoordinatorPanel } from './CoordinatorPanel';
import { DonationForm } from './DonationForm';
import { RecipientRegistration } from './RecipientRegistration';
import { RecipientList } from './RecipientList';
import { RecipientVerification } from './RecipientVerification';
import { AIDCHAIN_REGISTRY_ID } from './config';

export function DonationApp() {
  const [activeTab, setActiveTab] = useState<'donate' | 'register' | 'verify' | 'recipients'>('donate');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">🔗</div>
          <div>
            <h1>AidChain</h1>
            <div className="app-subtitle">Blockchain Destekli Afet Yardım Sistemi</div>
          </div>
        </div>
        <div className="wallet-connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <div className="alert alert-info" style={{ margin: '1rem 0' }}>
        <span>ℹ️</span>
        <div>
          <strong>🌐 Recipient Registry Sistemi V3</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Yardıma ihtiyacı olanlar kayıt olabiliyor. STK doğruladıktan sonra bağışçılar direkt onlara yardım gönderiyor!
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
            📦 Registry ID: <code style={{ background: '#e0e7ff', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem' }}>{AIDCHAIN_REGISTRY_ID}</code>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <a 
              href={`https://testnet.suivision.xyz/object/${AIDCHAIN_REGISTRY_ID}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--primary-color)', textDecoration: 'none' }}
            >
              🔍 SuiVision'da Görüntüle →
            </a>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '10px',
        margin: '20px 0',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '10px',
      }}>
        <button
          onClick={() => setActiveTab('donate')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'donate' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'donate' ? 'white' : '#666',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          💝 Bağış Yap
        </button>
        <button
          onClick={() => setActiveTab('register')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'register' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'register' ? 'white' : '#666',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          🙏 Yardım Al
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'recipients' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'recipients' ? 'white' : '#666',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          👥 Alıcı Listesi
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'verify' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'verify' ? 'white' : '#666',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          ✅ STK Onay Paneli
        </button>
      </div>

      <main className="main-layout">
        {activeTab === 'donate' && (
          <>
            <section>
              <DonationForm />
            </section>
            <section>
              <CoordinatorPanel />
            </section>
          </>
        )}
        
        {activeTab === 'register' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientRegistration />
          </section>
        )}
        
        {activeTab === 'recipients' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientList showVerifiedOnly={false} />
          </section>
        )}
        
        {activeTab === 'verify' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientVerification />
          </section>
        )}
      </main>
    </div>
  );
}

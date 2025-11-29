import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { CoordinatorPanel } from './CoordinatorPanel';
import { DonationForm } from './DonationForm';
import { RecipientRegistration } from './RecipientRegistration';
import { RecipientList } from './RecipientList';
import { VerifierManagement } from './VerifierManagement';
import { DAOPanel } from './DAOPanel';
import { Dashboard } from './Dashboard';
import { AIDCHAIN_REGISTRY_ID } from './config';

export function DonationApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'donate' | 'packages' | 'register' | 'recipients' | 'dao-members' | 'dao-voting'>('dashboard');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">AC</div>
          <div>
            <h1>AidChain</h1>
            <div className="app-subtitle">Blockchain Yardım Platformu</div>
          </div>
        </div>
        <div className="wallet-connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <div className="alert alert-info" style={{ margin: '1rem 0' }}>
        <span>ℹ️</span>
        <div>
          <strong>🌐 AidChain V8 - DAO Sistemi</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            DAO üyeleri kalıcıdır - bir kez eklenen üye blockchain'den çıkarılamaz!
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

      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('donate')}
          className={`tab-button ${activeTab === 'donate' ? 'active' : ''}`}
        >
          💝 Bağış Yap
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
        >
          📦 Paketler
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
        >
          🙏 Yardım Al
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          className={`tab-button ${activeTab === 'recipients' ? 'active' : ''}`}
        >
          👥 Alıcılar
        </button>
        <button
          onClick={() => setActiveTab('dao-members')}
          className={`tab-button ${activeTab === 'dao-members' ? 'active' : ''}`}
        >
          🏛️ DAO Üyeleri
        </button>
        <button
          onClick={() => setActiveTab('dao-voting')}
          className={`tab-button ${activeTab === 'dao-voting' ? 'active' : ''}`}
        >
          🗳️ Oylama
        </button>
      </div>

      <main className="main-layout">
        {activeTab === 'dashboard' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <Dashboard />
          </section>
        )}

        {activeTab === 'donate' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <DonationForm />
          </section>
        )}

        {activeTab === 'packages' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <CoordinatorPanel />
          </section>
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

        {activeTab === 'dao-members' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <VerifierManagement />
          </section>
        )}

        {activeTab === 'dao-voting' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <DAOPanel />
          </section>
        )}
      </main>
    </div>
  );
}

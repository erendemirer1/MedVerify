import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { AIDCHAIN_REGISTRY_ID } from './config';

interface DashboardStats {
  totalRecipients: number;
  verifiedRecipients: number;
  pendingRecipients: number;
  totalPackages: number;
  deliveredPackages: number;
  totalDonations: number;
  totalVerifiers: number;
}

export function Dashboard() {
  const client = useSuiClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalRecipients: 0,
    verifiedRecipients: 0,
    pendingRecipients: 0,
    totalPackages: 0,
    deliveredPackages: 0,
    totalDonations: 0,
    totalVerifiers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        
        const profileIds = fields.recipient_profiles || [];
        const packageIds = fields.packages || [];
        const verifiers = fields.verifiers || [];

        // Load recipient profiles to count verified/pending
        let verifiedCount = 0;
        let pendingCount = 0;

        for (const profileId of profileIds) {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: { showContent: true },
            });
            if (profileObj.data?.content?.dataType === 'moveObject') {
              const pf = profileObj.data.content.fields as any;
              if (pf.is_verified) {
                verifiedCount++;
              } else {
                pendingCount++;
              }
            }
          } catch (err) {
            console.error('Error loading profile:', err);
          }
        }

        // Load packages to count delivered and total donations
        let deliveredCount = 0;
        let totalDonations = 0;

        for (const pkgId of packageIds) {
          try {
            const pkgObj = await client.getObject({
              id: pkgId,
              options: { showContent: true },
            });
            if (pkgObj.data?.content?.dataType === 'moveObject') {
              const pf = pkgObj.data.content.fields as any;
              if (pf.status === 2) {
                deliveredCount++;
              }
              // Get donation amount from locked_donation
              const lockedDonation = pf.locked_donation;
              if (lockedDonation?.fields?.some?.fields?.balance) {
                totalDonations += Number(lockedDonation.fields.some.fields.balance);
              }
            }
          } catch (err) {
            console.error('Error loading package:', err);
          }
        }

        setStats({
          totalRecipients: profileIds.length,
          verifiedRecipients: verifiedCount,
          pendingRecipients: pendingCount,
          totalPackages: packageIds.length,
          deliveredPackages: deliveredCount,
          totalDonations: totalDonations,
          totalVerifiers: verifiers.length,
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSUI = (amount: number) => {
    return (amount / 1_000_000_000).toFixed(2);
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    subtitle 
  }: { 
    title: string; 
    value: string | number; 
    icon: string; 
    color: string;
    subtitle?: string;
  }) => (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            {title}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>
          {icon}
        </div>
      </div>
    </div>
  );

  const ProgressBar = ({ 
    label, 
    value, 
    max, 
    color 
  }: { 
    label: string; 
    value: number; 
    max: number; 
    color: string;
  }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#374151' }}>{label}</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            {value} / {max}
          </span>
        </div>
        <div style={{
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percent}%`,
            background: color,
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <h2>📊 Dashboard</h2>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          İstatistikler yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>📊 Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
            AidChain platform istatistikleri
          </p>
        </div>
        <button 
          onClick={loadStats} 
          className="btn-primary" 
          style={{ padding: '10px 20px' }}
        >
          🔄 Yenile
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        <StatCard
          title="Toplam Bağış"
          value={`${formatSUI(stats.totalDonations)} SUI`}
          icon="💰"
          color="#dcfce7"
          subtitle="Tüm zamanlar"
        />
        <StatCard
          title="Toplam Alıcı"
          value={stats.totalRecipients}
          icon="👥"
          color="#e0e7ff"
          subtitle={`${stats.verifiedRecipients} onaylı`}
        />
        <StatCard
          title="Yardım Paketleri"
          value={stats.totalPackages}
          icon="📦"
          color="#fef3c7"
          subtitle={`${stats.deliveredPackages} teslim edildi`}
        />
        <StatCard
          title="DAO Üyeleri"
          value={stats.totalVerifiers + 1}
          icon="🏛️"
          color="#fce7f3"
          subtitle="Admin + Verifier'lar"
        />
      </div>

      {/* Progress Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
      }}>
        {/* Recipients Progress */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#111827' }}>
            👥 Alıcı Durumu
          </h3>
          <ProgressBar
            label="Onaylı Alıcılar"
            value={stats.verifiedRecipients}
            max={stats.totalRecipients}
            color="#10b981"
          />
          <ProgressBar
            label="Bekleyen Başvurular"
            value={stats.pendingRecipients}
            max={stats.totalRecipients}
            color="#f59e0b"
          />
        </div>

        {/* Packages Progress */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#111827' }}>
            📦 Paket Durumu
          </h3>
          <ProgressBar
            label="Teslim Edilenler"
            value={stats.deliveredPackages}
            max={stats.totalPackages}
            color="#10b981"
          />
          <ProgressBar
            label="Devam Edenler"
            value={stats.totalPackages - stats.deliveredPackages}
            max={stats.totalPackages}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Info Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginTop: '24px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white',
        }}>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Onay Oranı</div>
          <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>
            {stats.totalRecipients > 0 
              ? `${Math.round((stats.verifiedRecipients / stats.totalRecipients) * 100)}%`
              : '0%'
            }
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white',
        }}>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Teslimat Oranı</div>
          <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>
            {stats.totalPackages > 0 
              ? `${Math.round((stats.deliveredPackages / stats.totalPackages) * 100)}%`
              : '0%'
            }
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white',
        }}>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Ortalama Bağış</div>
          <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>
            {stats.totalPackages > 0 
              ? `${formatSUI(stats.totalDonations / stats.totalPackages)} SUI`
              : '0 SUI'
            }
          </div>
        </div>
      </div>

      {/* Blockchain Info */}
      <div style={{
        marginTop: '24px',
        padding: '16px 20px',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
          📋 Registry ID
        </div>
        <code style={{
          fontSize: '12px',
          color: '#334155',
          background: '#e2e8f0',
          padding: '8px 12px',
          borderRadius: '6px',
          display: 'block',
          wordBreak: 'break-all',
        }}>
          {AIDCHAIN_REGISTRY_ID}
        </code>
        <div style={{ marginTop: '12px' }}>
          <a
            href={`https://testnet.suivision.xyz/object/${AIDCHAIN_REGISTRY_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '13px',
              color: '#667eea',
              textDecoration: 'none',
            }}
          >
            🔍 SuiVision'da Görüntüle →
          </a>
        </div>
      </div>
    </div>
  );
}

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
    icon: React.ReactNode; 
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
        <h2>Dashboard</h2>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Loading statistics...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Admin Registry Creation */}
      {/* Registry creation section removed - using fixed registry */}

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
            AidChain platform statistics
          </p>
        </div>
        <button 
          onClick={loadStats} 
          className="btn-primary" 
          style={{ padding: '10px 20px' }}
        >
          Refresh
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
          title="Total Donations"
          value={`${formatSUI(stats.totalDonations)} SUI`}
          icon={<svg width="24" height="24" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
          color="#dcfce7"
          subtitle="All time"
        />
        <StatCard
          title="Total Recipients"
          value={stats.totalRecipients}
          icon={<svg width="24" height="24" fill="none" stroke="#4f46e5" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
          color="#e0e7ff"
          subtitle={`${stats.verifiedRecipients} verified`}
        />
        <StatCard
          title="Aid Packages"
          value={stats.totalPackages}
          icon={<svg width="24" height="24" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
          color="#fef3c7"
          subtitle={`${stats.deliveredPackages} delivered`}
        />
        <StatCard
          title="DAO Members"
          value={stats.totalVerifiers + 1}
          icon={<svg width="24" height="24" fill="none" stroke="#db2777" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg>}
          color="#fce7f3"
          subtitle="Admin + Verifiers"
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
            Recipient Status
          </h3>
          <ProgressBar
            label="Verified Recipients"
            value={stats.verifiedRecipients}
            max={stats.totalRecipients}
            color="#10b981"
          />
          <ProgressBar
            label="Pending Applications"
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
            Package Status
          </h3>
          <ProgressBar
            label="Delivered"
            value={stats.deliveredPackages}
            max={stats.totalPackages}
            color="#10b981"
          />
          <ProgressBar
            label="In Progress"
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
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Approval Rate</div>
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
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Delivery Rate</div>
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
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Average Donation</div>
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
          Registry ID
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
            View on SuiVision
          </a>
        </div>
      </div>
    </div>
  );
}

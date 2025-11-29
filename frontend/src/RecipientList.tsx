import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { AIDCHAIN_REGISTRY_ID } from './config';

interface RecipientProfile {
  id: string;
  recipient: string;
  name: string;
  location: string;
  needCategory: string;
  isVerified: boolean;
  registeredAtEpoch: string;
  receivedPackagesCount: string;
}

interface RecipientListProps {
  onSelectRecipient?: (address: string, name: string) => void;
  showVerifiedOnly?: boolean;
}

export function RecipientList({ onSelectRecipient, showVerifiedOnly = true }: RecipientListProps) {
  const [recipients, setRecipients] = useState<RecipientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const client = useSuiClient();

  useEffect(() => {
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      setError('');

      const registryObject = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: {
          showContent: true,
        },
      });

      if (registryObject.data?.content?.dataType === 'moveObject') {
        const fields = registryObject.data.content.fields as any;
        const recipientProfileIds = fields.recipient_profiles || [];

        const profilePromises = recipientProfileIds.map(async (profileId: string) => {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: {
                showContent: true,
              },
            });

            if (profileObj.data?.content?.dataType === 'moveObject') {
              const profileFields = profileObj.data.content.fields as any;
              return {
                id: profileId,
                recipient: profileFields.recipient,
                name: profileFields.name,
                location: profileFields.location,
                needCategory: profileFields.need_category,
                isVerified: profileFields.is_verified,
                registeredAtEpoch: profileFields.registered_at_epoch,
                receivedPackagesCount: profileFields.received_packages_count,
              };
            }
          } catch (err) {
            console.error(`Error loading profile ${profileId}:`, err);
          }
          return null;
        });

        const profiles = (await Promise.all(profilePromises)).filter(
          (p): p is RecipientProfile => p !== null
        );

        const filtered = showVerifiedOnly 
          ? profiles.filter(p => p.isVerified)
          : profiles;

        setRecipients(filtered);
      }
    } catch (err) {
      console.error('Error loading recipients:', err);
      setError('Alıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: { [key: string]: string } = {
      'Gıda': '🍞',
      'Giyim': '👕',
      'Barınma': '🏠',
      'Sağlık': '💊',
      'Eğitim': '📚',
      'Diğer': '📦',
    };
    return emojis[category] || '📦';
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
          <p>Alıcılar yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ 
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '15px',
          color: '#721c24'
        }}>
          ❌ {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px' 
      }}>
        <h2 style={{ margin: 0, color: '#667eea' }}>
          {showVerifiedOnly ? '✅ Doğrulanmış Alıcılar' : '👥 Tüm Alıcılar'}
        </h2>
        <button
          onClick={loadRecipients}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#667eea',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          🔄 Yenile
        </button>
      </div>

      {recipients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#f8f9fa',
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>🔍</div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            {showVerifiedOnly 
              ? 'Henüz doğrulanmış alıcı bulunmuyor'
              : 'Henüz kayıtlı alıcı bulunmuyor'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              style={{
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                background: 'white',
                transition: 'all 0.3s ease',
                cursor: onSelectRecipient ? 'pointer' : 'default',
              }}
              onClick={() => onSelectRecipient?.(recipient.recipient, recipient.name)}
              onMouseEnter={(e) => {
                if (onSelectRecipient) {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (onSelectRecipient) {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{recipient.name}</h3>
                    {recipient.isVerified && (
                      <span style={{
                        background: '#d4edda',
                        color: '#155724',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}>
                        ✅ Doğrulandı
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    📍 {recipient.location}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    {getCategoryEmoji(recipient.needCategory)} {recipient.needCategory}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                    📦 Alınan Paket: {recipient.receivedPackagesCount}
                  </div>
                </div>
                
                {onSelectRecipient && (
                  <div style={{
                    fontSize: '30px',
                    color: '#667eea',
                    transition: 'transform 0.3s ease',
                  }}>
                    ➜
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

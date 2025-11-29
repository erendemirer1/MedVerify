import { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

interface RecipientProfile {
  id: string;
  recipient: string;
  name: string;
  location: string;
  needCategory: string;
  isVerified: boolean;
  registeredAtEpoch: string;
}

const COORDINATOR_ADDRESS = '0x114aa1f7c47970c88eaafac9c127f9ee9fbb91047fa04426f66a26d62034a813'; // Senin cüzdanın (Yeni registry admin)

// Hot reload test - Updated at ${new Date().toISOString()}
export function RecipientVerification() {
  const [unverifiedRecipients, setUnverifiedRecipients] = useState<RecipientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Sui adreslerini normalize et (0x prefix olmadan karşılaştır)
  const normalizeAddress = (addr: string) => addr.replace(/^0x/, '').toLowerCase();
  const isCoordinator = currentAccount?.address 
    ? normalizeAddress(currentAccount.address) === normalizeAddress(COORDINATOR_ADDRESS)
    : false;

  // Debug
  console.log('🔍 RecipientVerification Debug:', {
    currentAddress: currentAccount?.address,
    coordinatorAddress: COORDINATOR_ADDRESS,
    isCoordinator,
    normalized: {
      current: currentAccount?.address ? normalizeAddress(currentAccount.address) : 'none',
      expected: normalizeAddress(COORDINATOR_ADDRESS)
    }
  });

  useEffect(() => {
    loadUnverifiedRecipients();
  }, []);

  const loadUnverifiedRecipients = async () => {
    try {
      setLoading(true);
      
      const registryObject = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: {
          showContent: true,
        },
      });

      if (registryObject.data?.content?.dataType === 'moveObject') {
        const fields = registryObject.data.content.fields as any;
        const registryAdmin = fields.admin;
        
        // Registry admin kontrolü - sadece bilgi için
        if (currentAccount) {
          const normalizedCurrent = normalizeAddress(currentAccount.address);
          const normalizedRegistryAdmin = normalizeAddress(registryAdmin);
          
          console.log('🔍 Registry Admin Check:', {
            registryAdmin,
            currentAccount: currentAccount.address,
            isRegistryAdmin: normalizedCurrent === normalizedRegistryAdmin
          });
          
          // Admin değilse mesaj göster ama yine de listeyi yükle
          if (normalizedCurrent !== normalizedRegistryAdmin) {
            setMessage(`ℹ️ Not: Bu registry'nin admin'i CLI adresi!\n\nRegistry Admin: ${registryAdmin}\nSenin Cüzdanın: ${currentAccount.address}\n\nOnay işlemlerini CLI'dan yapmalısın.`);
          }
        }
        
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
              
              if (!profileFields.is_verified) {
                return {
                  id: profileId,
                  recipient: profileFields.recipient,
                  name: profileFields.name,
                  location: profileFields.location,
                  needCategory: profileFields.need_category,
                  isVerified: profileFields.is_verified,
                  registeredAtEpoch: profileFields.registered_at_epoch,
                };
              }
            }
          } catch (err) {
            console.error(`Error loading profile ${profileId}:`, err);
          }
          return null;
        });

        const profiles = (await Promise.all(profilePromises)).filter(
          (p): p is RecipientProfile => p !== null
        );

        setUnverifiedRecipients(profiles);
      }
    } catch (err) {
      console.error('Error loading unverified recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (profileId: string, name: string) => {
    if (!isCoordinator) {
      setMessage('❌ Sadece koordinatör alıcıları doğrulayabilir!');
      return;
    }

    setVerifying(profileId);
    setMessage('');

    try {
      const txb = new Transaction();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::verify_recipient`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.object(profileId),
        ],
      });

      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: {
                showEffects: true,
              },
            });

            if (status.effects?.status?.status === 'success') {
              setMessage(`✅ ${name} başarıyla doğrulandı!`);
              loadUnverifiedRecipients();
            } else {
              setMessage('❌ Doğrulama başarısız oldu');
            }
          },
          onError: (error) => {
            console.error('Verification error:', error);
            setMessage(`❌ Hata: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error('Transaction build error:', error);
      setMessage(`❌ İşlem hatası: ${(error as Error).message}`);
    } finally {
      setVerifying(null);
    }
  };

  // Yeni registry oluşturma fonksiyonu
  const handleCreateNewRegistry = async () => {
    if (!currentAccount) {
      setMessage('❌ Cüzdan bağlı değil!');
      return;
    }

    setMessage('⏳ Yeni registry oluşturuluyor...');

    try {
      const txb = new Transaction();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::init_registry`,
        arguments: [],
      });

      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: {
                showEffects: true,
                showObjectChanges: true,
              },
            });

            if (status.effects?.status?.status === 'success') {
              // Yeni registry ID'sini bul
              const created = status.objectChanges?.find(
                (change: any) => change.type === 'created' && 
                change.objectType?.includes('AidRegistry')
              );
              
              if (created && 'objectId' in created) {
                setMessage(`✅ Yeni registry oluşturuldu! ID: ${created.objectId}\n\n` +
                  `📝 Bu ID'yi config.ts'de AIDCHAIN_REGISTRY_ID olarak kullanın.\n` +
                  `Version: ${(created as any).version || 'unknown'}`);
              } else {
                setMessage('✅ Registry oluşturuldu! Transaction: ' + result.digest);
              }
            } else {
              setMessage('❌ Registry oluşturulamadı');
            }
          },
          onError: (error) => {
            console.error('Registry creation error:', error);
            setMessage(`❌ Hata: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error('Transaction build error:', error);
      setMessage(`❌ İşlem hatası: ${(error as Error).message}`);
    }
  };

  // Component mount olduğunda registry admin kontrolü yap
  useEffect(() => {
    if (currentAccount) {
      loadUnverifiedRecipients();
    }
  }, [currentAccount]);

  // Coordinator kontrolü - YENİ REGISTRY OLUŞTURMA BUTONU İLE
  if (!isCoordinator) {
    return (
      <div className="card">
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>Erişim Yetkisi Yok</h3>
          <p style={{ margin: '0 0 15px 0', color: '#856404' }}>
            Mevcut registry başka bir cüzdanla (CLI) oluşturulmuş.
          </p>
          
          {currentAccount && (
            <>
              <div style={{ 
                marginTop: '15px', 
                padding: '10px',
                background: '#fff',
                borderRadius: '8px',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                <div><strong>Senin Cüzdan:</strong></div>
                <code>{currentAccount.address}</code>
                <div style={{ marginTop: '10px' }}><strong>Mevcut Registry Admin:</strong></div>
                <code>{COORDINATOR_ADDRESS}</code>
              </div>
            </>
          )}
          
          <div style={{ 
            marginTop: '20px',
            padding: '15px',
            background: '#e7f3ff',
            borderRadius: '8px',
            textAlign: 'left',
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              🆕 Kendi Registry'ni Oluştur
            </h4>
            <p style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#666' }}>
              Butona tıklayarak senin cüzdanınla yeni bir registry oluşturabilirsin. 
              Bu sayede sen admin olursun ve doğrulama yapabilirsin!
            </p>
            <button
              onClick={handleCreateNewRegistry}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%',
              }}
            >
              🆕 Yeni Registry Oluştur
            </button>
            <div style={{ 
              marginTop: '10px',
              fontSize: '11px',
              color: '#666',
              padding: '8px',
              background: '#fff',
              borderRadius: '4px',
            }}>
              ⚠️ <strong>Not:</strong> Bu işlem için cüzdanında SUI olması gerekiyor (~0.01 SUI).
              <br/>
              <a 
                href="https://faucet.testnet.sui.io/" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: '#667eea', textDecoration: 'none', fontWeight: '500' }}
              >
                → Testnet Faucet'ten SUI Al
              </a>
            </div>
          </div>
        </div>
        
        {message && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            borderRadius: '8px',
            background: message.includes('✅') ? '#d4edda' : '#f8d7da',
            color: message.includes('✅') ? '#155724' : '#721c24',
            border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
            whiteSpace: 'pre-line',
          }}>
            {message}
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
          <p>Doğrulanmamış alıcılar yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="card">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px' 
      }}>
        <h2 style={{ margin: 0, color: '#667eea' }}>
          ⏳ Doğrulama Bekleyen Alıcılar
        </h2>
        <button
          onClick={loadUnverifiedRecipients}
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

      {message && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          borderRadius: '8px',
          background: message.includes('✅') ? '#d4edda' : '#e7f3ff',
          color: message.includes('✅') ? '#155724' : '#004085',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#bee5eb'}`,
        }}>
          <div style={{ whiteSpace: 'pre-line', marginBottom: '15px' }}>{message}</div>
          
          {message.includes('CLI adresi') && (
            <button
              onClick={handleCreateNewRegistry}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%',
              }}
            >
              🆕 Yeni Registry Oluştur (Senin Cüzdanınla)
            </button>
          )}
        </div>
      )}

      {unverifiedRecipients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#f8f9fa',
          borderRadius: '12px',
        }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>✅</div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Doğrulama bekleyen alıcı bulunmuyor
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {unverifiedRecipients.map((recipient) => (
            <div
              key={recipient.id}
              style={{
                border: '2px solid #ffc107',
                borderRadius: '12px',
                padding: '20px',
                background: '#fffbf0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
                    {recipient.name}
                  </h3>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    📍 {recipient.location}
                  </div>
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                    📦 {recipient.needCategory}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    Wallet: {recipient.recipient.slice(0, 6)}...{recipient.recipient.slice(-4)}
                  </div>
                </div>
                
                <div>
                  <button
                    onClick={() => handleVerify(recipient.id, recipient.name)}
                    disabled={verifying === recipient.id || !isCoordinator}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: verifying === recipient.id ? '#ccc' : (isCoordinator ? '#28a745' : '#999'),
                      color: 'white',
                      cursor: verifying === recipient.id || !isCoordinator ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      minWidth: '120px',
                    }}
                  >
                    {verifying === recipient.id ? '⏳ Doğrulanıyor...' : '✅ Doğrula'}
                  </button>
                  
                  {!isCoordinator && (
                    <div style={{ 
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#999',
                      textAlign: 'center',
                    }}>
                      Sadece koordinatör doğrulayabilir
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

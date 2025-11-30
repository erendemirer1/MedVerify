import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, IMPACT_COUNTER_ID, IMPACT_COUNTER_INITIAL_SHARED_VERSION } from './config';
import { useSponsoredTransaction } from './useSponsoredTransaction';

interface ImpactNFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  donationAmount: number;
  recipientLocation: string;
  recipientName: string;
  tier: number;
  tierName: string;
  donatedAtEpoch: number;
  impactId: number;
}

interface RecipientProfile {
  id: string;
  owner: string;
  name: string;
  description: string;
  location: string;
  isVerified: boolean;
}

// Tier images - using public domain charity/medal images
const TIER_IMAGES: Record<number, string> = {
  1: 'https://cdn-icons-png.flaticon.com/512/2583/2583319.png', // Bronze medal
  2: 'https://cdn-icons-png.flaticon.com/512/2583/2583434.png', // Silver medal
  3: 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png', // Gold medal
  4: 'https://cdn-icons-png.flaticon.com/512/3199/3199063.png', // Diamond
};

const TIER_COLORS: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  1: { bg: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)', border: '#CD7F32', text: '#FFF', glow: '0 0 20px rgba(205, 127, 50, 0.5)' },
  2: { bg: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)', border: '#C0C0C0', text: '#FFF', glow: '0 0 20px rgba(192, 192, 192, 0.5)' },
  3: { bg: 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)', border: '#FFD700', text: '#000', glow: '0 0 20px rgba(255, 215, 0, 0.5)' },
  4: { bg: 'linear-gradient(135deg, #B9F2FF 0%, #00CED1 100%)', border: '#00CED1', text: '#000', glow: '0 0 30px rgba(0, 206, 209, 0.7)' },
};

const TIER_THRESHOLDS = {
  bronze: 0.1,
  silver: 1,
  gold: 10,
  diamond: 100,
};

export function ImpactNFTPanel() {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { executeSponsored, isEnabled: sponsoredEnabled } = useSponsoredTransaction();

  const [myNFTs, setMyNFTs] = useState<ImpactNFT[]>([]);
  const [recipients, setRecipients] = useState<RecipientProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [minting, setMinting] = useState(false);
  const [message, setMessage] = useState('');
  const [totalImpacts, setTotalImpacts] = useState(0);
  const [useSponsored, setUseSponsored] = useState(true);

  // Mint form state
  const [mintAmount, setMintAmount] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');

  useEffect(() => {
    if (currentAccount) {
      loadMyNFTs();
      loadTotalImpacts();
    }
    loadRecipients();
  }, [currentAccount]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        const profileIds: string[] = fields.recipient_profiles || [];

        const profiles: RecipientProfile[] = [];
        for (const profileId of profileIds) {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: { showContent: true },
            });

            if (profileObj.data?.content?.dataType === 'moveObject') {
              const pf = profileObj.data.content.fields as any;
              profiles.push({
                id: profileId,
                owner: pf.owner,
                name: pf.name,
                description: pf.description,
                location: pf.location,
                isVerified: pf.is_verified,
              });
            }
          } catch (err) {
            console.error('Error loading profile:', err);
          }
        }

        setRecipients(profiles);
      }
    } catch (error) {
      console.error('Failed to load recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const loadMyNFTs = async () => {
    if (!currentAccount) return;
    setLoading(true);

    try {
      const objects = await client.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${AIDCHAIN_PACKAGE_ID}::impact_nft::ImpactNFT`,
        },
        options: { showContent: true, showDisplay: true },
      });

      const nfts: ImpactNFT[] = [];
      for (const obj of objects.data) {
        if (obj.data?.content?.dataType === 'moveObject') {
          const fields = obj.data.content.fields as any;
          nfts.push({
            id: obj.data.objectId,
            name: fields.name,
            description: fields.description,
            imageUrl: fields.image_url,
            donationAmount: parseInt(fields.donation_amount) / 1_000_000_000,
            recipientLocation: fields.recipient_location,
            recipientName: fields.recipient_name,
            tier: parseInt(fields.tier),
            tierName: fields.tier_name,
            donatedAtEpoch: parseInt(fields.donated_at_epoch),
            impactId: parseInt(fields.impact_id),
          });
        }
      }

      // Sort by impact ID (newest first)
      nfts.sort((a, b) => b.impactId - a.impactId);
      setMyNFTs(nfts);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTotalImpacts = async () => {
    try {
      const obj = await client.getObject({
        id: IMPACT_COUNTER_ID,
        options: { showContent: true },
      });

      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields as any;
        setTotalImpacts(parseInt(fields.count));
      }
    } catch (error) {
      console.error('Failed to load total impacts:', error);
    }
  };

  const getTierFromAmount = (amount: number): { tier: number; name: string } => {
    if (amount >= TIER_THRESHOLDS.diamond) return { tier: 4, name: 'Diamond' };
    if (amount >= TIER_THRESHOLDS.gold) return { tier: 3, name: 'Gold' };
    if (amount >= TIER_THRESHOLDS.silver) return { tier: 2, name: 'Silver' };
    return { tier: 1, name: 'Bronze' };
  };

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);

  const handleMintNFT = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(mintAmount);
    if (!amount || amount < 0.1) {
      setMessage('Minimum donation amount is 0.1 SUI');
      return;
    }

    if (!selectedRecipient) {
      setMessage('Please select a recipient');
      return;
    }

    setMinting(true);
    setMessage('');

    try {
      const amountInMist = Math.floor(amount * 1_000_000_000);

      const txb = new Transaction();
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::impact_nft::mint_impact_nft`,
        arguments: [
          txb.sharedObjectRef({
            objectId: IMPACT_COUNTER_ID,
            initialSharedVersion: IMPACT_COUNTER_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.pure.u64(amountInMist),
          txb.pure.string(selectedRecipient.location),
          txb.pure.string(selectedRecipient.name),
        ],
      });

      if (useSponsored && sponsoredEnabled) {
        setMessage('Minting NFT with sponsored gas...');
        const result = await executeSponsored(txb);

        if (result.success) {
          setMessage('Impact NFT minted successfully!');
          setMintAmount('');
          setSelectedRecipientId('');
          await loadMyNFTs();
          await loadTotalImpacts();
        } else {
          setMessage(`Mint failed: ${result.error}`);
        }
      } else {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async () => {
              setMessage('Impact NFT minted successfully!');
              setMintAmount('');
              setSelectedRecipientId('');
              await loadMyNFTs();
              await loadTotalImpacts();
            },
            onError: (err: any) => {
              setMessage(`Mint failed: ${err.message}`);
            },
          }
        );
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setMinting(false);
    }
  };

  const tierInfo = mintAmount ? getTierFromAmount(parseFloat(mintAmount) || 0) : null;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <img src="https://cdn-icons-png.flaticon.com/512/2583/2583344.png" alt="trophy" style={{ width: '32px', height: '32px' }} />
        Proof of Impact NFTs
      </h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
        Mint your donation certificate as an NFT • Total Impacts: <strong>{totalImpacts}</strong>
      </p>

      {/* Tier Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginBottom: '30px',
        flexWrap: 'wrap',
      }}>
        {[
          { tier: 1, name: 'Bronze', min: '0.1 SUI' },
          { tier: 2, name: 'Silver', min: '1 SUI' },
          { tier: 3, name: 'Gold', min: '10 SUI' },
          { tier: 4, name: 'Diamond', min: '100 SUI' },
        ].map(t => (
          <div key={t.tier} style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: TIER_COLORS[t.tier].bg,
            color: TIER_COLORS[t.tier].text,
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <img src={TIER_IMAGES[t.tier]} alt={t.name} style={{ width: '20px', height: '20px' }} />
            {t.name} ({t.min}+)
          </div>
        ))}
      </div>

      {/* Mint Form */}
      <div style={{
        background: '#f8f9fa',
        padding: '25px',
        borderRadius: '16px',
        marginBottom: '30px',
        border: '1px solid #e0e0e0',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/1490/1490818.png" alt="mint" style={{ width: '24px', height: '24px' }} />
          Mint Your Impact NFT
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Recipient Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Select Recipient *
            </label>
            {loadingRecipients ? (
              <div style={{ padding: '12px', color: '#666' }}>Loading recipients...</div>
            ) : recipients.length === 0 ? (
              <div style={{ padding: '12px', color: '#999', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
                No recipients available
              </div>
            ) : (
              <select
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  fontSize: '15px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">-- Select a recipient --</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} - {r.location} {r.isVerified ? '✓' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Selected Recipient Info */}
            {selectedRecipient && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#fff',
                borderRadius: '8px',
                border: selectedRecipient.isVerified ? '2px solid #28a745' : '1px solid #ddd',
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{selectedRecipient.name}</div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" alt="location" style={{ width: '12px', height: '12px' }} />
                  {selectedRecipient.location}
                </div>
                <div style={{ fontSize: '13px', color: '#888' }}>{selectedRecipient.description}</div>
                {selectedRecipient.isVerified && (
                  <div style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: '#d4edda',
                    color: '#155724',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}>
                    <img src="https://cdn-icons-png.flaticon.com/512/7518/7518748.png" alt="verified" style={{ width: '14px', height: '14px' }} />
                    Verified Recipient
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Donation Amount */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Donation Amount (SUI) *
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              placeholder="e.g., 1.0"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            />
            {tierInfo && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: TIER_COLORS[tierInfo.tier].bg,
                color: TIER_COLORS[tierInfo.tier].text,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <img src={TIER_IMAGES[tierInfo.tier]} alt={tierInfo.name} style={{ width: '24px', height: '24px' }} />
                You'll get: {tierInfo.name} Tier NFT
              </div>
            )}
          </div>
        </div>

        {sponsoredEnabled && (
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useSponsored}
                onChange={(e) => setUseSponsored(e.target.checked)}
              />
              <img src="https://cdn-icons-png.flaticon.com/512/2933/2933245.png" alt="gas" style={{ width: '18px', height: '18px' }} />
              <span>Use sponsored gas (free!)</span>
            </label>
          </div>
        )}

        <button
          onClick={handleMintNFT}
          disabled={minting || !mintAmount || !selectedRecipientId}
          style={{
            marginTop: '20px',
            padding: '14px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            background: minting || !mintAmount || !selectedRecipientId ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: minting || !mintAmount || !selectedRecipientId ? 'not-allowed' : 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {minting ? (
            <>Processing...</>
          ) : (
            <>
              <img src="https://cdn-icons-png.flaticon.com/512/1490/1490818.png" alt="mint" style={{ width: '20px', height: '20px' }} />
              Mint Impact NFT
            </>
          )}
        </button>

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            borderRadius: '8px',
            background: message.includes('successfully') ? '#d4edda' : '#f8d7da',
            color: message.includes('successfully') ? '#155724' : '#721c24',
            textAlign: 'center',
          }}>
            {message}
          </div>
        )}
      </div>

      {/* My NFTs Gallery */}
      <div>
        <h3 style={{ marginBottom: '20px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/3418/3418886.png" alt="gallery" style={{ width: '24px', height: '24px' }} />
          My Impact Collection ({myNFTs.length})
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Loading your NFTs...
          </div>
        ) : myNFTs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: '#f8f9fa',
            borderRadius: '16px',
            color: '#666',
          }}>
            <img src="https://cdn-icons-png.flaticon.com/512/1490/1490818.png" alt="no nfts" style={{ width: '64px', height: '64px', opacity: 0.5, marginBottom: '10px' }} />
            <p>You don't have any Impact NFTs yet.</p>
            <p>Mint your first one above!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {myNFTs.map(nft => (
              <div
                key={nft.id}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: `2px solid ${TIER_COLORS[nft.tier]?.border || '#ccc'}`,
                  boxShadow: TIER_COLORS[nft.tier]?.glow || '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* NFT Header with Tier Gradient */}
                <div style={{
                  background: TIER_COLORS[nft.tier]?.bg || '#667eea',
                  padding: '20px',
                  textAlign: 'center',
                  color: TIER_COLORS[nft.tier]?.text || '#fff',
                }}>
                  <img 
                    src={TIER_IMAGES[nft.tier] || TIER_IMAGES[1]} 
                    alt={nft.tierName} 
                    style={{ width: '64px', height: '64px', marginBottom: '10px' }} 
                  />
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {nft.tierName} Tier
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Impact #{nft.impactId}
                  </div>
                </div>

                {/* NFT Details */}
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                      Donation Amount
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                      {nft.donationAmount.toFixed(2)} SUI
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                      Location
                    </div>
                    <div style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" alt="location" style={{ width: '14px', height: '14px' }} />
                      {nft.recipientLocation}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                      Recipient
                    </div>
                    <div style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" alt="user" style={{ width: '14px', height: '14px' }} />
                      {nft.recipientName}
                    </div>
                  </div>

                  <div style={{
                    marginTop: '15px',
                    paddingTop: '15px',
                    borderTop: '1px solid #eee',
                    fontSize: '12px',
                    color: '#999',
                  }}>
                    Epoch: {nft.donatedAtEpoch}
                  </div>

                  {/* View on Explorer */}
                  <a
                    href={`https://testnet.suivision.xyz/object/${nft.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '10px',
                      padding: '8px',
                      textAlign: 'center',
                      background: '#f0f0f0',
                      borderRadius: '8px',
                      color: '#666',
                      textDecoration: 'none',
                      fontSize: '13px',
                    }}
                  >
                    <img src="https://cdn-icons-png.flaticon.com/512/622/622669.png" alt="search" style={{ width: '14px', height: '14px' }} />
                    View on Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

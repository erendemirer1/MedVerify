import { useState, useEffect } from 'react';
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

type AidPackageInfo = {
  id: string;
  version: number;
  description: string;
  location: string;
  status: number;
  donor: string;
  coordinator: string;
  proof_url: string;
  created_at_epoch: string;
  updated_at_epoch: string;
  donation_amount: string;
  is_locked: boolean;
  delivery_note?: string;
  coordinator_approved: boolean;
  recipient_approved: boolean;
  recipient?: string;
};

type RecipientProfile = {
  id: string;
  owner: string;
  name: string;
  location: string;
  isVerified: boolean;
};

const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Created', color: '#1e40af', bg: '#dbeafe' },
  1: { label: 'In Transit', color: '#92400e', bg: '#fef3c7' },
  2: { label: 'Delivered', color: '#166534', bg: '#dcfce7' },
};

export function CoordinatorPanel() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<AidPackageInfo[]>([]);
  const [verifiedRecipients, setVerifiedRecipients] = useState<RecipientProfile[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
    loadVerifiedRecipients();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);

      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      const regData: any = (registryObj as any).data?.content;
      if (!regData || regData.dataType !== 'moveObject') {
        setLoading(false);
        return;
      }

      const regFields = regData.fields;
      const ids: string[] = regFields.packages;

      if (!ids || ids.length === 0) {
        setPackages([]);
        setLoading(false);
        return;
      }

      const objs = await client.multiGetObjects({
        ids,
        options: { showContent: true, showOwner: true },
      });

      const list: AidPackageInfo[] = [];

      for (const obj of objs as any[]) {
        if (obj.error) continue;
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') continue;

        const f = (content as any).fields;
        const lockedDonation = f.locked_donation;
        const isLocked = lockedDonation?.fields?.some !== undefined;
        
        let donationAmount = '0';
        if (isLocked && lockedDonation.fields?.some?.fields?.balance) {
          donationAmount = lockedDonation.fields.some.fields.balance;
        }

        // Get initial shared version
        const owner = obj.data.owner;
        const version = owner?.Shared?.initial_shared_version || 1;

        // Parse recipient from Option type
        let recipient: string | undefined;
        if (f.recipient?.fields?.some) {
          recipient = f.recipient.fields.some;
        }

        list.push({
          id: obj.data.objectId,
          version,
          description: f.description,
          location: f.location,
          status: Number(f.status),
          donor: f.donor,
          coordinator: f.coordinator,
          proof_url: f.proof_url || '',
          created_at_epoch: f.created_at_epoch,
          updated_at_epoch: f.updated_at_epoch,
          donation_amount: donationAmount,
          is_locked: isLocked,
          delivery_note: f.delivery_note?.fields?.some || '',
          coordinator_approved: f.coordinator_approved || false,
          recipient_approved: f.recipient_approved || false,
          recipient,
        });
      }

      setPackages(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadVerifiedRecipients = async () => {
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
              if (pf.is_verified) {
                profiles.push({
                  id: profileId,
                  owner: pf.recipient,
                  name: pf.name,
                  location: pf.location,
                  isVerified: true,
                });
              }
            }
          } catch (err) {
            console.error('Error loading profile:', err);
          }
        }

        setVerifiedRecipients(profiles);
      }
    } catch (error) {
      console.error('Failed to load recipients:', error);
    }
  };

  const handleAssignRecipient = async (pkg: AidPackageInfo) => {
    const profileId = selectedRecipients[pkg.id];
    if (!profileId || !account) return;

    setActionLoading(pkg.id);
    setStatusMsg('Assigning recipient...');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::assign_recipient`,
        arguments: [
          tx.sharedObjectRef({
            objectId: pkg.id,
            initialSharedVersion: pkg.version,
            mutable: true,
          }),
          tx.object(profileId),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setStatusMsg('Recipient assigned successfully!');
              loadPackages();
            } else {
              setStatusMsg('Assignment failed');
            }
            setActionLoading(null);
          },
          onError: (error) => {
            setStatusMsg(`Error: ${error.message}`);
            setActionLoading(null);
          },
        }
      );
    } catch (error) {
      setStatusMsg(`Error: ${(error as Error).message}`);
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (pkg: AidPackageInfo) => {
    if (!account) return;

    const note = deliveryNotes[pkg.id] || '';
    setActionLoading(pkg.id);
    setStatusMsg('Marking as delivered...');

    try {
      const encoder = new TextEncoder();
      const tx = new Transaction();
      tx.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::mark_delivered`,
        arguments: [
          tx.sharedObjectRef({
            objectId: pkg.id,
            initialSharedVersion: pkg.version,
            mutable: true,
          }),
          tx.pure(encoder.encode(note)),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setStatusMsg('Marked as delivered!');
              loadPackages();
            } else {
              setStatusMsg('Failed');
            }
            setActionLoading(null);
          },
          onError: (error) => {
            setStatusMsg(`Error: ${error.message}`);
            setActionLoading(null);
          },
        }
      );
    } catch (error) {
      setStatusMsg(`Error: ${(error as Error).message}`);
      setActionLoading(null);
    }
  };

  const handleCoordinatorApprove = async (pkg: AidPackageInfo) => {
    if (!account) return;

    setActionLoading(pkg.id);
    setStatusMsg('Approving...');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::coordinator_approve`,
        arguments: [
          tx.sharedObjectRef({
            objectId: pkg.id,
            initialSharedVersion: pkg.version,
            mutable: true,
          }),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setStatusMsg('Coordinator approval given!');
              loadPackages();
            } else {
              setStatusMsg('Approval failed');
            }
            setActionLoading(null);
          },
          onError: (error) => {
            setStatusMsg(`Error: ${error.message}`);
            setActionLoading(null);
          },
        }
      );
    } catch (error) {
      setStatusMsg(`Error: ${(error as Error).message}`);
      setActionLoading(null);
    }
  };

  const handleReleaseFunds = async (pkg: AidPackageInfo) => {
    if (!account) return;

    setActionLoading(pkg.id);
    setStatusMsg('Releasing funds...');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::release_funds`,
        arguments: [
          tx.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          tx.sharedObjectRef({
            objectId: pkg.id,
            initialSharedVersion: pkg.version,
            mutable: true,
          }),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setStatusMsg('Funds released to recipient!');
              loadPackages();
            } else {
              setStatusMsg('Release failed');
            }
            setActionLoading(null);
          },
          onError: (error) => {
            setStatusMsg(`Error: ${error.message}`);
            setActionLoading(null);
          },
        }
      );
    } catch (error) {
      setStatusMsg(`Error: ${(error as Error).message}`);
      setActionLoading(null);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatSui = (amount: string) => {
    const sui = Number(amount) / 1_000_000_000;
    return sui.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const isCoordinatorOrDonor = (pkg: AidPackageInfo) => {
    return account?.address === pkg.coordinator || account?.address === pkg.donor;
  };

  const isRecipient = (pkg: AidPackageInfo) => {
    return account?.address === pkg.recipient;
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Aid Packages</h2>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/2331/2331966.png" alt="packages" style={{ width: '28px', height: '28px' }} />
          <h2 style={{ margin: 0 }}>Aid Packages</h2>
        </div>
        <button onClick={() => { loadPackages(); loadVerifiedRecipients(); }} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
          Refresh
        </button>
      </div>

      {statusMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: statusMsg.includes('success') || statusMsg.includes('!') ? '#d1fae5' : '#fee2e2',
          color: statusMsg.includes('success') || statusMsg.includes('!') ? '#065f46' : '#991b1b',
        }}>
          {statusMsg}
        </div>
      )}

      {packages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png" alt="empty" style={{ width: '64px', height: '64px', opacity: 0.5, marginBottom: '12px' }} />
          <p>No packages yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {packages.map((pkg, index) => (
            <div 
              key={pkg.id} 
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafafa',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                  }}>
                    #{index + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>
                      {pkg.description}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      {pkg.location}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: STATUS_LABELS[pkg.status]?.bg || '#f3f4f6',
                  color: STATUS_LABELS[pkg.status]?.color || '#374151',
                }}>
                  {STATUS_LABELS[pkg.status]?.label || 'Unknown'}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                {/* Amount */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Donation Amount
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
                      {formatSui(pkg.donation_amount)} <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>SUI</span>
                    </div>
                  </div>
                  {pkg.is_locked && (
                    <div style={{
                      padding: '8px 12px',
                      background: '#ecfdf5',
                      borderRadius: '8px',
                      color: '#059669',
                      fontSize: '13px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <img src="https://cdn-icons-png.flaticon.com/512/3064/3064197.png" alt="lock" style={{ width: '16px', height: '16px' }} />
                      Locked
                    </div>
                  )}
                </div>

                {/* Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Donor</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>{shortenAddress(pkg.donor)}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Coordinator</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>{shortenAddress(pkg.coordinator)}</div>
                  </div>
                  <div style={{ padding: '12px', background: pkg.recipient ? '#f0fdf4' : '#fef3c7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Recipient</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>
                      {pkg.recipient ? shortenAddress(pkg.recipient) : 'Not assigned'}
                    </div>
                  </div>
                </div>

                {/* Approval Status */}
                {pkg.status === 2 && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      flex: 1,
                      padding: '12px',
                      background: pkg.recipient_approved ? '#d1fae5' : '#fee2e2',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Recipient Approval</div>
                      <div style={{ fontWeight: '600', color: pkg.recipient_approved ? '#059669' : '#dc2626' }}>
                        {pkg.recipient_approved ? '✓ Approved' : '✗ Pending'}
                      </div>
                    </div>
                    <div style={{
                      flex: 1,
                      padding: '12px',
                      background: pkg.coordinator_approved ? '#d1fae5' : '#fee2e2',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Coordinator Approval</div>
                      <div style={{ fontWeight: '600', color: pkg.coordinator_approved ? '#059669' : '#dc2626' }}>
                        {pkg.coordinator_approved ? '✓ Approved' : '✗ Pending'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                  
                  {/* Step 1: Assign Recipient (for coordinator/donor, when status=0 and no recipient) */}
                  {pkg.status === 0 && !pkg.recipient && isCoordinatorOrDonor(pkg) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Step 1: Assign Verified Recipient
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          value={selectedRecipients[pkg.id] || ''}
                          onChange={(e) => setSelectedRecipients({ ...selectedRecipients, [pkg.id]: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px',
                          }}
                        >
                          <option value="">Select recipient...</option>
                          {verifiedRecipients.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} - {r.location}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignRecipient(pkg)}
                          disabled={!selectedRecipients[pkg.id] || actionLoading === pkg.id}
                          style={{
                            padding: '10px 20px',
                            background: selectedRecipients[pkg.id] ? '#3b82f6' : '#d1d5db',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: selectedRecipients[pkg.id] ? 'pointer' : 'not-allowed',
                            fontWeight: '500',
                          }}
                        >
                          {actionLoading === pkg.id ? 'Assigning...' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Mark as Delivered (for recipient, when status=1) */}
                  {pkg.status === 1 && isRecipient(pkg) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Step 2: Confirm Delivery
                      </div>
                      <input
                        type="text"
                        placeholder="Add delivery note (optional)"
                        value={deliveryNotes[pkg.id] || ''}
                        onChange={(e) => setDeliveryNotes({ ...deliveryNotes, [pkg.id]: e.target.value })}
                        style={{ 
                          width: '100%',
                          marginBottom: '8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        onClick={() => handleMarkDelivered(pkg)}
                        disabled={actionLoading === pkg.id}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#059669',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {actionLoading === pkg.id ? 'Processing...' : 'Mark as Received'}
                      </button>
                    </div>
                  )}

                  {/* Step 3: Coordinator Approve (for coordinator, when status=2 and not yet approved) */}
                  {pkg.status === 2 && !pkg.coordinator_approved && isCoordinatorOrDonor(pkg) && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Step 3: Coordinator Approval
                      </div>
                      <button
                        onClick={() => handleCoordinatorApprove(pkg)}
                        disabled={actionLoading === pkg.id}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {actionLoading === pkg.id ? 'Processing...' : 'Approve Delivery'}
                      </button>
                    </div>
                  )}

                  {/* Step 4: Release Funds (when both approved and locked) */}
                  {pkg.status === 2 && pkg.recipient_approved && pkg.coordinator_approved && pkg.is_locked && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                        Step 4: Release Funds
                      </div>
                      <button
                        onClick={() => handleReleaseFunds(pkg)}
                        disabled={actionLoading === pkg.id}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                      >
                        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135706.png" alt="release" style={{ width: '20px', height: '20px' }} />
                        {actionLoading === pkg.id ? 'Releasing...' : `Release ${formatSui(pkg.donation_amount)} SUI to Recipient`}
                      </button>
                    </div>
                  )}

                  {/* Completed State */}
                  {pkg.status === 2 && pkg.recipient_approved && pkg.coordinator_approved && !pkg.is_locked && (
                    <div style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}>
                      <img src="https://cdn-icons-png.flaticon.com/512/7518/7518748.png" alt="done" style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
                      <div style={{ fontWeight: '600', color: '#065f46' }}>
                        Completed - Funds Released to Recipient
                      </div>
                    </div>
                  )}

                </div>

                {/* Delivery Note */}
                {pkg.delivery_note && (
                  <div style={{ 
                    marginTop: '16px',
                    padding: '14px 16px', 
                    background: '#f0fdf4', 
                    borderRadius: '8px', 
                    borderLeft: '3px solid #22c55e',
                  }}>
                    <div style={{ fontSize: '11px', color: '#16a34a', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Delivery Note</div>
                    <div style={{ fontSize: '14px', color: '#166534' }}>{pkg.delivery_note}</div>
                  </div>
                )}

                {/* Explorer Link */}
                <a
                  href={`https://testnet.suivision.xyz/object/${pkg.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '16px',
                    padding: '10px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    color: '#475569',
                    textDecoration: 'none',
                    fontSize: '13px',
                  }}
                >
                  <img src="https://cdn-icons-png.flaticon.com/512/622/622669.png" alt="link" style={{ width: '14px', height: '14px' }} />
                  View on Explorer
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

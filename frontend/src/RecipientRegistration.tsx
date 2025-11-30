import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { 
  AIDCHAIN_PACKAGE_ID, 
  AIDCHAIN_REGISTRY_ID, 
  REGISTRY_INITIAL_SHARED_VERSION,
  WALRUS_PUBLISHER_URL
} from './config';
import { useSponsoredTransaction } from './useSponsoredTransaction';

export function RecipientRegistration() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [phone, setPhone] = useState('');
  const [familySize, setFamilySize] = useState('1');
  const [description, setDescription] = useState('');
  const [residenceFile, setResidenceFile] = useState<File | null>(null);
  const [incomeFile, setIncomeFile] = useState<File | null>(null);
  const [extraDocumentFile, setExtraDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState('');
  const [useSponsored, setUseSponsored] = useState(true);
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { executeSponsored, isEnabled: sponsoredEnabled } = useSponsoredTransaction();

  const hashTC = async (tc: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(tc);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadToWalrus = async (file: File, label: string): Promise<string> => {
    setUploadProgress(`${label} Uploading to Walrus...`);
    
    try {
      const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs`, {
        method: 'PUT',
        body: file,
      });

      if (!response.ok) {
        throw new Error(`${label} upload error`);
      }

      const result = await response.json();
      const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId || '';
      
      return blobId;
    } catch (error) {
      console.error(`Walrus upload error (${label}):`, error);
      throw error;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    if (!name || !location || !tcNo || !phone) {
      setMessage('Please fill in all required fields');
      return;
    }

    if (tcNo.length !== 11 || !/^\d+$/.test(tcNo)) {
      setMessage('ID number must be 11 digits');
      return;
    }

    if (phone.length < 10) {
      setMessage('Please enter a valid phone number');
      return;
    }

    if (!residenceFile) {
      setMessage('Residence document is required');
      return;
    }

    if (!incomeFile) {
      setMessage('Income document is required');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      setUploadProgress('Hashing ID number...');
      const tcHash = await hashTC(tcNo);

      const residenceBlobId = await uploadToWalrus(residenceFile, 'Residence document');
      const incomeBlobId = await uploadToWalrus(incomeFile, 'Income document');
      
      // Extra document optional - upload if exists, empty string otherwise
      let extraDocumentBlobId = '';
      if (extraDocumentFile) {
        extraDocumentBlobId = await uploadToWalrus(extraDocumentFile, 'Extra document');
      }

      setUploadProgress('Recording on blockchain...');

      const txb = new Transaction();
      
      // Convert strings to Uint8Array for Move's vector<u8>
      const encoder = new TextEncoder();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::register_recipient`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.pure.vector('u8', Array.from(encoder.encode(name))),
          txb.pure.vector('u8', Array.from(encoder.encode(location))),
          txb.pure.vector('u8', Array.from(encoder.encode(tcHash))),
          txb.pure.vector('u8', Array.from(encoder.encode(phone))),
          txb.pure.vector('u8', Array.from(encoder.encode(residenceBlobId))),
          txb.pure.vector('u8', Array.from(encoder.encode(incomeBlobId))),
          txb.pure.vector('u8', Array.from(encoder.encode(extraDocumentBlobId))),
          txb.pure.u64(parseInt(familySize) || 1),
          txb.pure.vector('u8', Array.from(encoder.encode(description))),
        ],
      });

      // Use sponsored transaction (if enabled)
      if (useSponsored && sponsoredEnabled) {
        setUploadProgress('⛽ Preparing gas-free transaction...');
        
        try {
          const result = await executeSponsored(txb);

          if (result.success) {
            setMessage('🎉 Registration successful! Awaiting NGO verification... (Gas fee paid by sponsor)');
            setName('');
            setLocation('');
            setTcNo('');
            setPhone('');
            setFamilySize('1');
            setDescription('');
            setResidenceFile(null);
            setIncomeFile(null);
            setExtraDocumentFile(null);
            setUploadProgress('');
          } else {
            if (result.error?.includes('23') || result.error?.includes('E_ADMIN_CANNOT_REGISTER')) {
              setMessage('Admin/NGO members cannot apply for aid');
            } else {
              setMessage(`Registration failed: ${result.error}`);
            }
          }
        } catch (error) {
          setMessage(`Sponsored transaction error: ${(error as Error).message}`);
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      // Normal transaction (fallback)
      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setMessage('Registration successful! Awaiting NGO verification...');
              setName('');
              setLocation('');
              setTcNo('');
              setPhone('');
              setFamilySize('1');
              setDescription('');
              setResidenceFile(null);
              setIncomeFile(null);
              setExtraDocumentFile(null);
              setUploadProgress('');
            } else {
              const errorMsg = status.effects?.status?.error || 'Unknown error';
              if (errorMsg.includes('23') || errorMsg.includes('E_ADMIN_CANNOT_REGISTER')) {
                setMessage('Admin/NGO members cannot apply for aid');
              } else {
                setMessage(`Registration failed: ${errorMsg}`);
              }
            }
          },
          onError: (error) => {
            if (error.message.includes('23')) {
              setMessage('Admin/NGO members cannot apply for aid');
            } else {
              setMessage(`Error: ${error.message}`);
            }
          },
        }
      );
    } catch (error) {
      setMessage(`Transaction error: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Aid Application</h2>
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
            ⛽ GAS-FREE
          </span>
        )}
      </div>
      
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Fill out the form below to apply for aid. You can receive donations after your information is verified by the NGO.
        {sponsoredEnabled && ' Gas fee is covered by sponsor - completely free!'}
      </p>

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
              <div style={{ fontWeight: '600', color: useSponsored ? '#065f46' : '#374151' }}>
                ⛽ Gas-Free Registration
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

      <div style={{ 
        padding: '12px 16px', 
        background: '#fef3c7', 
        borderRadius: '8px', 
        marginBottom: '20px',
        fontSize: '13px',
        color: '#92400e',
        border: '1px solid #fcd34d',
      }}>
        <strong>Note:</strong> Admin and NGO members cannot apply for aid.
      </div>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Personal Information</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Phone *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
              ID Number *
            </label>
            <input
              type="text"
              value={tcNo}
              onChange={(e) => setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Your 11-digit ID number"
              maxLength={11}
              disabled={isSubmitting}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Your ID number is hashed for privacy
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Location and Family Information</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Location *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, District"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Family Size
              </label>
              <input
                type="number"
                value={familySize}
                onChange={(e) => setFamilySize(e.target.value)}
                min="1"
                max="20"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
              Situation Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe your situation (damage, special needs, etc.)"
              disabled={isSubmitting}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Required Documents</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              📄 Residence Document * (can be obtained from e-Government)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: residenceFile ? '#f0fdf4' : '#f8fafc',
              borderColor: residenceFile ? '#86efac' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setResidenceFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="residence-upload"
              />
              <label 
                htmlFor="residence-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {residenceFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                      {residenceFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(residenceFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Upload your residence document
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      PNG, JPG, PDF (max 10MB)
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              Income Document * (Payslip, social security statement, etc.)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: incomeFile ? '#f0fdf4' : '#f8fafc',
              borderColor: incomeFile ? '#86efac' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setIncomeFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="income-upload"
              />
              <label 
                htmlFor="income-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {incomeFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                      {incomeFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(incomeFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Upload your income document
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      PNG, JPG, PDF (max 10MB)
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Extra Document (Optional) */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              Extra Document (Optional - Health report, disability certificate, etc.)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: extraDocumentFile ? '#eff6ff' : '#f8fafc',
              borderColor: extraDocumentFile ? '#93c5fd' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setExtraDocumentFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="extra-upload"
              />
              <label 
                htmlFor="extra-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {extraDocumentFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#2563eb', fontWeight: '500' }}>
                      {extraDocumentFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(extraDocumentFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Upload extra document (optional)
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Health report, disability certificate, social aid decision, etc.
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>
            Your documents will be uploaded to Walrus decentralized storage and reviewed by the NGO.
          </p>
        </div>

        {uploadProgress && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#f1f5f9', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '14px',
            color: '#475569',
          }}>
            ⏳ {uploadProgress}
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('successful') || message.includes('🎉') ? 'message-success' : 'message-error'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !currentAccount}
          className="btn-primary"
          style={{ 
            width: '100%', 
            padding: '14px',
            background: useSponsored && sponsoredEnabled 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : undefined,
          }}
        >
          {!currentAccount 
            ? 'Connect Wallet First' 
            : isSubmitting 
              ? (useSponsored && sponsoredEnabled ? '⛽ Gas-Free Registering...' : 'Registering...') 
              : (useSponsored && sponsoredEnabled ? '⛽ Gas-Free Apply' : 'Apply')}
        </button>
      </form>
    </div>
  );
}

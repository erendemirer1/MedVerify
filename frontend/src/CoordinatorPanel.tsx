// src/CoordinatorPanel.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID } from './config';

type AidPackageInfo = {
  id: string;
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

function statusLabel(s: number): string {
  if (s === 0) return '📦 Oluşturuldu';
  if (s === 1) return '🚚 Yolda';
  if (s === 2) return '✅ Teslim Edildi';
  return '❓ Bilinmiyor';
}

export function CoordinatorPanel() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [registryId, setRegistryId] = useState(AIDCHAIN_REGISTRY_ID);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<AidPackageInfo[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [proofInputs, setProofInputs] = useState<Record<string, string>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [lastTx, setLastTx] = useState<string | null>(null);

  const handleLoadPackages = async () => {
    if (!registryId) {
      setStatusMsg('Lütfen registry ID gir.');
      return;
    }

    try {
      setLoading(true);
      setStatusMsg('Registry okunuyor...');

      const registryObj = await client.getObject({
        id: registryId,
        options: { showContent: true },
      });

      const regData: any = (registryObj as any).data?.content;
      if (!regData || regData.dataType !== 'moveObject') {
        setStatusMsg('Registry formatı geçersiz.');
        setLoading(false);
        return;
      }

      const regFields = regData.fields;
      const ids: string[] = regFields.packages;

      if (!ids || ids.length === 0) {
        setStatusMsg('Henüz kayıtlı yardım paketi yok.');
        setPackages([]);
        setLoading(false);
        return;
      }

      setStatusMsg(`Toplam ${ids.length} paket bulundu. Yükleniyor...`);

      const objs = await client.multiGetObjects({
        ids,
        options: { showContent: true },
      });

      const list: AidPackageInfo[] = [];

      for (const obj of objs as any[]) {
        if (obj.error) continue;
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') continue;

        const f = (content as any).fields;
        
        // Escrow kontrolü: locked_donation field'ı var mı ve dolu mu?
        const lockedDonation = f.locked_donation;
        const isLocked = lockedDonation && lockedDonation.type === 'some';
        
        // Delivery note kontrolü
        const deliveryNote = f.delivery_note?.type === 'some' ? f.delivery_note.fields : undefined;
        
        // Recipient kontrolü
        const recipient = f.recipient?.type === 'some' ? f.recipient.fields : undefined;
        
        list.push({
          id: f.id.id,
          description: f.description,
          location: f.location,
          status: Number(f.status),
          donor: f.donor,
          coordinator: f.coordinator,
          proof_url: f.proof_url ?? '',
          created_at_epoch: String(f.created_at_epoch),
          updated_at_epoch: String(f.updated_at_epoch),
          donation_amount: String(f.donation_amount || '0'),
          is_locked: isLocked,
          delivery_note: deliveryNote,
          coordinator_approved: f.coordinator_approved ?? false,
          recipient_approved: f.recipient_approved ?? false,
          recipient: recipient,
        });
      }

      setPackages(list);
      setStatusMsg('Paketler yüklendi.');
    } catch (e: any) {
      console.error(e);
      setStatusMsg('Paketler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleProofChange = (id: string, value: string) => {
    setProofInputs((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleDeliveryNoteChange = (id: string, value: string) => {
    setDeliveryNotes((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Yeni: Coordinator onayı
  const handleCoordinatorApprove = (p: AidPackageInfo) => {
    if (!account) {
      alert('Koordinatör işlemi için önce cüzdan bağla.');
      return;
    }

    if (p.coordinator.toLowerCase() !== account.address.toLowerCase()) {
      alert('Sadece coordinator onaylayabilir!');
      return;
    }

    const note = deliveryNotes[p.id] || 'Paket hazır';

    const txb = new Transaction();
    txb.moveCall({
      target: `${AIDCHAIN_PACKAGE_ID}::aidchain::approve_as_coordinator`,
      arguments: [
        txb.object(p.id),
        txb.pure.string(note),
      ],
    });

    setLoading(true);
    setStatusMsg('Coordinator onayı gönderiliyor...');
    setLastTx(null);

    signAndExecute(
      { transaction: txb },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          if (result.digest) {
            setLastTx(result.digest);
            setStatusMsg('✅ Coordinator onayı başarılı!');
            setTimeout(() => handleLoadPackages(), 2000);
          }
        },
        onError: (e: any) => {
          setLoading(false);
          console.error('Coordinator onay hatası:', e);
          setStatusMsg('❌ Coordinator onayı başarısız: ' + e.message);
        },
      },
    );
  };

  // Yeni: Recipient onayı
  const handleRecipientApprove = (p: AidPackageInfo) => {
    if (!account) {
      alert('Recipient işlemi için önce cüzdan bağla.');
      return;
    }

    const txb = new Transaction();
    txb.moveCall({
      target: `${AIDCHAIN_PACKAGE_ID}::aidchain::approve_as_recipient`,
      arguments: [txb.object(p.id)],
    });

    setLoading(true);
    setStatusMsg('Recipient onayı gönderiliyor...');
    setLastTx(null);

    signAndExecute(
      { transaction: txb },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          if (result.digest) {
            setLastTx(result.digest);
            setStatusMsg('✅ Recipient onayı başarılı!');
            setTimeout(() => handleLoadPackages(), 2000);
          }
        },
        onError: (e: any) => {
          setLoading(false);
          console.error('Recipient onay hatası:', e);
          setStatusMsg('❌ Recipient onayı başarısız: ' + e.message);
        },
      },
    );
  };

  const handleMarkDelivered = (p: AidPackageInfo) => {
    if (!account) {
      alert('Koordinatör işlemi için önce cüzdan bağla.');
      return;
    }

    // İsteğe bağlı: Koordinatör kontrolü (şimdilik uyarı şeklinde)
    if (p.coordinator.toLowerCase() !== account.address.toLowerCase()) {
      const proceed = confirm(
        'Bu paketin koordinatörü sen değilsin gibi görünüyor. Yine de denemek istiyor musun?',
      );
      if (!proceed) return;
    }

    const proof = proofInputs[p.id] || '';
    if (!proof) {
      alert('Lütfen Walrus proof URL gir.');
      return;
    }

    const txb = new Transaction();
    txb.moveCall({
      target: `${AIDCHAIN_PACKAGE_ID}::aidchain::mark_delivered`,
      arguments: [
        txb.object(p.id),         // &mut AidPackage (shared object)
        txb.pure.string(proof),   // proof_url: string::String
      ],
    });

    setLoading(true);
    setStatusMsg('Teslim bilgisi gönderiliyor...');
    setLastTx(null);

    signAndExecute(
      {
        transaction: txb,
      },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          console.log('Mark delivered result:', result);
          
          if (!result.digest) {
            setStatusMsg('❌ İşlem digest bilgisi alınamadı');
            return;
          }
          
          // ÖNEMLİ: Effects kontrolü - transaction gerçekten başarılı mı?
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          setLastTx(result.digest);
          
          // Transaction başarısız olduysa
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Bilinmeyen hata';
            console.error('Transaction failed:', errorMsg);
            
            // Yetersiz bakiye kontrolü
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('❌ Yetersiz bakiye! Gas ücreti için yeterli SUI yok.');
            } 
            // Yetki kontrolü
            else if (errorMsg.toLowerCase().includes('unauthorized') || 
                     errorMsg.toLowerCase().includes('permission')) {
              setStatusMsg('❌ Bu işlem için yetkiniz yok. Sadece koordinatör bu işlemi yapabilir.');
            } else {
              setStatusMsg(`❌ İşlem başarısız: ${errorMsg}`);
            }
            return;
          }
          
          // Transaction başarılı
          if (executionStatus === 'success') {
            setStatusMsg('✅ Teslim bilgisi başarıyla blockchain\'e kaydedildi!');
            // Tekrar listeyi yenileyelim ki yeni statü + proof_url gelsin
            setTimeout(() => handleLoadPackages(), 2000);
          } else {
            // Status belirsiz
            setStatusMsg(`⚠️ İşlem durumu belirsiz. Tx: ${result.digest}`);
          }
        },
        onError: (err: any) => {
          console.error('Mark delivered error:', err);
          setLoading(false);
          
          let errorMessage = '❌ ';
          
          if (err?.message) {
            errorMessage += err.message;
          } else if (typeof err === 'string') {
            errorMessage += err;
          } else {
            errorMessage += 'Teslim işlemi başarısız oldu';
          }
          
          // Yetersiz bakiye kontrolü
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = '❌ Yetersiz bakiye! Gas ücreti için yeterli SUI yok.';
          }
          
          // Yetki kontrolü
          if (errorMessage.toLowerCase().includes('unauthorized') || 
              errorMessage.toLowerCase().includes('permission')) {
            errorMessage = '❌ Bu işlem için yetkiniz yok. Sadece koordinatör bu işlemi yapabilir.';
          }
          
          // Kullanıcı iptal etti
          if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = '❌ İşlem kullanıcı tarafından iptal edildi.';
          }
          
          setStatusMsg(errorMessage);
        },
      },
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">🎯</div>
        <h2>Koordinatör Paneli</h2>
      </div>

      {!account ? (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Koordinatör işlemleri için önce cüzdanını bağlamalısın.</span>
        </div>
      ) : (
        <div className="account-info">
          <div className="account-avatar">
            {account.address.slice(2, 4).toUpperCase()}
          </div>
          <div className="account-details">
            <div className="account-label">Koordinatör Adresi</div>
            <div className="account-address">{account.address}</div>
          </div>
        </div>
      )}

      <div className="registry-section">
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <span>ℹ️</span>
          <div>
            <strong>Registry ID Otomatik Yüklendi</strong>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              AidChain Global Registry: <code style={{ background: '#e0e7ff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{AIDCHAIN_REGISTRY_ID}</code>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
              💡 Bu ID tüm AidChain paketlerini içerir. Farklı bir registry kullanmak istersen aşağıdan değiştirebilirsin.
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">
            Registry ID (İsteğe Bağlı Değiştir)
            <input
              className="form-input"
              value={registryId}
              onChange={(e) => setRegistryId(e.target.value)}
              placeholder="Registry object ID"
            />
          </label>
        </div>
        <button 
          onClick={handleLoadPackages} 
          disabled={loading}
          className="btn btn-primary btn-block"
        >
          {loading && <span className="spinner"></span>}
          {loading ? 'Yükleniyor...' : '📦 Paketleri Yükle'}
        </button>
      </div>

      {statusMsg && (
        <div className={`alert ${statusMsg.includes('✅') || statusMsg.includes('başarı') ? 'alert-success' : statusMsg.includes('❌') ? 'alert-error' : 'alert-info'}`}>
          {statusMsg}
        </div>
      )}

      {packages.length > 0 && (
        <>
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <span>🔒</span>
            <div>
              <strong>Escrow Sistemi Aktif</strong>
              <br />
              <small>
                Bağışlar pakette kilitlidir. Teslim ettiğinizde otomatik olarak size aktarılacaktır.
              </small>
            </div>
          </div>
          
          <div className="alert alert-info" style={{ marginBottom: '1.5rem', background: 'var(--gray-50)' }}>
            <span>ℹ️</span>
            <div>
              <strong>Escrow Nasıl Doğrulanır?</strong>
              <br />
              <small style={{ fontSize: '0.85rem' }}>
                1. Paketteki 🔍 "Explorer'da Doğrula" linkine tıklayın
                <br />
                2. Sui Explorer'da "Fields" bölümüne bakın
                <br />
                3. <code style={{ background: 'white', padding: '2px 6px', borderRadius: '3px' }}>locked_donation</code> field'ında coin göreceksiniz
                <br />
                4. 🔒 <strong>"Kilitli"</strong> etiketi = Bağış güvende
              </small>
            </div>
          </div>
        </>
      )}

      {packages.length === 0 && !loading && !statusMsg && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Henüz Paket Yok</div>
          <div className="empty-state-description">
            Registry ID girerek paketleri yükleyebilirsin
          </div>
        </div>
      )}

      {packages.length > 0 && (
        <div className="package-list">
          {packages.map((p) => (
            <div key={p.id} className="package-card">
              <div className="package-header">
                <div>
                  <div className="package-title">{p.description}</div>
                  <span className={`status-badge ${
                    p.status === 0 ? 'status-created' : 
                    p.status === 1 ? 'status-in-transit' : 
                    'status-delivered'
                  }`}>
                    {statusLabel(p.status)}
                  </span>
                </div>
              </div>

              <div className="package-info">
                <div className="info-item">
                  <div className="info-label">Lokasyon</div>
                  <div className="info-value">📍 {p.location}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Bağış Miktarı</div>
                  <div className="info-value">
                    💰 {(Number(p.donation_amount) / 1_000_000_000).toFixed(4)} SUI
                    {p.is_locked && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--warning-light)', borderRadius: '6px', border: '1px solid var(--warning-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning-color)', fontWeight: 600, fontSize: '0.85rem' }}>
                          🔒 ESCROW'DA KİLİTLİ
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                          Pakette güvenle saklanıyor
                        </div>
                      </div>
                    )}
                    {!p.is_locked && p.status === 2 && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--success-light)', borderRadius: '6px', border: '1px solid var(--success-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontWeight: 600, fontSize: '0.85rem' }}>
                          ✓ SERBEST BIRAKILDI
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                          Koordinatöre aktarıldı
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Paket ID</div>
                  <div className="info-value">
                    <code>{p.id.slice(0, 20)}...</code>
                    <div style={{ marginTop: '0.5rem' }}>
                      <a 
                        href={`https://testnet.suivision.xyz/object/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          fontSize: '0.8rem', 
                          color: 'var(--primary-color)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        🔍 SuiVision'da Doğrula →
                      </a>
                    </div>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Bağışçı</div>
                  <div className="info-value">
                    <code>{p.donor.slice(0, 10)}...{p.donor.slice(-8)}</code>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Koordinatör</div>
                  <div className="info-value">
                    <code>{p.coordinator.slice(0, 10)}...{p.coordinator.slice(-8)}</code>
                  </div>
                </div>
              </div>

              {p.proof_url && (
                <div className="info-item" style={{ marginTop: '1rem' }}>
                  <div className="info-label">Walrus Kanıt Linki</div>
                  <div className="info-value">
                    <a href={p.proof_url} target="_blank" rel="noreferrer">
                      🔗 {p.proof_url}
                    </a>
                  </div>
                </div>
              )}

              {/* Onay Durumları */}
              {p.status !== 2 && (
                <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                  <span>📋</span>
                  <div>
                    <strong>Çoklu İmza Durumu:</strong>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {p.coordinator_approved ? '✅' : '⏳'}
                        <span>Coordinator Onayı</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {p.recipient_approved ? '✅' : '⏳'}
                        <span>Recipient Onayı</span>
                      </div>
                    </div>
                    {p.delivery_note && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        📝 Not: {p.delivery_note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Coordinator Onay Bölümü */}
              {p.status !== 2 && !p.coordinator_approved && (
                <div className="proof-section">
                  <div className="form-group">
                    <label className="form-label">
                      🏢 Coordinator Onayı + Teslim Notu
                      <textarea
                        className="form-input"
                        placeholder="Örn: Paket hazırlandı, teslime hazır"
                        value={deliveryNotes[p.id] ?? ''}
                        onChange={(e) => handleDeliveryNoteChange(p.id, e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                  <button
                    className="button button-primary"
                    onClick={() => handleCoordinatorApprove(p)}
                    disabled={loading}
                  >
                    ✅ Coordinator Onayla
                  </button>
                </div>
              )}

              {/* Recipient Onay Bölümü */}
              {p.status !== 2 && !p.recipient_approved && (
                <div className="proof-section">
                  <button
                    className="button button-success"
                    onClick={() => handleRecipientApprove(p)}
                    disabled={loading}
                    style={{ marginTop: '0.5rem' }}
                  >
                    ✅ Recipient Onayla
                  </button>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    💡 Recipient olarak bu paketi onaylayabilirsin
                  </p>
                </div>
              )}

              {p.status !== 2 && (
                <div className="proof-section">
                  <div className="form-group">
                    <label className="form-label">
                      📸 Teslim Proof URL (Walrus)
                      <input
                        className="form-input"
                        placeholder="https://walrus.link/..."
                        value={proofInputs[p.id] ?? ''}
                        onChange={(e) => handleProofChange(p.id, e.target.value)}
                      />
                    </label>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                    ⚠️ Teslim edebilmek için:
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                      <li>✅ Coordinator onaylamış olmalı</li>
                      <li>✅ Recipient onaylamış olmalı</li>
                      <li>✅ Proof URL girilmiş olmalı</li>
                      <li>✅ Minimum 1 epoch (~24 saat) geçmiş olmalı</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => handleMarkDelivered(p)}
                    disabled={loading || !account || !p.coordinator_approved || !p.recipient_approved}
                    className="btn btn-success btn-block"
                    style={{ 
                      opacity: (!p.coordinator_approved || !p.recipient_approved) ? 0.5 : 1,
                      cursor: (!p.coordinator_approved || !p.recipient_approved) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading && <span className="spinner"></span>}
                    ✅ Teslim Edildi Olarak İşaretle
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lastTx && (
        <div className="tx-link">
          <span>✅</span>
          <div>
            <strong>İşlem Başarılı!</strong>
            <br />
            <a
              href={`https://testnet.suivision.xyz/txblock/${lastTx}`}
              target="_blank"
              rel="noreferrer"
            >
              SuiVision'da Görüntüle →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

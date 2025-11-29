// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mysten/dapp-kit/dist/index.css';
import './style.css';

import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DonationApp } from './DonationApp';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// ✅ Yeni registry ID (init_registry ile oluşturduğun):
const DEFAULT_REGISTRY_ID =
  '0x044a5051f2b68d7d6e62c763f24ef0118c072e44f9b11e17f8a698724004eaba';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl('testnet'),
  },
});

// --------------------
// React: Bağışçı Paneli
// --------------------
const rootElement = document.getElementById('donation-root')!;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <DonationApp />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

// --------------------
// Vanilla TS: Explorer (Registry + Paketler)
// --------------------

// Testnet fullnode client (read-only)
const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

const registryInput = document.getElementById(
  'registry-input',
) as HTMLInputElement | null;
const loadBtn = document.getElementById(
  'load-packages',
) as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;
const packagesDiv = document.getElementById(
  'packages',
) as HTMLDivElement | null;

// 👉 İSTEDİĞİN KISIM: Sayfa açıldığında registry ID otomatik dolsun
if (registryInput && DEFAULT_REGISTRY_ID) {
  registryInput.value = DEFAULT_REGISTRY_ID;
}

function status(msg: string) {
  if (statusDiv) statusDiv.textContent = msg;
}

function statusLabel(s: number): string {
  if (s === 0) return '📦 Oluşturuldu';
  if (s === 1) return '🚚 Yolda';
  if (s === 2) return '✅ Teslim Edildi';
  return '❓ Bilinmiyor';
}

async function loadRegistry(registryId: string) {
  status('Registry okunuyor...');

  const registryObj = await client.getObject({
    id: registryId,
    options: { showContent: true },
  });

  if ((registryObj as any).error) {
    const err = (registryObj as any).error;
    status(`Registry okunamadı: ${err.code ?? 'bilinmeyen hata'}`);
    return null;
  }

  const content = (registryObj as any).data?.content;
  if (!content || content.dataType !== 'moveObject') {
    status('Registry formatı geçersiz');
    return null;
  }

  return (content as any).fields;
}

async function loadPackages(registryId: string) {
  const reg = await loadRegistry(registryId);
  if (!reg) return;

  const ids: string[] = reg.packages;

  if (!ids || ids.length === 0) {
    status('Henüz kayıtlı yardım paketi yok.');
    if (packagesDiv) packagesDiv.innerHTML = '';
    return;
  }

  status(`Toplam ${ids.length} paket bulundu. Yükleniyor...`);

  const objs = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });

  if (!packagesDiv) return;
  packagesDiv.innerHTML = '';

  objs.forEach((obj, i) => {
    if ((obj as any).error) return;

    const content = (obj as any).data?.content;
    if (!content || content.dataType !== 'moveObject') return;

    const f = (content as any).fields;

    const card = document.createElement('div');
    card.className = 'card';

    const recipientStr = String(f.recipient ?? '');
    const proof: string = f.proof_url ?? '';

    card.innerHTML = `
      <h3>Paket #${i + 1}</h3>
      <p><strong>Açıklama:</strong> ${f.description}</p>
      <p><strong>Lokasyon:</strong> ${f.location}</p>
      <p><strong>Durum:</strong> ${statusLabel(Number(f.status))}</p>
      <p><strong>Bağışçı:</strong> ${f.donor}</p>
      <p><strong>Koordinatör:</strong> ${f.coordinator}</p>
      <p><strong>Recipient:</strong> ${recipientStr}</p>
      <p><strong>Bağış Tutarı (MIST):</strong> ${f.donation_amount}</p>
      <p><strong>Teslim Kanıtı (Walrus):</strong> ${
        proof && proof.length > 0
          ? `<a href="${proof}" target="_blank" rel="noreferrer">${proof}</a>`
          : 'Henüz eklenmedi'
      }</p>
      <small>created_epoch: ${f.created_at_epoch}, updated_epoch: ${f.updated_at_epoch}</small>
    `;

    packagesDiv.appendChild(card);
  });

  status('Paketler başarıyla yüklendi.');
}

// Butona click handler bağla
if (loadBtn) {
  loadBtn.onclick = () => {
    const id = registryInput?.value.trim();
    if (!id) {
      status('Lütfen registry ID gir.');
      return;
    }
    loadPackages(id);
  };
}

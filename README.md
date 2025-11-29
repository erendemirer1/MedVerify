# 🌍 AidChain - Blockchain Tabanlı Yardım Platformu

Afet ve kriz durumlarında şeffaf, güvenli ve denetlenebilir yardım dağıtımı için Sui blockchain üzerine inşa edilmiş bir platform.

## ✨ Özellikler

### 🔒 **Escrow Güvenliği**
- Bağışlar pakette güvenle kilitlenir
- Teslim edilene kadar koordinatör erişemez
- Teslim edilmezse bağışçı geri alabilir
- Blockchain üzerinde tam şeffaflık

### 📦 **Paket Yönetimi**
- Koordinatörler yardım paketleri oluşturur
- Her paketin benzersiz ID'si vardır
- Gerçek zamanlı durum takibi
- Sui Explorer entegrasyonu

### 💰 **Güvenli Bağış**
- Wallet entegrasyonu (Sui Wallet, Ethos vb.)
- Transaction doğrulama
- Escrow durumu görüntüleme
- Başarısız işlemler otomatik tespit edilir

### 👥 **Şeffaf İzleme**
- Tüm işlemler blockchain'de
- Herkes doğrulayabilir
- Koordinatör paneli ile yönetim
- Delivery tracking

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js 18+
- Sui CLI (smart contract deployment için)
- Sui Wallet tarayıcı eklentisi

### Frontend Kurulumu

```bash
cd frontend
npm install
npm run dev
```

Uygulama http://localhost:5173 adresinde çalışacaktır.

### Smart Contract Deployment

```bash
cd contracts/aidchain
sui move build
sui client publish --gas-budget 100000000
```

Deployment sonrası:
1. Package ID'yi kopyalayın
2. Registry object ID'yi bulun
3. `frontend/src/config.ts` dosyasını güncelleyin

## 📝 Kullanım

### Koordinatör Olarak

1. **Paket Oluştur**
   ```typescript
   // CoordinatorPanel'de "Paket Oluştur" butonuna tıklayın
   // Açıklama, konum ve hedef tutarı girin
   ```

2. **Bağışları İzle**
   - Aktif paketlerde escrow durumu görünür
   - 🔒 Kilitli: Henüz teslim edilmedi
   - ✓ Serbest: Koordinatöre aktarıldı

3. **Paketi Teslim Et**
   ```typescript
   // "Teslim Edildi Olarak İşaretle" butonuna tıklayın
   // Escrow serbest bırakılır
   ```

### Bağışçı Olarak

1. **Paket Seç**
   - Ana sayfada aktif paketleri görüntüleyin
   - Paket detaylarını inceleyin

2. **Bağış Yap**
   ```typescript
   // Bağış miktarını girin (min: 0.001 SUI)
   // Wallet'ı bağlayın ve onayla
   ```

3. **Escrow Doğrula**
   - Bağış sonrası "Explorer'da Görüntüle" linkine tıklayın
   - `locked_donation` field'ını kontrol edin
   - Detaylı rehber: [ESCROW_DOGRULAMA.md](./ESCROW_DOGRULAMA.md)

## 🏗️ Proje Yapısı

```
aidchain/
├── contracts/
│   └── aidchain/
│       ├── sources/
│       │   └── aidchain.move      # Smart contract
│       └── Move.toml
├── frontend/
│   ├── src/
│   │   ├── DonationApp.tsx        # Ana bağış ekranı
│   │   ├── CoordinatorPanel.tsx   # Koordinatör paneli
│   │   ├── DonationForm.tsx       # Bağış formu
│   │   ├── buildDonateTx.ts       # Transaction builder
│   │   ├── config.ts              # Blockchain config
│   │   └── style.css              # UI tasarımı
│   └── index.html
└── ESCROW_DOGRULAMA.md            # Escrow rehberi
```

## 🔧 Teknolojiler

### Frontend
- **React 19.2.0**: Modern UI framework
- **TypeScript 5.9.3**: Type-safe development
- **Vite 7.2.4**: Lightning-fast build tool
- **@mysten/dapp-kit 0.19.9**: Sui wallet integration
- **@mysten/sui 1.45.0**: Sui SDK

### Blockchain
- **Sui Blockchain**: High-performance L1
- **Move Language**: Safe smart contracts
- **Testnet**: Development and testing

### Design
- CSS Variables
- Inter Font Family
- Gradient Backgrounds
- Glassmorphism Effects
- Responsive Grid

## 🛡️ Güvenlik

### Smart Contract Güvenliği
- ✅ Escrow pattern ile bağış kilitleme
- ✅ Şartlı serbest bırakma (delivery required)
- ✅ Refund mekanizması
- ✅ Access control (koordinatör yetkisi)

### Frontend Güvenliği
- ✅ Transaction effects validation
- ✅ Balance checking
- ✅ Error handling
- ✅ User feedback

### Doğrulama
```bash
# Smart contract test
cd contracts/aidchain
sui move test

# Frontend build check
cd frontend
npm run build
```

## 📊 Deployed Instances

### Testnet (V2 - Gelişmiş Escrow Sistemi)
- **Package ID**: `0x25e720914e3a022de71e49469d1b38787fd08293bb6756c2dad838847ff12aff`
- **Registry ID**: `0xc31120749a5e25dae01d0b8f3094188ab67911546828cde189c791e4d69130ff`
- **Network**: Sui Testnet
- **Explorer**: https://testnet.suivision.xyz/

### 📍 Registry ID Nasıl Bulunur?

Registry ID **frontend'e zaten gömülü** (`src/config.ts`). Kullanıcıların manuel olarak girmesine gerek yok!

**Opsiyonel:** Farklı bir registry kullanmak istersen:

1. **Sui CLI ile sorgulama**:
```bash
sui client object 0xc31120749a5e25dae01d0b8f3094188ab67911546828cde189c791e4d69130ff
```

2. **SuiVision'da görüntüleme**:
```
https://testnet.suivision.xyz/object/0xc31120749a5e25dae01d0b8f3094188ab67911546828cde189c791e4d69130ff
```

3. **Coordinator Panel'de değiştirme**:
   - UI'da "Registry ID (İsteğe Bağlı Değiştir)" alanından güncelleyebilirsin
   - Default registry tüm paketleri içerir

### 🔄 Yeni Registry Oluşturma (STK'lar için):

Kendi bağımsız registry'nizi oluşturmak isterseniz:

```bash
sui client call \
  --package 0x25e720914e3a022de71e49469d1b38787fd08293bb6756c2dad838847ff12aff \
  --module aidchain \
  --function init_registry \
  --gas-budget 10000000
```

Dönen `ObjectID`'yi kopyala ve `src/config.ts`'e ekle.

## 🎨 UI Tasarım

- **Primary Color**: Purple gradient (667eea → 764ba2)
- **Cards**: White with subtle shadow, 16px border radius
- **Buttons**: Gradient hover effects, smooth transitions
- **Alerts**: Info (blue), Success (green), Error (red)
- **Typography**: Inter font family, responsive sizes
- **Responsive**: Mobile-first, adapts to all screens

## 📚 Dökümantasyon

- [Escrow Doğrulama Rehberi](./ESCROW_DOGRULAMA.md)
- [Sui Move Documentation](https://docs.sui.io/concepts/sui-move-concepts)
- [@mysten/dapp-kit Docs](https://sdk.mystenlabs.com/dapp-kit)

## 🐛 Sorun Giderme

### Build Hatası
```bash
# Dependencies'i temizle ve yeniden yükle
rm -rf node_modules package-lock.json
npm install
```

### Transaction Başarısız
- Wallet'ta yeterli SUI balance olduğunu kontrol edin
- Gas fee için ~0.01 SUI ekstra bırakın
- Transaction effects'te hata mesajını kontrol edin

### Escrow Görünmüyor
- [ESCROW_DOGRULAMA.md](./ESCROW_DOGRULAMA.md) rehberini takip edin
- Sui Explorer'da "Fields" sekmesine bakın
- Package object ID'yi doğru kopyaladığınızdan emin olun

## 🤝 Katkıda Bulunma

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🙏 Teşekkürler

- [Sui Foundation](https://sui.io/) - Blockchain infrastructure
- [Mysten Labs](https://mystenlabs.com/) - SDK and tools
- Community contributors

---

**Güven değil, kod!** 🔒✨

Built with ❤️ for transparent aid distribution

module aidchain::aidchain {
    use std::string;
    use std::vector;
    use std::option;

    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::coin;
    use sui::sui::SUI;

    /// Yardım paketinin durumları
    const STATUS_CREATED: u8 = 0;
    const STATUS_IN_TRANSIT: u8 = 1;
    const STATUS_DELIVERED: u8 = 2;

    /// Hata kodları
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_STATUS: u64 = 2;
    const E_NOT_DONOR: u64 = 3;
    const E_ALREADY_DELIVERED: u64 = 4;
    const E_EMPTY_PROOF_URL: u64 = 5;
    const E_INVALID_RECIPIENT: u64 = 6;
    const E_TOO_EARLY_DELIVERY: u64 = 7;
    const E_NO_LOCKED_DONATION: u64 = 8;
    const E_INVALID_AMOUNT: u64 = 9;
    const E_NOT_APPROVED: u64 = 10;

    /// Minimum teslim süresi (epoch cinsinden) - TEST için 0 (Production'da 1 yapılabilir)
    const MIN_DELIVERY_EPOCHS: u64 = 0;

    /// Tüm yardım paketlerinin ID'lerini tutan global registry.
    public struct AidRegistry has key {
        id: object::UID,
        /// Registry'yi ilk oluşturan admin adresi (STK / organizasyon cüzdanı)
        admin: address,
        /// Tüm paketlerin ID'leri
        packages: vector<object::ID>,
        /// Kayıtlı recipient profil ID'leri
        recipient_profiles: vector<object::ID>,
    }

    /// Yardım almaya ihtiyacı olan kişinin profili
    public struct RecipientProfile has key {
        id: object::UID,
        /// Recipient'in adresi
        recipient: address,
        /// İsim/Tanım (örn: "Ahmet Yılmaz - Depremzede")
        name: string::String,
        /// Lokasyon
        location: string::String,
        /// İhtiyaç kategorisi (örn: "Gıda", "Barınma", "Sağlık")
        need_category: string::String,
        /// Doğrulama durumu (STK tarafından onaylanmış mı?)
        is_verified: bool,
        /// Kayıt tarihi
        registered_at_epoch: u64,
        /// Alınan toplam bağış sayısı
        received_packages_count: u64,
    }

    /// Tekil bir yardım paketi
    /// Walrus entegrasyonu:
    /// - proof_url: Teslim anındaki fotoğraf / imzalı form gibi kanıtın Walrus URL'si
    /// Escrow: Bağış bu pakette kilitli kalır, teslim edilince coordinatora aktarılır
    public struct AidPackage has key {
        id: object::UID,
        /// Bağışçının adresi
        donor: address,
        /// Paketi yöneten STK / organizasyon adresi
        coordinator: address,
        /// Nihai alıcının adresi (PoC'de opsiyonel)
        recipient: option::Option<address>,
        /// Hangi bölge için (örn: "Hatay/Antakya", "İstanbul/Üsküdar")
        location: string::String,
        /// Kısa açıklama (örn: "Gıda Paketi", "Çocuk bezi + mama")
        description: string::String,
        /// Durum (created / in_transit / delivered)
        status: u8,
        /// Walrus üzerinde saklanan teslim kanıtının URL'si
        proof_url: string::String,
        /// Oluşturulduğu epoch
        created_at_epoch: u64,
        /// Son güncelleme epoch
        updated_at_epoch: u64,
        /// Bağış tutarı (Mist cinsinden)
        donation_amount: u64,
        /// ESCROW: Bağış pakette kilitli - sadece teslimde serbest bırakılır
        locked_donation: option::Option<coin::Coin<SUI>>,
        /// Teslim notu (coordinator ekler)
        delivery_note: option::Option<string::String>,
        /// Recipient onayı (çoklu imza için)
        recipient_approved: bool,
        /// Coordinator onayı (çoklu imza için)
        coordinator_approved: bool,
    }

    /// Statü değişim event'i – zincirde izleme için
    public struct AidStatusChanged has copy, drop {
        package_id: object::ID,
        old_status: u8,
        new_status: u8,
        actor: address,
    }

    /// Gelişmiş teslim event'i - tüm detayları içerir
    public struct DeliveryCompleted has copy, drop {
        package_id: object::ID,
        coordinator: address,
        recipient: address,
        donation_amount: u64,
        proof_url: string::String,
        delivery_note: option::Option<string::String>,
        epoch: u64,
    }

    /// Onay event'i - çoklu imza tracking
    public struct ApprovalReceived has copy, drop {
        package_id: object::ID,
        approver: address,
        approver_type: string::String, // "coordinator" veya "recipient"
        epoch: u64,
    }

    /// Refund event'i
    public struct RefundProcessed has copy, drop {
        package_id: object::ID,
        donor: address,
        amount: u64,
        reason: string::String,
        epoch: u64,
    }

    /// İlk registry'yi oluşturmak için entry fonksiyon.
    /// Bunu deploy'dan sonra sadece 1 kere çağırırsın.
    public entry fun init_registry(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let registry = AidRegistry {
            id: object::new(ctx),
            admin: sender,
            packages: vector::empty<object::ID>(),
            recipient_profiles: vector::empty<object::ID>(),
        };

        // Tüm ağ tarafından erişilebilir shared object
        transfer::share_object(registry);
    }

    /// İleride admin'e özel fonksiyon yazarsan kullanırsın (şu an kullanılmıyor)
    fun assert_admin(registry: &AidRegistry, caller: address) {
        assert!(registry.admin == caller, E_NOT_AUTHORIZED);
    }

    /// Yardıma ihtiyacı olan kişi kendini kaydettirir
    public entry fun register_recipient(
        registry: &mut AidRegistry,
        name: string::String,
        location: string::String,
        need_category: string::String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch(ctx);

        let profile = RecipientProfile {
            id: object::new(ctx),
            recipient: sender,
            name,
            location,
            need_category,
            is_verified: false, // STK onaylayana kadar false
            registered_at_epoch: now,
            received_packages_count: 0,
        };

        let profile_id = object::id(&profile);
        vector::push_back(&mut registry.recipient_profiles, profile_id);

        // Profile'ı shared yap ki herkes görebilsin
        transfer::share_object(profile);
    }

    /// STK recipient'i doğrular (onaylar)
    public entry fun verify_recipient(
        registry: &AidRegistry,
        profile: &mut RecipientProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Sadece admin doğrulayabilir
        assert_admin(registry, sender);
        
        profile.is_verified = true;
    }

    /// Yeni yardım paketi + gerçek SUI bağışı
    /// - donation: Coin<SUI> on-chain bağış - PAKETTE KİLİTLİ KALIR
    /// - Sadece teslim edildiğinde coordinator'a aktarılır
    /// - recipient: Kayıtlı recipient adresi (zorunlu!)
    public entry fun donate(
        registry: &mut AidRegistry,
        description: string::String,
        location: string::String,
        coordinator: address,
        recipient: address, // Yeni: Recipient zorunlu!
        donation: coin::Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let donor = tx_context::sender(ctx);
        let now = tx_context::epoch(ctx);
        let amount = coin::value(&donation);

        let package = AidPackage {
            id: object::new(ctx),
            donor,
            coordinator,
            recipient: option::some(recipient), // Artık zorunlu!
            location,
            description,
            status: STATUS_CREATED,
            proof_url: string::utf8(b""), // Teslim kanıtı henüz yok
            created_at_epoch: now,
            updated_at_epoch: now,
            donation_amount: amount,
            locked_donation: option::some(donation), // ESCROW: Bağış pakette kilitli
            delivery_note: option::none<string::String>(),
            recipient_approved: false,
            coordinator_approved: false,
        };

        let package_id = object::id(&package);

        // Registry'ye paketin ID'sini ekle
        vector::push_back(&mut registry.packages, package_id);

        // Paketi shared yap ki durum güncellenebilsin
        // Bağış pakette kaldığı için güvende
        transfer::share_object(package);
    }

    /// Statü güncellemeden önce basit kontrol:
    /// Şimdilik: sadece coordinator statüyü değiştirebilsin.
    fun assert_can_update(package: &AidPackage, actor: address) {
        assert!(package.coordinator == actor, 2);
    }

    public entry fun mark_in_transit(
        package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_can_update(package, sender);

        let old = package.status;
        package.status = STATUS_IN_TRANSIT;
        package.updated_at_epoch = tx_context::epoch(ctx);

        let package_id = object::id(package);

        event::emit(AidStatusChanged {
            package_id,
            old_status: old,
            new_status: STATUS_IN_TRANSIT,
            actor: sender,
        });
    }

    /// Coordinator onayı - çoklu imza sisteminin 1. adımı
    public entry fun approve_as_coordinator(
        package: &mut AidPackage,
        delivery_note: string::String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(package.coordinator == sender, E_NOT_AUTHORIZED);
        assert!(package.status != STATUS_DELIVERED, E_ALREADY_DELIVERED);

        package.coordinator_approved = true;
        package.delivery_note = option::some(delivery_note);

        let package_id = object::id(package);
        event::emit(ApprovalReceived {
            package_id,
            approver: sender,
            approver_type: string::utf8(b"coordinator"),
            epoch: tx_context::epoch(ctx),
        });
    }

    /// Recipient onayı - çoklu imza sisteminin 2. adımı
    /// Recipient onayı - sadece pakette belirlenmiş recipient onaylayabilir
    public entry fun approve_as_recipient(
        package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Recipient mutlaka belirlenmiş olmalı (artık ilk gelen recipient olamaz!)
        assert!(option::is_some(&package.recipient), E_INVALID_RECIPIENT);

        // Sadece belirlenen recipient onaylayabilir
        let recipient_addr = *option::borrow(&package.recipient);
        assert!(recipient_addr == sender, E_INVALID_RECIPIENT);
        assert!(package.status != STATUS_DELIVERED, E_ALREADY_DELIVERED);

        package.recipient_approved = true;

        let package_id = object::id(package);
        event::emit(ApprovalReceived {
            package_id,
            approver: sender,
            approver_type: string::utf8(b"recipient"),
            epoch: tx_context::epoch(ctx),
        });
    }

    /// GELİŞMİŞ Teslim fonksiyonu - SADECE RECİPİENT TESLİM EDEBİLİR
    /// Yeni tasarım:
    /// 1. ✅ Sadece recipient teslim edebilir (coordinator değil!)
    /// 2. ✅ Proof URL zorunluluğu
    /// 3. ✅ Minimum süre kontrolü
    /// 4. ✅ Çoklu imza (hem coordinator hem recipient onaylı olmalı)
    /// 5. ✅ Bağış miktarı doğrulama
    /// 6. ✅ Detaylı event
    /// 7. ✅ Delivery note desteği
    public entry fun mark_delivered(
        package: &mut AidPackage,
        proof_url: string::String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let now = tx_context::epoch(ctx);

        // 1. Recipient doğrulama - SADECE RECİPİENT TESLİM EDEBİLİR!
        assert!(option::is_some(&package.recipient), E_INVALID_RECIPIENT);
        let recipient_addr = *option::borrow(&package.recipient);
        assert!(recipient_addr == sender, E_INVALID_RECIPIENT);

        // 2. Proof URL zorunluluğu
        assert!(string::length(&proof_url) > 0, E_EMPTY_PROOF_URL);

        // 3. Paket zaten teslim edilmemiş olmalı
        assert!(package.status != STATUS_DELIVERED, E_ALREADY_DELIVERED);

        // 4. Minimum süre kontrolü (1 epoch = ~24 saat)
        let elapsed = now - package.created_at_epoch;
        assert!(elapsed >= MIN_DELIVERY_EPOCHS, E_TOO_EARLY_DELIVERY);

        // 5. Çoklu imza kontrolü - HEM coordinator HEM recipient onaylamış olmalı
        assert!(package.coordinator_approved, E_NOT_APPROVED);
        assert!(package.recipient_approved, E_NOT_APPROVED);

        // 6. Bağış miktarı doğrulama
        assert!(option::is_some(&package.locked_donation), E_NO_LOCKED_DONATION);
        let donation_value = coin::value(option::borrow(&package.locked_donation));
        assert!(donation_value == package.donation_amount, E_INVALID_AMOUNT);

        // Status güncelle
        let old = package.status;
        package.status = STATUS_DELIVERED;
        package.updated_at_epoch = now;
        package.proof_url = proof_url;

        // ESCROW RELEASE: Bağış teslimde coordinator'a aktarılır
        let donation = option::extract(&mut package.locked_donation);
        transfer::public_transfer(donation, package.coordinator);

        let package_id = object::id(package);

        // Detaylı delivery event
        event::emit(DeliveryCompleted {
            package_id,
            coordinator: package.coordinator,
            recipient: recipient_addr,
            donation_amount: package.donation_amount,
            proof_url: package.proof_url,
            delivery_note: package.delivery_note,
            epoch: now,
        });

        // Eski status event (geriye uyumluluk)
        event::emit(AidStatusChanged {
            package_id,
            old_status: old,
            new_status: STATUS_DELIVERED,
            actor: sender,
        });
    }

    /// GELİŞMİŞ İade fonksiyonu
    /// Bağışçı iade talep edebilir (örn: teslim edilemedi, iptal edildi)
    /// Sadece bağışçı çağırabilir ve paket henüz teslim edilmemişse
    public entry fun refund_to_donor(
        package: &mut AidPackage,
        reason: string::String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Sadece bağışçı iade alabilir
        assert!(package.donor == sender, E_NOT_DONOR);
        
        // Paket henüz teslim edilmemişse iade edilebilir
        assert!(package.status != STATUS_DELIVERED, E_ALREADY_DELIVERED);

        // Bağış olmalı
        assert!(option::is_some(&package.locked_donation), E_NO_LOCKED_DONATION);

        let amount = package.donation_amount;
        let package_id = object::id(package);

        // ESCROW REFUND: Bağış bağışçıya iade edilir
        let donation = option::extract(&mut package.locked_donation);
        transfer::public_transfer(donation, package.donor);

        // Refund event
        event::emit(RefundProcessed {
            package_id,
            donor: package.donor,
            amount,
            reason,
            epoch: tx_context::epoch(ctx),
        });
    }

    /// VIEW FONKSIYONLARI - Frontend için bilgi okuma
    
    /// Paketin kilitli bağış durumunu kontrol et
    public fun has_locked_donation(package: &AidPackage): bool {
        option::is_some(&package.locked_donation)
    }

    /// Kilitli bağış miktarını al (varsa)
    public fun get_locked_donation_amount(package: &AidPackage): u64 {
        if (option::is_some(&package.locked_donation)) {
            coin::value(option::borrow(&package.locked_donation))
        } else {
            0
        }
    }

    /// Paket detaylarını al
    public fun get_package_info(package: &AidPackage): (
        address, // donor
        address, // coordinator
        u8,      // status
        u64,     // donation_amount
        bool,    // has_locked_donation
        bool,    // recipient_approved
        bool     // coordinator_approved
    ) {
        (
            package.donor,
            package.coordinator,
            package.status,
            package.donation_amount,
            option::is_some(&package.locked_donation),
            package.recipient_approved,
            package.coordinator_approved
        )
    }
}

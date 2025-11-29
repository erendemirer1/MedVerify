// src/config.ts

// ====== RECİPİENT REGİSTRY SİSTEMİ V3 ======
// Yeni özellikler:
// - Alıcı kayıt sistemi (register_recipient)
// - STK doğrulama sistemi (verify_recipient)
// - Çoklu imza (coordinator + recipient onayı)
// - Minimum teslim süresi (1 epoch ~24 saat)
// - Proof URL zorunluluğu
// - Delivery note desteği
// - Gelişmiş event sistemi
// - Bağış miktarı doğrulama

export const AIDCHAIN_PACKAGE_ID =
  '0x70dceb362b0a8cd3d70476356ac2ea0d45e100bdb10be36bf291212026237ca1';

export const AIDCHAIN_REGISTRY_ID =
  '0xd53b026c9b6f989a0216c93fbe4ffb7a8b9bb275f53042605d1e24ded937f936';

export const REGISTRY_INITIAL_SHARED_VERSION = 670251424;

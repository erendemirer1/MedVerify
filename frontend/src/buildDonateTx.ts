// src/buildDonateTx.ts
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

export function buildDonateTx(
  description: string,
  location: string,
  recipientAddress: string,
  amountSui: number,
) {
  const txb = new Transaction();

  const amountMist = BigInt(Math.floor(amountSui * 1_000_000_000));
  const [donationCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(amountMist)]);

  txb.moveCall({
    target: `${AIDCHAIN_PACKAGE_ID}::aidchain::donate`,
    arguments: [
      txb.sharedObjectRef({
        objectId: AIDCHAIN_REGISTRY_ID,
        initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
        mutable: true,
      }),
      txb.pure.string(description),
      txb.pure.string(location),
      txb.pure.address('0x114aa1f7c47970c88eaafac9c127f9ee9fbb91047fa04426f66a26d62034a813'), // Senin cüzdanın (Yeni registry admin)
      txb.pure.address(recipientAddress),
      donationCoin,
    ],
  });

  return txb;
}

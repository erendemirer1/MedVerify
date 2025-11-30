// src/buildDonateTx.ts
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

/**
 * Build a donation transaction
 * Creates an aid package with locked donation
 * 
 * Note: Recipient is NOT assigned in this transaction.
 * After this transaction, use assign_recipient to assign a verified recipient.
 * 
 * @param description - Description of the aid package
 * @param location - Location for delivery
 * @param amountSui - Amount in SUI to donate
 */
export function buildDonateTx(
  description: string,
  location: string,
  amountSui: number,
) {
  const txb = new Transaction();

  const amountMist = BigInt(Math.floor(amountSui * 1_000_000_000));
  const [donationCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(amountMist)]);

  // Smart contract uses vector<u8> for location and description
  const encoder = new TextEncoder();

  txb.moveCall({
    target: `${AIDCHAIN_PACKAGE_ID}::aidchain::create_aid_package`,
    arguments: [
      txb.sharedObjectRef({
        objectId: AIDCHAIN_REGISTRY_ID,
        initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
        mutable: true,
      }),
      txb.pure(encoder.encode(location)),        // location: vector<u8>
      txb.pure(encoder.encode(description)),     // description: vector<u8>
      donationCoin,                              // donation: Coin<SUI>
    ],
  });

  return txb;
}

/**
 * Build assign recipient transaction
 * Assigns a verified recipient to an existing aid package
 * 
 * @param aidPackageId - The ID of the aid package
 * @param aidPackageVersion - Initial shared version of the aid package
 * @param recipientProfileId - The ID of the recipient's profile
 */
export function buildAssignRecipientTx(
  aidPackageId: string,
  aidPackageVersion: number,
  recipientProfileId: string,
) {
  const txb = new Transaction();

  txb.moveCall({
    target: `${AIDCHAIN_PACKAGE_ID}::aidchain::assign_recipient`,
    arguments: [
      txb.sharedObjectRef({
        objectId: aidPackageId,
        initialSharedVersion: aidPackageVersion,
        mutable: true,
      }),
      txb.object(recipientProfileId),  // profile: &RecipientProfile (owned object)
    ],
  });

  return txb;
}

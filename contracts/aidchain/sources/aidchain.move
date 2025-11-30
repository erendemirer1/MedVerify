module aidchain::aidchain {
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};

    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    // ============================================
    // CONSTANTS
    // ============================================
    
    /// Aid package status codes
    const STATUS_CREATED: u8 = 0;
    const STATUS_IN_TRANSIT: u8 = 1;
    const STATUS_DELIVERED: u8 = 2;

    /// Proposal status codes
    const PROPOSAL_PENDING: u8 = 0;
    const PROPOSAL_APPROVED: u8 = 1;
    const PROPOSAL_REJECTED: u8 = 2;
    const PROPOSAL_EXPIRED: u8 = 3;

    /// Error codes
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
    const E_NOT_VERIFIER: u64 = 11;
    const E_ALREADY_VERIFIER: u64 = 12;
    // V8: Removed verifier removal
    const E_ALREADY_VOTED: u64 = 15;
    const E_PROPOSAL_EXPIRED: u64 = 16;
    const E_PROPOSAL_NOT_PENDING: u64 = 17;
    const E_QUORUM_NOT_MET: u64 = 18;
    const E_ALREADY_EXECUTED: u64 = 19;
    const E_NOT_ENOUGH_APPROVALS: u64 = 20;
    const E_RECIPIENT_NOT_VERIFIED: u64 = 21;
    const E_PROPOSAL_EXISTS: u64 = 22;
    const E_ADMIN_CANNOT_REGISTER: u64 = 23;

    /// Minimum delivery time (in epochs)
    const MIN_DELIVERY_EPOCHS: u64 = 0;

    /// DAO default settings
    const DEFAULT_VOTING_PERIOD: u64 = 10;     // 10 epoch (~10 dakika testnet)
    const DEFAULT_QUORUM_PERCENT: u64 = 50;    // 50% quorum
    const DEFAULT_APPROVAL_PERCENT: u64 = 60;  // 60% approval

    // ============================================
    // DAO VOTING SYSTEM
    // ============================================

    /// DAO Configuration
    public struct DAOConfig has store, copy, drop {
        voting_period_epochs: u64,
        quorum_percent: u64,
        approval_percent: u64,
    }

    /// Global registry for all aid packages
    public struct AidRegistry has key {
        id: UID,
        admin: address,
        verifiers: vector<address>,
        packages: vector<ID>,
        recipient_profiles: vector<ID>,
        proposals: vector<ID>,
        profiles_with_proposals: vector<ID>,  // V10: Profiles with active proposals
        dao_config: DAOConfig,
        total_donations: u64,
        total_delivered: u64,
    }

    /// Recipient verification proposal (Proposal)
    public struct VerificationProposal has key {
        id: UID,
        profile_id: ID,
        profile_owner: address,
        proposer: address,
        votes_for: vector<address>,
        votes_against: vector<address>,
        created_at_epoch: u64,
        expires_at_epoch: u64,
        status: u8,
        executed: bool,
        execution_epoch: Option<u64>,
    }

    /// Profile of a person in need of aid
    public struct RecipientProfile has key {
        id: UID,
        recipient: address,
        name: String,
        location: String,
        is_verified: bool,
        verified_by: Option<address>,
        registered_at_epoch: u64,
        verified_at_epoch: Option<u64>,
        received_packages_count: u64,
        tc_hash: String,
        phone: String,
        residence_blob_id: String,        // Residence document (Walrus)
        income_blob_id: String,           // Gelir belgesi (Walrus)
        extra_document_blob_id: String,   // Extra document (Walrus) - health report, disability certificate etc.
        family_size: u64,
        description: String,
        proposal_id: Option<ID>,
        votes_received: u64,
    }

    /// Aid package
    public struct AidPackage has key {
        id: UID,
        donor: address,
        coordinator: address,
        recipient: Option<address>,
        location: String,
        description: String,
        status: u8,
        proof_url: String,
        created_at_epoch: u64,
        updated_at_epoch: u64,
        donation_amount: u64,
        locked_donation: Option<Coin<SUI>>,
        delivery_note: Option<String>,
        recipient_approved: bool,
        coordinator_approved: bool,
    }

    // ============================================
    // EVENTS
    // ============================================

    public struct AidStatusChanged has copy, drop {
        package_id: ID,
        old_status: u8,
        new_status: u8,
        actor: address,
    }

    public struct DeliveryCompleted has copy, drop {
        package_id: ID,
        coordinator: address,
        recipient: address,
        donation_amount: u64,
        proof_url: String,
        delivery_note: Option<String>,
        epoch: u64,
    }

    public struct ApprovalReceived has copy, drop {
        package_id: ID,
        approver: address,
        approver_type: String,
        epoch: u64,
    }

    public struct RefundProcessed has copy, drop {
        package_id: ID,
        donor: address,
        amount: u64,
        reason: String,
        epoch: u64,
    }

    public struct VerifierAdded has copy, drop {
        registry_id: ID,
        verifier: address,
        added_by: address,
        epoch: u64,
    }

    // V8: VerifierRemoved removed - verifiers cannot be removed once added

    public struct RecipientVerified has copy, drop {
        profile_id: ID,
        recipient: address,
        verified_by: address,
        epoch: u64,
    }

    // DAO Events
    public struct ProposalCreated has copy, drop {
        proposal_id: ID,
        profile_id: ID,
        proposer: address,
        expires_at_epoch: u64,
        epoch: u64,
    }

    public struct VoteCast has copy, drop {
        proposal_id: ID,
        voter: address,
        vote_for: bool,
        votes_for_count: u64,
        votes_against_count: u64,
        epoch: u64,
    }

    public struct ProposalExecuted has copy, drop {
        proposal_id: ID,
        profile_id: ID,
        approved: bool,
        final_votes_for: u64,
        final_votes_against: u64,
        epoch: u64,
    }

    public struct DAOConfigUpdated has copy, drop {
        registry_id: ID,
        voting_period: u64,
        quorum_percent: u64,
        approval_percent: u64,
        updated_by: address,
        epoch: u64,
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /// Creates the initial registry
    public entry fun init_registry(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let mut verifiers = vector::empty<address>();
        vector::push_back(&mut verifiers, sender);

        let dao_config = DAOConfig {
            voting_period_epochs: DEFAULT_VOTING_PERIOD,
            quorum_percent: DEFAULT_QUORUM_PERCENT,
            approval_percent: DEFAULT_APPROVAL_PERCENT,
        };

        let registry = AidRegistry {
            id: object::new(ctx),
            admin: sender,
            verifiers,
            packages: vector::empty<ID>(),
            recipient_profiles: vector::empty<ID>(),
            proposals: vector::empty<ID>(),
            profiles_with_proposals: vector::empty<ID>(),
            dao_config,
            total_donations: 0,
            total_delivered: 0,
        };

        transfer::share_object(registry);
    }

    /// Update DAO config (admin only)
    public entry fun update_dao_config(
        registry: &mut AidRegistry,
        voting_period: u64,
        quorum_percent: u64,
        approval_percent: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_admin(registry, sender);

        registry.dao_config = DAOConfig {
            voting_period_epochs: voting_period,
            quorum_percent,
            approval_percent,
        };

        event::emit(DAOConfigUpdated {
            registry_id: object::id(registry),
            voting_period,
            quorum_percent,
            approval_percent,
            updated_by: sender,
            epoch: tx_context::epoch(ctx),
        });
    }

    fun assert_admin(registry: &AidRegistry, caller: address) {
        assert!(registry.admin == caller, E_NOT_AUTHORIZED);
    }

    fun assert_verifier(registry: &AidRegistry, caller: address) {
        let is_admin = registry.admin == caller;
        let is_in_list = vector::contains(&registry.verifiers, &caller);
        assert!(is_admin || is_in_list, E_NOT_VERIFIER);
    }

    public fun is_verifier(registry: &AidRegistry, addr: address): bool {
        registry.admin == addr || vector::contains(&registry.verifiers, &addr)
    }

    public fun get_verifiers(registry: &AidRegistry): vector<address> {
        registry.verifiers
    }

    public fun verifier_count(registry: &AidRegistry): u64 {
        vector::length(&registry.verifiers)
    }

    public fun get_admin(registry: &AidRegistry): address {
        registry.admin
    }

    public fun get_dao_config(registry: &AidRegistry): DAOConfig {
        registry.dao_config
    }

    /// Yeni verifier ekle (sadece admin)
    public entry fun add_verifier(
        registry: &mut AidRegistry,
        new_verifier: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_admin(registry, sender);
        
        let already_exists = vector::contains(&registry.verifiers, &new_verifier);
        assert!(!already_exists, E_ALREADY_VERIFIER);
        
        vector::push_back(&mut registry.verifiers, new_verifier);

        event::emit(VerifierAdded {
            registry_id: object::id(registry),
            verifier: new_verifier,
            added_by: sender,
            epoch: tx_context::epoch(ctx),
        });
    }

    // V8: remove_verifier removed - Verifiers cannot be removed from blockchain
    // Security: Admin cannot arbitrarily remove DAO members

    // ============================================
    // DAO VOTING FUNCTIONS
    // ============================================

    /// Create recipient verification proposal (any verifier)
    /// V11: Uses profile_id and profile_owner as parameters instead of RecipientProfile object
    /// This allows creating proposals for profiles owned by ANY address
    public entry fun create_verification_proposal(
        registry: &mut AidRegistry,
        profile_id: ID,
        profile_owner: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_verifier(registry, sender);
        
        // Verify profile exists in registry
        assert!(vector::contains(&registry.recipient_profiles, &profile_id), E_INVALID_RECIPIENT);
        
        // Already has active proposal? (V10: check from registry)
        assert!(!vector::contains(&registry.profiles_with_proposals, &profile_id), E_PROPOSAL_EXISTS);

        let current_epoch = tx_context::epoch(ctx);
        let expires_at = current_epoch + registry.dao_config.voting_period_epochs;

        // Proposer automatically votes in favor
        let mut votes_for = vector::empty<address>();
        vector::push_back(&mut votes_for, sender);

        let proposal = VerificationProposal {
            id: object::new(ctx),
            profile_id,
            profile_owner,
            proposer: sender,
            votes_for,
            votes_against: vector::empty<address>(),
            created_at_epoch: current_epoch,
            expires_at_epoch: expires_at,
            status: PROPOSAL_PENDING,
            executed: false,
            execution_epoch: option::none(),
        };

        let proposal_id = object::id(&proposal);
        
        // V10: Add to registry instead of writing to profile
        vector::push_back(&mut registry.profiles_with_proposals, profile_id);
        
        // Add proposal to registry
        vector::push_back(&mut registry.proposals, proposal_id);

        event::emit(ProposalCreated {
            proposal_id,
            profile_id,
            proposer: sender,
            expires_at_epoch: expires_at,
            epoch: current_epoch,
        });

        transfer::share_object(proposal);
    }

    /// Vote on proposal
    public entry fun vote_on_proposal(
        registry: &AidRegistry,
        proposal: &mut VerificationProposal,
        vote_for: bool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        // Verifier check
        assert_verifier(registry, sender);
        
        // Proposal status check
        assert!(proposal.status == PROPOSAL_PENDING, E_PROPOSAL_NOT_PENDING);
        
        // Time check
        assert!(current_epoch <= proposal.expires_at_epoch, E_PROPOSAL_EXPIRED);
        
        // Already voted?
        let already_voted_for = vector::contains(&proposal.votes_for, &sender);
        let already_voted_against = vector::contains(&proposal.votes_against, &sender);
        assert!(!already_voted_for && !already_voted_against, E_ALREADY_VOTED);

        // Oy ekle
        if (vote_for) {
            vector::push_back(&mut proposal.votes_for, sender);
        } else {
            vector::push_back(&mut proposal.votes_against, sender);
        };

        event::emit(VoteCast {
            proposal_id: object::id(proposal),
            voter: sender,
            vote_for,
            votes_for_count: vector::length(&proposal.votes_for),
            votes_against_count: vector::length(&proposal.votes_against),
            epoch: current_epoch,
        });
    }

    /// Execute proposal (if quorum and majority met)
    public entry fun execute_proposal(
        registry: &mut AidRegistry,
        proposal: &mut VerificationProposal,
        profile: &mut RecipientProfile,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        
        // Already executed?
        assert!(!proposal.executed, E_ALREADY_EXECUTED);
        
        // Profile ID match
        assert!(object::id(profile) == proposal.profile_id, E_INVALID_RECIPIENT);

        let total_verifiers = vector::length(&registry.verifiers);
        let votes_for = vector::length(&proposal.votes_for);
        let votes_against = vector::length(&proposal.votes_against);
        let total_votes = votes_for + votes_against;

        // Quorum check (at least 1 vote required)
        let quorum_threshold = if (total_verifiers == 0) { 1 } else {
            let threshold = (total_verifiers * registry.dao_config.quorum_percent) / 100;
            if (threshold == 0) { 1 } else { threshold }
        };
        let quorum_met = total_votes >= quorum_threshold;

        // Time expired?
        let expired = current_epoch > proposal.expires_at_epoch;

        // Karar ver
        let approved: bool;
        
        if (expired && !quorum_met) {
            // Time expired and quorum not met
            proposal.status = PROPOSAL_EXPIRED;
            approved = false;
        } else if (quorum_met) {
            // Quorum met, check majority
            let approval_threshold = if (total_votes == 0) { 1 } else {
                let threshold = (total_votes * registry.dao_config.approval_percent) / 100;
                if (threshold == 0) { 1 } else { threshold }
            };
            
            if (votes_for >= approval_threshold) {
                proposal.status = PROPOSAL_APPROVED;
                approved = true;
                
                // Verify profile
                profile.is_verified = true;
                profile.verified_at_epoch = option::some(current_epoch);
                profile.votes_received = votes_for;
                profile.verified_by = option::some(proposal.proposer);
            } else {
                proposal.status = PROPOSAL_REJECTED;
                approved = false;
            }
        } else {
            // Quorum not yet met and time not expired
            assert!(false, E_QUORUM_NOT_MET);
            approved = false;
        };

        proposal.executed = true;
        proposal.execution_epoch = option::some(current_epoch);
        
        // V10: Remove profile from registry
        let profile_id = object::id(profile);
        let (found, idx) = vector::index_of(&registry.profiles_with_proposals, &profile_id);
        if (found) {
            vector::remove(&mut registry.profiles_with_proposals, idx);
        };

        event::emit(ProposalExecuted {
            proposal_id: object::id(proposal),
            profile_id: object::id(profile),
            approved,
            final_votes_for: votes_for,
            final_votes_against: votes_against,
            epoch: current_epoch,
        });

        if (approved) {
            event::emit(RecipientVerified {
                profile_id: object::id(profile),
                recipient: profile.recipient,
                verified_by: proposal.proposer,
                epoch: current_epoch,
            });
        }
    }

    /// Proposal durumunu kontrol et
    public fun get_proposal_status(proposal: &VerificationProposal): (u8, u64, u64, bool) {
        (
            proposal.status,
            vector::length(&proposal.votes_for),
            vector::length(&proposal.votes_against),
            proposal.executed
        )
    }

    /// Quorum check (at least 1 vote required)
    public fun check_quorum(registry: &AidRegistry, proposal: &VerificationProposal): bool {
        let total_verifiers = vector::length(&registry.verifiers);
        let total_votes = vector::length(&proposal.votes_for) + vector::length(&proposal.votes_against);
        let quorum_threshold = (total_verifiers * registry.dao_config.quorum_percent) / 100;
        total_votes >= quorum_threshold
    }

    // ============================================
    // ACIL DURUM: Admin direkt onay (bypass DAO)
    // ============================================

    public entry fun admin_verify_recipient(
        registry: &mut AidRegistry,
        profile: &mut RecipientProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_admin(registry, sender);

        profile.is_verified = true;
        profile.verified_by = option::some(sender);
        profile.verified_at_epoch = option::some(tx_context::epoch(ctx));

        event::emit(RecipientVerified {
            profile_id: object::id(profile),
            recipient: profile.recipient,
            verified_by: sender,
            epoch: tx_context::epoch(ctx),
        });
    }

    // ============================================
    // RECIPIENT REGISTRATION FUNCTIONS
    // ============================================

    public entry fun register_recipient(
        registry: &mut AidRegistry,
        name: vector<u8>,
        location: vector<u8>,
        tc_hash: vector<u8>,
        phone: vector<u8>,
        residence_blob_id: vector<u8>,
        income_blob_id: vector<u8>,
        extra_document_blob_id: vector<u8>,
        family_size: u64,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);

        // Admin or verifier cannot apply
        let is_admin_or_verifier = is_verifier(registry, sender);
        assert!(!is_admin_or_verifier, E_ADMIN_CANNOT_REGISTER);

        let profile = RecipientProfile {
            id: object::new(ctx),
            recipient: sender,
            name: string::utf8(name),
            location: string::utf8(location),
            is_verified: false,
            verified_by: option::none(),
            registered_at_epoch: current_epoch,
            verified_at_epoch: option::none(),
            received_packages_count: 0,
            tc_hash: string::utf8(tc_hash),
            phone: string::utf8(phone),
            residence_blob_id: string::utf8(residence_blob_id),
            income_blob_id: string::utf8(income_blob_id),
            extra_document_blob_id: string::utf8(extra_document_blob_id),
            family_size,
            description: string::utf8(description),
            proposal_id: option::none(),
            votes_received: 0,
        };

        let profile_id = object::id(&profile);
        vector::push_back(&mut registry.recipient_profiles, profile_id);

        transfer::transfer(profile, sender);
    }

    // ============================================
    // AID PACKAGE FUNCTIONS
    // ============================================

    public entry fun create_aid_package(
        registry: &mut AidRegistry,
        location: vector<u8>,
        description: vector<u8>,
        donation: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        let donation_amount = coin::value(&donation);

        assert!(donation_amount > 0, E_INVALID_AMOUNT);

        let aid_package = AidPackage {
            id: object::new(ctx),
            donor: sender,
            coordinator: sender,
            recipient: option::none(),
            location: string::utf8(location),
            description: string::utf8(description),
            status: STATUS_CREATED,
            proof_url: string::utf8(b""),
            created_at_epoch: current_epoch,
            updated_at_epoch: current_epoch,
            donation_amount,
            locked_donation: option::some(donation),
            delivery_note: option::none(),
            recipient_approved: false,
            coordinator_approved: false,
        };

        let pkg_id = object::id(&aid_package);
        vector::push_back(&mut registry.packages, pkg_id);
        registry.total_donations = registry.total_donations + donation_amount;

        transfer::share_object(aid_package);
    }

    /// Assign package to verified recipient
    public entry fun assign_recipient(
        aid_package: &mut AidPackage,
        profile: &RecipientProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(aid_package.donor == sender || aid_package.coordinator == sender, E_NOT_AUTHORIZED);
        assert!(aid_package.status == STATUS_CREATED, E_INVALID_STATUS);
        assert!(profile.is_verified, E_RECIPIENT_NOT_VERIFIED);

        aid_package.recipient = option::some(profile.recipient);
        aid_package.status = STATUS_IN_TRANSIT;
        aid_package.updated_at_epoch = tx_context::epoch(ctx);

        event::emit(AidStatusChanged {
            package_id: object::id(aid_package),
            old_status: STATUS_CREATED,
            new_status: STATUS_IN_TRANSIT,
            actor: sender,
        });
    }

    /// Mark as delivered
    public entry fun mark_delivered(
        aid_package: &mut AidPackage,
        delivery_note: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        let is_recipient = option::is_some(&aid_package.recipient) && 
                          *option::borrow(&aid_package.recipient) == sender;
        
        assert!(is_recipient, E_NOT_AUTHORIZED);
        assert!(aid_package.status == STATUS_IN_TRANSIT, E_INVALID_STATUS);

        let old_status = aid_package.status;
        aid_package.status = STATUS_DELIVERED;
        aid_package.updated_at_epoch = current_epoch;
        
        if (vector::length(&delivery_note) > 0) {
            aid_package.delivery_note = option::some(string::utf8(delivery_note));
        };

        aid_package.recipient_approved = true;

        event::emit(AidStatusChanged {
            package_id: object::id(aid_package),
            old_status,
            new_status: STATUS_DELIVERED,
            actor: sender,
        });
    }

    /// Coordinator approval
    public entry fun coordinator_approve(
        aid_package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(aid_package.coordinator == sender, E_NOT_AUTHORIZED);
        assert!(aid_package.status == STATUS_DELIVERED, E_INVALID_STATUS);

        aid_package.coordinator_approved = true;

        event::emit(ApprovalReceived {
            package_id: object::id(aid_package),
            approver: sender,
            approver_type: string::utf8(b"coordinator"),
            epoch: tx_context::epoch(ctx),
        });
    }

    /// Release funds
    public entry fun release_funds(
        registry: &mut AidRegistry,
        aid_package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        assert!(aid_package.status == STATUS_DELIVERED, E_INVALID_STATUS);
        assert!(aid_package.recipient_approved && aid_package.coordinator_approved, E_NOT_APPROVED);
        assert!(option::is_some(&aid_package.locked_donation), E_NO_LOCKED_DONATION);

        let recipient = *option::borrow(&aid_package.recipient);
        let donation = option::extract(&mut aid_package.locked_donation);
        let amount = coin::value(&donation);

        registry.total_delivered = registry.total_delivered + amount;

        event::emit(DeliveryCompleted {
            package_id: object::id(aid_package),
            coordinator: aid_package.coordinator,
            recipient,
            donation_amount: amount,
            proof_url: aid_package.proof_url,
            delivery_note: aid_package.delivery_note,
            epoch: tx_context::epoch(ctx),
        });

        transfer::public_transfer(donation, recipient);
    }

    /// Refund donation
    public entry fun refund_donation(
        registry: &mut AidRegistry,
        aid_package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        assert!(aid_package.donor == sender, E_NOT_DONOR);
        assert!(aid_package.status != STATUS_DELIVERED, E_ALREADY_DELIVERED);
        assert!(option::is_some(&aid_package.locked_donation), E_NO_LOCKED_DONATION);

        let donation = option::extract(&mut aid_package.locked_donation);
        let amount = coin::value(&donation);

        registry.total_donations = registry.total_donations - amount;

        event::emit(RefundProcessed {
            package_id: object::id(aid_package),
            donor: sender,
            amount,
            reason: string::utf8(b"donor_requested"),
            epoch: tx_context::epoch(ctx),
        });

        transfer::public_transfer(donation, sender);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    public fun get_registry_stats(registry: &AidRegistry): (u64, u64, u64, u64) {
        (
            vector::length(&registry.packages),
            vector::length(&registry.recipient_profiles),
            registry.total_donations,
            registry.total_delivered
        )
    }

    public fun get_profile_info(profile: &RecipientProfile): (address, bool, u64, u64) {
        (
            profile.recipient,
            profile.is_verified,
            profile.received_packages_count,
            profile.votes_received
        )
    }

    public fun get_package_info(pkg: &AidPackage): (u8, u64, bool, bool) {
        (
            pkg.status,
            pkg.donation_amount,
            pkg.recipient_approved,
            pkg.coordinator_approved
                                                                                        )
    }
}

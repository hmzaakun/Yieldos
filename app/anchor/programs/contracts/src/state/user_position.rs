use anchor_lang::prelude::*;

#[account]
pub struct UserPosition {
    /// The user who owns this position
    pub user: Pubkey,
    
    /// The strategy this position belongs to
    pub strategy: Pubkey,
    
    /// Principal amount deposited by the user
    pub deposited_amount: u64,
    
    /// Yield tokens minted to this user
    pub yield_tokens_minted: u64,
    
    /// When the user made the deposit
    pub deposit_time: i64,
    
    /// Last time the user claimed yield (for continuous yield calculation)
    pub last_yield_claim: i64,
    
    /// Total yield claimed by this user
    pub total_yield_claimed: u64,
    
    /// Position ID for easy tracking
    pub position_id: u64,
}

impl UserPosition {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // user
        32 + // strategy
        8 + // deposited_amount
        8 + // yield_tokens_minted
        8 + // deposit_time
        8 + // last_yield_claim
        8 + // total_yield_claimed
        8; // position_id
}

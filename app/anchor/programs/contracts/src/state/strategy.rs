use anchor_lang::prelude::*;

#[account]
pub struct Strategy {
    /// Admin who created and manages this strategy
    pub admin: Pubkey,
    
    /// The underlying token that users deposit (SOL, USDC, etc.)
    pub underlying_token: Pubkey,
    
    /// The yield token mint for this strategy (yYieldos, yUSDC, etc.)
    pub yield_token_mint: Pubkey,
    
    /// Strategy name (e.g., "Yieldos Staking Strategy")
    pub name: String,
    
    /// Annual Percentage Yield in basis points (1000 = 10.00%)
    pub apy: u64,
    
    /// Total amount deposited in this strategy
    pub total_deposits: u64,
    
    /// Whether this strategy is currently accepting deposits
    pub is_active: bool,
    
    /// When this strategy was created
    pub created_at: i64,
    
    /// Total yield tokens minted for this strategy
    pub total_yield_tokens_minted: u64,
    
    /// Strategy ID for easy identification
    pub strategy_id: u64,
}

impl Strategy {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // admin
        32 + // underlying_token
        32 + // yield_token_mint
        4 + 64 + // name (String with length prefix, max 64 chars)
        8 + // apy
        8 + // total_deposits
        1 + // is_active
        8 + // created_at
        8 + // total_yield_tokens_minted
        8; // strategy_id
    
    /// Calculate the accumulated yield for a given amount and time period
    pub fn calculate_yield(&self, principal: u64, time_elapsed_seconds: i64) -> u64 {
        if time_elapsed_seconds <= 0 {
            return 0;
        }
        
        // Annual yield = principal * APY / 10000
        let annual_yield = (principal as u128 * self.apy as u128) / 10000;
        
        // Pro-rated yield based on time elapsed
        let seconds_per_year = 365 * 24 * 60 * 60;
        let accrued_yield = (annual_yield * time_elapsed_seconds as u128) / seconds_per_year as u128;
        
        accrued_yield as u64
    }
    
    /// Check if strategy is valid for operations
    pub fn is_operational(&self) -> bool {
        self.is_active
    }
}

#[account]
pub struct StrategyCounter {
    /// Current strategy count for ID generation
    pub count: u64,
}

impl StrategyCounter {
    pub const INIT_SPACE: usize = 8 + 8; // discriminator + count
} 
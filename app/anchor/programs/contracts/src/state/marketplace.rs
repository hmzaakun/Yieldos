use anchor_lang::prelude::*;

#[account]
pub struct Marketplace {
    /// Admin who manages the marketplace
    pub admin: Pubkey,
    
    /// Strategy this marketplace is for
    pub strategy: Pubkey,
    
    /// Yield token being traded
    pub yield_token_mint: Pubkey,
    
    /// Underlying token for pricing
    pub underlying_token_mint: Pubkey,
    
    /// Total trading volume
    pub total_volume: u64,
    
    /// Total number of trades executed
    pub total_trades: u64,
    
    /// Current best bid price (in underlying tokens per yield token)
    /// Price format: fixed-point with 6 decimals (1000000 = 1.0)
    pub best_bid_price: u64,
    
    /// Current best ask price (in underlying tokens per yield token)
    pub best_ask_price: u64,
    
    /// Trading fee in basis points (100 = 1%)
    pub trading_fee_bps: u16,
    
    /// Whether trading is enabled
    pub is_active: bool,
    
    /// When the marketplace was created
    pub created_at: i64,
    
    /// Marketplace ID
    pub marketplace_id: u64,
}

impl Marketplace {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // admin
        32 + // strategy
        32 + // yield_token_mint
        32 + // underlying_token_mint
        8 + // total_volume
        8 + // total_trades
        8 + // best_bid_price
        8 + // best_ask_price
        2 + // trading_fee_bps
        1 + // is_active
        8 + // created_at
        8; // marketplace_id
}

#[account]
pub struct TradeOrder {
    /// User who placed the order
    pub user: Pubkey,
    
    /// Marketplace this order belongs to
    pub marketplace: Pubkey,
    
    /// Order type: 0 = Buy, 1 = Sell
    pub order_type: u8,
    
    /// Amount of yield tokens
    pub yield_token_amount: u64,
    
    /// Price per yield token (in underlying tokens)
    /// Fixed-point with 6 decimals
    pub price_per_token: u64,
    
    /// Total value of the order (amount * price)
    pub total_value: u64,
    
    /// Amount already filled
    pub filled_amount: u64,
    
    /// Whether the order is still active
    pub is_active: bool,
    
    /// When the order was created
    pub created_at: i64,
    
    /// Order ID for tracking
    pub order_id: u64,
}

impl TradeOrder {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // user
        32 + // marketplace
        1 + // order_type
        8 + // yield_token_amount
        8 + // price_per_token
        8 + // total_value
        8 + // filled_amount
        1 + // is_active
        8 + // created_at
        8; // order_id
    
    pub const BUY_ORDER: u8 = 0;
    pub const SELL_ORDER: u8 = 1;
    
    /// Check if order can be filled
    pub fn is_fillable(&self) -> bool {
        self.is_active && self.filled_amount < self.yield_token_amount
    }
    
    /// Get remaining amount to fill
    pub fn remaining_amount(&self) -> u64 {
        self.yield_token_amount - self.filled_amount
    }
    
    /// Calculate fee for a trade amount
    pub fn calculate_fee(&self, amount: u64, fee_bps: u16) -> u64 {
        (amount as u128 * fee_bps as u128 / 10000) as u64
    }
}

#[account]
pub struct MarketplaceCounter {
    /// Current marketplace count for ID generation
    pub count: u64,
}

impl MarketplaceCounter {
    pub const INIT_SPACE: usize = 8 + 8; // discriminator + count
}

#[account]
pub struct OrderCounter {
    /// Current order count for ID generation
    pub count: u64,
}

impl OrderCounter {
    pub const INIT_SPACE: usize = 8 + 8; // discriminator + count
} 
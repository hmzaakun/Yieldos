use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::state::{strategy::Strategy, marketplace::{Marketplace, MarketplaceCounter}};

#[derive(Accounts)]
#[instruction(strategy_id: u64, marketplace_id: u64)]
pub struct CreateMarketplace<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        constraint = strategy.admin == admin.key() @ MarketplaceError::Unauthorized,
        constraint = strategy.is_operational() @ MarketplaceError::StrategyNotActive
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        init,
        payer = admin,
        seeds = [b"marketplace", strategy.key().as_ref()],
        bump,
        space = 8 + Marketplace::INIT_SPACE
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init_if_needed,
        payer = admin,
        seeds = [b"marketplace_counter"],
        bump,
        space = 8 + MarketplaceCounter::INIT_SPACE
    )]
    pub marketplace_counter: Account<'info, MarketplaceCounter>,

    /// Yield token mint for this strategy
    #[account(
        address = strategy.yield_token_mint @ MarketplaceError::WrongYieldTokenMint
    )]
    pub yield_token_mint: Account<'info, Mint>,

    /// Underlying token mint
    #[account(
        address = strategy.underlying_token @ MarketplaceError::WrongUnderlyingToken
    )]
    pub underlying_token_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_create_marketplace(
    ctx: Context<CreateMarketplace>,
    _strategy_id: u64,
    marketplace_id: u64,
    trading_fee_bps: u16,
) -> Result<()> {
    require!(trading_fee_bps <= 1000, MarketplaceError::FeeTooHigh); // Max 10% fee

    let marketplace = &mut ctx.accounts.marketplace;
    let counter = &mut ctx.accounts.marketplace_counter;
    let strategy = &ctx.accounts.strategy;
    let current_time = Clock::get()?.unix_timestamp;

    marketplace.admin = ctx.accounts.admin.key();
    marketplace.strategy = strategy.key();
    marketplace.yield_token_mint = ctx.accounts.yield_token_mint.key();
    marketplace.underlying_token_mint = ctx.accounts.underlying_token_mint.key();
    marketplace.total_volume = 0;
    marketplace.total_trades = 0;
    marketplace.best_bid_price = 0;
    marketplace.best_ask_price = 0;
    marketplace.trading_fee_bps = trading_fee_bps;
    marketplace.is_active = true;
    marketplace.created_at = current_time;
    marketplace.marketplace_id = marketplace_id;

    // Increment counter
    counter.count += 1;

    msg!(
        "Marketplace created for strategy '{}' with {}% trading fee",
        strategy.name,
        trading_fee_bps as f64 / 100.0
    );

    Ok(())
}

#[error_code]
pub enum MarketplaceError {
    #[msg("Unauthorized to create marketplace")]
    Unauthorized,
    #[msg("Strategy is not active")]
    StrategyNotActive,
    #[msg("Wrong yield token mint")]
    WrongYieldTokenMint,
    #[msg("Wrong underlying token mint")]
    WrongUnderlyingToken,
    #[msg("Trading fee too high (max 10%)")]
    FeeTooHigh,
} 
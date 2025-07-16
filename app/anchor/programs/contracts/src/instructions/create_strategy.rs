use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::state::{strategy::Strategy, strategy::StrategyCounter};

#[derive(Accounts)]
#[instruction(name: String, apy_basis_points: u16, strategy_id: u64)]
pub struct CreateStrategy<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        space = 8 + Strategy::INIT_SPACE
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        seeds = [b"strategy_counter"],
        bump
    )]
    pub strategy_counter: Account<'info, StrategyCounter>,

    /// The underlying token mint (SOL, USDC, etc.)
    pub underlying_token: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        seeds = [b"yield_token", strategy_id.to_le_bytes().as_ref()],
        bump,
        mint::decimals = underlying_token.decimals,
        mint::authority = strategy,
    )]
    pub yield_token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_create_strategy(
    ctx: Context<CreateStrategy>,
    name: String,
    apy_basis_points: u16,
    strategy_id: u64,
) -> Result<()> {
    require!(name.len() <= 64, CustomError::NameTooLong);
    require!(apy_basis_points <= 50000, CustomError::ApyTooHigh); // Max 500% APY

    let strategy = &mut ctx.accounts.strategy;
    let counter = &mut ctx.accounts.strategy_counter;
    
    strategy.admin = ctx.accounts.admin.key();
    strategy.underlying_token = ctx.accounts.underlying_token.key();
    strategy.yield_token_mint = ctx.accounts.yield_token_mint.key();
    strategy.name = name.clone();
    strategy.apy = apy_basis_points as u64;
    strategy.total_deposits = 0;
    strategy.is_active = true;
    strategy.created_at = Clock::get()?.unix_timestamp;
    strategy.total_yield_tokens_minted = 0;
    strategy.strategy_id = strategy_id;

    // Increment counter for tracking
    counter.count += 1;

    msg!(
        "Strategy '{}' created with ID {} and APY {}%",
        name,
        strategy_id,
        apy_basis_points as f64 / 100.0
    );

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"strategy_counter"],
        bump,
        space = 8 + StrategyCounter::INIT_SPACE
    )]
    pub strategy_counter: Account<'info, StrategyCounter>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize_protocol(ctx: Context<InitializeProtocol>) -> Result<()> {
    let counter = &mut ctx.accounts.strategy_counter;
    counter.count = 0;

    msg!("Yieldos protocol initialized");
    Ok(())
}

// Custom errors for strategy creation
#[error_code]
pub enum CustomError {
    #[msg("Strategy name is too long (max 64 characters)")]
    NameTooLong,
    #[msg("APY is too high (max 500%)")]
    ApyTooHigh,
} 
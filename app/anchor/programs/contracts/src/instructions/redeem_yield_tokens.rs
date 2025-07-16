use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Token, Transfer, transfer, Burn, burn};

use crate::state::{strategy::Strategy, user_position::UserPosition};

#[derive(Accounts)]
#[instruction(yield_token_amount: u64, strategy_id: u64)]
pub struct RedeemYieldTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        constraint = strategy.is_operational() @ RedeemError::StrategyNotActive
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref(), strategy.key().as_ref()],
        bump,
        constraint = user_position.user == user.key() @ RedeemError::UnauthorizedUser
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Strategy's vault for underlying tokens
    #[account(
        mut,
        seeds = [b"strategy_vault", strategy_id.to_le_bytes().as_ref()],
        bump
    )]
    pub strategy_vault: Account<'info, TokenAccount>,

    /// Yield token mint for this strategy
    #[account(
        mut,
        address = strategy.yield_token_mint @ RedeemError::WrongYieldTokenMint
    )]
    pub yield_token_mint: Account<'info, Mint>,

    /// User's yield token account (tokens will be burned from here)
    #[account(
        mut,
        constraint = user_yield_token_account.mint == yield_token_mint.key() @ RedeemError::WrongYieldTokenAccount
    )]
    pub user_yield_token_account: Account<'info, TokenAccount>,

    /// User's underlying token account (will receive SOL + yield)
    #[account(mut)]
    pub user_underlying_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_redeem_yield_tokens(
    ctx: Context<RedeemYieldTokens>,
    yield_token_amount: u64,
    strategy_id: u64,
) -> Result<()> {
    require!(yield_token_amount > 0, RedeemError::InvalidAmount);

    let strategy = &mut ctx.accounts.strategy;
    let user_position = &mut ctx.accounts.user_position;
    let current_time = Clock::get()?.unix_timestamp;

    // Check if user has sufficient yield tokens
    require!(
        ctx.accounts.user_yield_token_account.amount >= yield_token_amount,
        RedeemError::InsufficientYieldTokens
    );

    // Calculate the proportion of the position being redeemed
    let total_yield_tokens = user_position.yield_tokens_minted;
    require!(total_yield_tokens > 0, RedeemError::NoPosition);

    // Calculate principal to return (proportional to yield tokens being redeemed)
    let principal_to_return = (user_position.deposited_amount as u128 * yield_token_amount as u128) 
        / total_yield_tokens as u128;
    let principal_to_return = principal_to_return as u64;

    // Calculate accumulated yield for this portion
    let time_since_deposit = current_time - user_position.deposit_time;
    let total_yield_for_position = strategy.calculate_yield(
        user_position.deposited_amount,
        time_since_deposit,
    );
    
    // Proportional yield for the tokens being redeemed
    let yield_to_return = (total_yield_for_position as u128 * yield_token_amount as u128) 
        / total_yield_tokens as u128;
    let yield_to_return = yield_to_return as u64;

    // Total amount to transfer = principal + accumulated yield
    let total_to_transfer = principal_to_return + yield_to_return;

    // Burn the yield tokens
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.yield_token_mint.to_account_info(),
            from: ctx.accounts.user_yield_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    burn(cpi_ctx, yield_token_amount)?;

    // Transfer underlying tokens + yield from strategy vault to user
    let strategy_id_bytes = strategy_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[b"strategy", strategy_id_bytes.as_ref(), &[ctx.bumps.strategy]];
    let seeds: &[&[&[u8]]] = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.strategy_vault.to_account_info(),
            to: ctx.accounts.user_underlying_token.to_account_info(),
            authority: strategy.to_account_info(),
        },
        seeds,
    );
    transfer(cpi_ctx, total_to_transfer)?;

    // Update user position (proportional reduction)
    let remaining_yield_tokens = total_yield_tokens - yield_token_amount;
    user_position.deposited_amount -= principal_to_return;
    user_position.yield_tokens_minted = remaining_yield_tokens;

    // Update strategy stats
    strategy.total_deposits -= principal_to_return;
    strategy.total_yield_tokens_minted -= yield_token_amount;

    // If position is fully redeemed, reset it
    if remaining_yield_tokens == 0 {
        user_position.deposited_amount = 0;
        user_position.total_yield_claimed = 0;
        user_position.last_yield_claim = current_time;
    }

    msg!(
        "User {} redeemed {} yield tokens for {} principal + {} yield = {} total tokens",
        ctx.accounts.user.key(),
        yield_token_amount,
        principal_to_return,
        yield_to_return,
        total_to_transfer
    );

    Ok(())
}

#[error_code]
pub enum RedeemError {
    #[msg("Strategy is not active")]
    StrategyNotActive,
    #[msg("Unauthorized user for this position")]
    UnauthorizedUser,
    #[msg("Wrong yield token mint")]
    WrongYieldTokenMint,
    #[msg("Wrong yield token account")]
    WrongYieldTokenAccount,
    #[msg("Invalid redeem amount")]
    InvalidAmount,
    #[msg("Insufficient yield tokens")]
    InsufficientYieldTokens,
    #[msg("No position found")]
    NoPosition,
} 
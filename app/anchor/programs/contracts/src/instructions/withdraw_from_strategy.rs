use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token, Transfer, transfer};

use crate::state::{strategy::Strategy, user_position::UserPosition};

#[derive(Accounts)]
#[instruction(amount: u64, strategy_id: u64)]
pub struct WithdrawFromStrategy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        constraint = strategy.is_operational() @ WithdrawError::StrategyNotActive
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref(), strategy.key().as_ref()],
        bump,
        constraint = user_position.user == user.key() @ WithdrawError::UnauthorizedUser
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Strategy's vault for underlying tokens
    #[account(
        mut,
        seeds = [b"strategy_vault", strategy_id.to_le_bytes().as_ref()],
        bump
    )]
    pub strategy_vault: Account<'info, TokenAccount>,

    /// User's token account for receiving underlying tokens
    #[account(mut)]
    pub user_underlying_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_from_strategy(
    ctx: Context<WithdrawFromStrategy>,
    amount: u64,
    strategy_id: u64,
) -> Result<()> {
    require!(amount > 0, WithdrawError::InvalidAmount);

    let user_position = &mut ctx.accounts.user_position;
    let strategy = &mut ctx.accounts.strategy;

    // Check if user has sufficient balance
    require!(user_position.deposited_amount >= amount, WithdrawError::InsufficientBalance);

    // Users can now withdraw anytime without maturity restrictions
    // No penalties applied - full flexibility for users
    
    // Transfer tokens from strategy vault to user
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
    transfer(cpi_ctx, amount)?;

    // Update user position
    user_position.deposited_amount -= amount;

    // Update strategy stats
    strategy.total_deposits -= amount;

    msg!(
        "User {} withdrew {} tokens from strategy '{}' - No penalties applied",
        ctx.accounts.user.key(),
        amount,
        strategy.name
    );

    Ok(())
}

#[error_code]
pub enum WithdrawError {
    #[msg("Strategy is not active")]
    StrategyNotActive,
    #[msg("Unauthorized user for this position")]
    UnauthorizedUser,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid withdrawal amount")]
    InvalidAmount,
} 
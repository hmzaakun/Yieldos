use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Token, MintTo, mint_to};

use crate::state::{strategy::Strategy, user_position::UserPosition};

#[derive(Accounts)]
#[instruction(strategy_id: u64)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        constraint = strategy.is_operational() @ ClaimError::StrategyNotActive
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        seeds = [b"user_position", user.key().as_ref(), strategy.key().as_ref()],
        bump,
        constraint = user_position.user == user.key() @ ClaimError::UnauthorizedUser
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Yield token mint for this strategy
    #[account(
        mut,
        address = strategy.yield_token_mint @ ClaimError::WrongYieldTokenMint
    )]
    pub yield_token_mint: Account<'info, Mint>,

    /// User's yield token account
    #[account(mut)]
    pub user_yield_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_claim_yield(
    ctx: Context<ClaimYield>,
    strategy_id: u64,
) -> Result<()> {
    let strategy = &ctx.accounts.strategy;
    let user_position = &mut ctx.accounts.user_position;
    let current_time = Clock::get()?.unix_timestamp;

    // Calculate yield since last claim
    let time_elapsed = current_time - user_position.last_yield_claim;
    require!(time_elapsed > 0, ClaimError::NoYieldToClaim);

    let yield_amount = strategy.calculate_yield(
        user_position.deposited_amount,
        time_elapsed,
    );

    require!(yield_amount > 0, ClaimError::NoYieldToClaim);

    // Mint additional yield tokens
    let strategy_id_bytes = strategy_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[b"strategy", strategy_id_bytes.as_ref(), &[ctx.bumps.strategy]];
    let seeds: &[&[&[u8]]] = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.yield_token_mint.to_account_info(),
            to: ctx.accounts.user_yield_token_account.to_account_info(),
            authority: strategy.to_account_info(),
        },
        seeds,
    );
    mint_to(cpi_ctx, yield_amount)?;

    // Update user position
    user_position.last_yield_claim = current_time;
    user_position.total_yield_claimed += yield_amount;
    user_position.yield_tokens_minted += yield_amount;

    msg!(
        "User {} claimed {} yield tokens from strategy '{}'",
        ctx.accounts.user.key(),
        yield_amount,
        strategy.name
    );

    Ok(())
}

#[error_code]
pub enum ClaimError {
    #[msg("Strategy is not active")]
    StrategyNotActive,
    #[msg("Wrong yield token mint")]
    WrongYieldTokenMint,
    #[msg("Unauthorized user for this position")]
    UnauthorizedUser,
    #[msg("No yield to claim")]
    NoYieldToClaim,
} 
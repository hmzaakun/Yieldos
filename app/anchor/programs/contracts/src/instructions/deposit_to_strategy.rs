use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, TokenAccount, Token, MintTo, mint_to, Transfer, transfer};

use crate::state::{strategy::Strategy, user_position::UserPosition};

#[derive(Accounts)]
#[instruction(amount: u64, strategy_id: u64)]
pub struct DepositToStrategy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"strategy", strategy_id.to_le_bytes().as_ref()],
        bump,
        constraint = strategy.is_operational() @ DepositError::StrategyNotActive
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        init,
        payer = user,
        seeds = [b"user_position", user.key().as_ref(), strategy.key().as_ref()],
        bump,
        space = 8 + UserPosition::INIT_SPACE
    )]
    pub user_position: Account<'info, UserPosition>,

    /// The underlying token mint
    #[account(
        address = strategy.underlying_token @ DepositError::WrongUnderlyingToken
    )]
    pub underlying_token_mint: Account<'info, Mint>,

    /// User's token account for the underlying token
    #[account(
        mut,
        constraint = user_underlying_token.mint == underlying_token_mint.key() @ DepositError::WrongUnderlyingToken
    )]
    pub user_underlying_token: Account<'info, TokenAccount>,

    /// Strategy's vault for holding underlying tokens
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"strategy_vault", strategy_id.to_le_bytes().as_ref()],
        bump,
        token::mint = underlying_token_mint,
        token::authority = strategy,
    )]
    pub strategy_vault: Account<'info, TokenAccount>,

    /// Yield token mint for this strategy
    #[account(
        mut,
        address = strategy.yield_token_mint @ DepositError::WrongYieldTokenMint
    )]
    pub yield_token_mint: Account<'info, Mint>,

    /// User's yield token account (will be created if needed)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = yield_token_mint,
        associated_token::authority = user
    )]
    pub user_yield_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_deposit_to_strategy(
    ctx: Context<DepositToStrategy>,
    amount: u64,
    strategy_id: u64,
) -> Result<()> {
    require!(amount > 0, DepositError::InvalidAmount);

    let strategy = &mut ctx.accounts.strategy;
    let user_position = &mut ctx.accounts.user_position;
    let current_time = Clock::get()?.unix_timestamp;

    // Transfer underlying tokens from user to strategy vault
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_underlying_token.to_account_info(),
            to: ctx.accounts.strategy_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    transfer(cpi_ctx, amount)?;

    // Calculate initial yield tokens to mint based on current strategy
    // For simplicity, we start with 1:1 ratio, but this could be more sophisticated
    let yield_tokens_to_mint = amount;

    // Mint yield tokens to user
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
    mint_to(cpi_ctx, yield_tokens_to_mint)?;

    // Update user position
    user_position.user = ctx.accounts.user.key();
    user_position.strategy = strategy.key();
    user_position.deposited_amount = amount;
    user_position.yield_tokens_minted = yield_tokens_to_mint;
    user_position.deposit_time = current_time;
    user_position.last_yield_claim = current_time;
    user_position.total_yield_claimed = 0;
    user_position.position_id = strategy.total_deposits; // Simple position ID

    // Update strategy stats
    strategy.total_deposits += amount;
    strategy.total_yield_tokens_minted += yield_tokens_to_mint;

    msg!(
        "User {} deposited {} tokens to strategy '{}' and received {} yield tokens",
        ctx.accounts.user.key(),
        amount,
        strategy.name,
        yield_tokens_to_mint
    );

    Ok(())
}

#[error_code]
pub enum DepositError {
    #[msg("Strategy is not active")]
    StrategyNotActive,
    #[msg("Wrong underlying token for this strategy")]
    WrongUnderlyingToken,
    #[msg("Wrong yield token mint")]
    WrongYieldTokenMint,
    #[msg("Invalid deposit amount")]
    InvalidAmount,
} 
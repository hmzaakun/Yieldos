use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Token, Transfer, transfer};

use crate::state::marketplace::{Marketplace, TradeOrder, OrderCounter};

#[derive(Accounts)]
#[instruction(order_id: u64, order_type: u8, yield_token_amount: u64, price_per_token: u64)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = marketplace.is_active @ OrderError::MarketplaceNotActive
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = user,
        seeds = [b"order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump,
        space = 8 + TradeOrder::INIT_SPACE
    )]
    pub order: Account<'info, TradeOrder>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"order_counter"],
        bump,
        space = 8 + OrderCounter::INIT_SPACE
    )]
    pub order_counter: Account<'info, OrderCounter>,

    /// Yield token mint
    #[account(
        address = marketplace.yield_token_mint @ OrderError::WrongYieldTokenMint
    )]
    pub yield_token_mint: Account<'info, Mint>,

    /// Underlying token mint  
    #[account(
        address = marketplace.underlying_token_mint @ OrderError::WrongUnderlyingToken
    )]
    pub underlying_token_mint: Account<'info, Mint>,

    /// User's yield token account (for sell orders)
    #[account(
        mut,
        constraint = user_yield_token_account.mint == yield_token_mint.key() @ OrderError::WrongTokenAccount
    )]
    pub user_yield_token_account: Account<'info, TokenAccount>,

    /// User's underlying token account (for buy orders)
    #[account(
        mut,
        constraint = user_underlying_token_account.mint == underlying_token_mint.key() @ OrderError::WrongTokenAccount
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,

    /// Escrow account for holding tokens during order
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"escrow", order.key().as_ref()],
        bump,
        token::mint = yield_token_mint, // Will be reassigned based on order type
        token::authority = order,
    )]
    pub escrow_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_place_order(
    ctx: Context<PlaceOrder>,
    order_id: u64,
    order_type: u8,
    yield_token_amount: u64,
    price_per_token: u64,
) -> Result<()> {
    require!(yield_token_amount > 0, OrderError::InvalidAmount);
    require!(price_per_token > 0, OrderError::InvalidPrice);
    require!(
        order_type == TradeOrder::BUY_ORDER || order_type == TradeOrder::SELL_ORDER,
        OrderError::InvalidOrderType
    );

    let order = &mut ctx.accounts.order;
    let marketplace = &mut ctx.accounts.marketplace;
    let counter = &mut ctx.accounts.order_counter;
    let current_time = Clock::get()?.unix_timestamp;

    // Calculate total value
    let total_value = (yield_token_amount as u128 * price_per_token as u128 / 1_000_000) as u64;

    // Initialize order
    order.user = ctx.accounts.user.key();
    order.marketplace = marketplace.key();
    order.order_type = order_type;
    order.yield_token_amount = yield_token_amount;
    order.price_per_token = price_per_token;
    order.total_value = total_value;
    order.filled_amount = 0;
    order.is_active = true;
    order.created_at = current_time;
    order.order_id = order_id;

    if order_type == TradeOrder::SELL_ORDER {
        // For sell orders, lock yield tokens in escrow
        require!(
            ctx.accounts.user_yield_token_account.amount >= yield_token_amount,
            OrderError::InsufficientBalance
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_yield_token_account.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer(cpi_ctx, yield_token_amount)?;
    } else {
        // For buy orders, lock underlying tokens in escrow
        require!(
            ctx.accounts.user_underlying_token_account.amount >= total_value,
            OrderError::InsufficientBalance
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_underlying_token_account.to_account_info(),
                to: ctx.accounts.escrow_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer(cpi_ctx, total_value)?;
    }

    // Update marketplace best prices
    if order_type == TradeOrder::BUY_ORDER {
        if marketplace.best_bid_price == 0 || price_per_token > marketplace.best_bid_price {
            marketplace.best_bid_price = price_per_token;
        }
    } else {
        if marketplace.best_ask_price == 0 || price_per_token < marketplace.best_ask_price {
            marketplace.best_ask_price = price_per_token;
        }
    }

    // Increment counter
    counter.count += 1;

    msg!(
        "Order placed: {} {} yield tokens at {} per token (Order ID: {})",
        if order_type == TradeOrder::BUY_ORDER { "BUY" } else { "SELL" },
        yield_token_amount,
        price_per_token as f64 / 1_000_000.0,
        order_id
    );

    Ok(())
}

#[error_code]
pub enum OrderError {
    #[msg("Marketplace is not active")]
    MarketplaceNotActive,
    #[msg("Wrong yield token mint")]
    WrongYieldTokenMint,
    #[msg("Wrong underlying token mint")]
    WrongUnderlyingToken,
    #[msg("Wrong token account")]
    WrongTokenAccount,
    #[msg("Invalid order amount")]
    InvalidAmount,
    #[msg("Invalid order price")]
    InvalidPrice,
    #[msg("Invalid order type")]
    InvalidOrderType,
    #[msg("Insufficient balance")]
    InsufficientBalance,
} 
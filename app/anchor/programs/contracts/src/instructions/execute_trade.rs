use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token, Transfer, transfer};

use crate::state::marketplace::{Marketplace, TradeOrder};

#[derive(Accounts)]
#[instruction(trade_amount: u64)]
pub struct ExecuteTrade<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(mut)]
    pub marketplace: Account<'info, Marketplace>,

    /// Buy order
    #[account(
        mut,
        constraint = buy_order.order_type == TradeOrder::BUY_ORDER @ TradeError::InvalidBuyOrder,
        constraint = buy_order.is_fillable() @ TradeError::OrderNotFillable,
        constraint = buy_order.marketplace == marketplace.key() @ TradeError::OrderMarketplaceMismatch
    )]
    pub buy_order: Account<'info, TradeOrder>,

    /// Sell order  
    #[account(
        mut,
        constraint = sell_order.order_type == TradeOrder::SELL_ORDER @ TradeError::InvalidSellOrder,
        constraint = sell_order.is_fillable() @ TradeError::OrderNotFillable,
        constraint = sell_order.marketplace == marketplace.key() @ TradeError::OrderMarketplaceMismatch,
        constraint = sell_order.price_per_token <= buy_order.price_per_token @ TradeError::PriceMismatch
    )]
    pub sell_order: Account<'info, TradeOrder>,

    /// Buy order escrow (contains underlying tokens)
    #[account(
        mut,
        seeds = [b"escrow", buy_order.key().as_ref()],
        bump
    )]
    pub buy_order_escrow: Account<'info, TokenAccount>,

    /// Sell order escrow (contains yield tokens)
    #[account(
        mut,
        seeds = [b"escrow", sell_order.key().as_ref()],
        bump
    )]
    pub sell_order_escrow: Account<'info, TokenAccount>,

    /// Buyer's yield token account (receives yield tokens)
    #[account(mut)]
    pub buyer_yield_token_account: Account<'info, TokenAccount>,

    /// Buyer's underlying token account (for fee collection)
    #[account(mut)]
    pub buyer_underlying_token_account: Account<'info, TokenAccount>,

    /// Seller's underlying token account (receives payment)
    #[account(mut)]
    pub seller_underlying_token_account: Account<'info, TokenAccount>,

    /// Marketplace fee collection account
    #[account(mut)]
    pub fee_collection_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_execute_trade(
    ctx: Context<ExecuteTrade>,
    trade_amount: u64,
) -> Result<()> {
    require!(trade_amount > 0, TradeError::InvalidTradeAmount);

    let buy_order = &mut ctx.accounts.buy_order;
    let sell_order = &mut ctx.accounts.sell_order;
    let marketplace = &mut ctx.accounts.marketplace;

    // Determine actual trade amount (limited by available amounts)
    let max_buy_amount = buy_order.remaining_amount();
    let max_sell_amount = sell_order.remaining_amount();
    let actual_trade_amount = trade_amount.min(max_buy_amount).min(max_sell_amount);

    require!(actual_trade_amount > 0, TradeError::NoTradeableAmount);

    // Use sell order price for execution (better for buyer)
    let execution_price = sell_order.price_per_token;
    let total_payment = (actual_trade_amount as u128 * execution_price as u128 / 1_000_000) as u64;

    // Calculate trading fee
    let fee_amount = (total_payment as u128 * marketplace.trading_fee_bps as u128 / 10000) as u64;
    let net_payment = total_payment - fee_amount;

    // Transfer yield tokens from sell escrow to buyer (using escrow authority)
    let sell_order_key = sell_order.key();
    let sell_escrow_seeds = &[
        b"escrow",
        sell_order_key.as_ref(),
        &[ctx.bumps.sell_order_escrow],
    ];
    let sell_signer_seeds = &[sell_escrow_seeds.as_slice()];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.sell_order_escrow.to_account_info(),
            to: ctx.accounts.buyer_yield_token_account.to_account_info(),
            authority: ctx.accounts.sell_order_escrow.to_account_info(),
        },
        sell_signer_seeds,
    );
    transfer(cpi_ctx, actual_trade_amount)?;

    // Transfer underlying tokens from buy escrow to seller (using escrow authority)
    let buy_order_key = buy_order.key();
    let buy_escrow_seeds = &[
        b"escrow",
        buy_order_key.as_ref(),
        &[ctx.bumps.buy_order_escrow],
    ];
    let buy_signer_seeds = &[buy_escrow_seeds.as_slice()];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buy_order_escrow.to_account_info(),
            to: ctx.accounts.seller_underlying_token_account.to_account_info(),
            authority: ctx.accounts.buy_order_escrow.to_account_info(),
        },
        buy_signer_seeds,
    );
    transfer(cpi_ctx, net_payment)?;

    // Transfer fee to marketplace fee collection account
    if fee_amount > 0 {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buy_order_escrow.to_account_info(),
                to: ctx.accounts.fee_collection_account.to_account_info(),
                authority: ctx.accounts.buy_order_escrow.to_account_info(),
            },
            buy_signer_seeds,
        );
        transfer(cpi_ctx, fee_amount)?;
    }

    // Update order states
    buy_order.filled_amount += actual_trade_amount;
    sell_order.filled_amount += actual_trade_amount;

    // Mark orders as inactive if fully filled
    if buy_order.filled_amount >= buy_order.yield_token_amount {
        buy_order.is_active = false;
    }
    if sell_order.filled_amount >= sell_order.yield_token_amount {
        sell_order.is_active = false;
    }

    // Update marketplace statistics
    marketplace.total_volume += total_payment;
    marketplace.total_trades += 1;

    msg!(
        "Trade executed: {} yield tokens at {} per token (Total: {}, Fee: {})",
        actual_trade_amount,
        execution_price as f64 / 1_000_000.0,
        total_payment,
        fee_amount
    );

    Ok(())
}

#[error_code]
pub enum TradeError {
    #[msg("Invalid buy order")]
    InvalidBuyOrder,
    #[msg("Invalid sell order")]
    InvalidSellOrder,
    #[msg("Order not fillable")]
    OrderNotFillable,
    #[msg("Order marketplace mismatch")]
    OrderMarketplaceMismatch,
    #[msg("Price mismatch - buy price must be >= sell price")]
    PriceMismatch,
    #[msg("Invalid trade amount")]
    InvalidTradeAmount,
    #[msg("No tradeable amount available")]
    NoTradeableAmount,
} 
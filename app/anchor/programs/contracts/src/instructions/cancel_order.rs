use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token, Transfer, transfer};

use crate::state::marketplace::{Marketplace, TradeOrder};

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [b"order", user.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump,
        constraint = order.user == user.key() @ CancelError::UnauthorizedUser,
        constraint = order.is_active @ CancelError::OrderNotActive,
        constraint = order.marketplace == marketplace.key() @ CancelError::OrderMarketplaceMismatch
    )]
    pub order: Account<'info, TradeOrder>,

    /// Escrow account holding tokens
    #[account(
        mut,
        seeds = [b"escrow", order.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, TokenAccount>,

    /// User's token account to receive refund
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_cancel_order(
    ctx: Context<CancelOrder>,
    order_id: u64,
) -> Result<()> {
    let order = &mut ctx.accounts.order;
    let marketplace = &mut ctx.accounts.marketplace;

    // Calculate refund amount (unfilled portion)
    let refund_amount = order.remaining_amount();
    require!(refund_amount > 0, CancelError::NoRefundAvailable);

    // Determine refund amount based on order type
    let actual_refund = if order.order_type == TradeOrder::BUY_ORDER {
        // For buy orders, refund underlying tokens
        let total_locked = order.total_value;
        let filled_value = (order.filled_amount as u128 * order.price_per_token as u128 / 1_000_000) as u64;
        total_locked - filled_value
    } else {
        // For sell orders, refund yield tokens
        refund_amount
    };

    // Transfer tokens back to user
    let order_id_bytes = order_id.to_le_bytes();
    let order_seeds = &[
        b"order",
        order.user.as_ref(),
        order_id_bytes.as_ref(),
        &[ctx.bumps.order],
    ];
    let signer_seeds = &[order_seeds.as_slice()];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: order.to_account_info(),
        },
        signer_seeds,
    );
    transfer(cpi_ctx, actual_refund)?;

    // Deactivate order
    order.is_active = false;

    // Update marketplace best prices if this was the best order
    if order.order_type == TradeOrder::BUY_ORDER && order.price_per_token == marketplace.best_bid_price {
        marketplace.best_bid_price = 0; // Should recalculate from remaining orders
    } else if order.order_type == TradeOrder::SELL_ORDER && order.price_per_token == marketplace.best_ask_price {
        marketplace.best_ask_price = 0; // Should recalculate from remaining orders
    }

    msg!(
        "Order {} cancelled, refunded {} tokens to user",
        order_id,
        actual_refund
    );

    Ok(())
}

#[error_code]
pub enum CancelError {
    #[msg("Unauthorized to cancel this order")]
    UnauthorizedUser,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Order marketplace mismatch")]
    OrderMarketplaceMismatch,
    #[msg("No refund available")]
    NoRefundAvailable,
} 
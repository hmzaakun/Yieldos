#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("5S3gna7dtmoGD1M6AqRLRZvP7MUDHp8K8pkXRMovsrR9");

pub mod instructions;
pub mod state;
pub mod error;

use instructions::*;

#[program]
pub mod contracts {
    use super::*;

    /// Initialize the Yieldos protocol
    pub fn initialize_protocol(ctx: Context<InitializeProtocol>) -> Result<()> {
        instructions::handle_initialize_protocol(ctx)
    }

    /// Create a new yield strategy (admin only)
    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        name: String,
        apy_basis_points: u16,
        strategy_id: u64,
    ) -> Result<()> {
        instructions::handle_create_strategy(ctx, name, apy_basis_points as u64, strategy_id)
    }

    /// Deposit tokens into a specific strategy
    pub fn deposit_to_strategy(
        ctx: Context<DepositToStrategy>,
        amount: u64,
        strategy_id: u64,
    ) -> Result<()> {
        instructions::handle_deposit_to_strategy(ctx, amount, strategy_id)
    }

    /// Claim accumulated yield from a strategy
    pub fn claim_yield(
        ctx: Context<ClaimYield>,
        strategy_id: u64,
    ) -> Result<()> {
        instructions::handle_claim_yield(ctx, strategy_id)
    }

    /// Withdraw principal from a strategy
    pub fn withdraw_from_strategy(
        ctx: Context<WithdrawFromStrategy>,
        amount: u64,
        strategy_id: u64,
    ) -> Result<()> {
        instructions::handle_withdraw_from_strategy(ctx, amount, strategy_id)
    }

    pub fn redeem_yield_tokens(
        ctx: Context<RedeemYieldTokens>,
        yield_token_amount: u64,
        strategy_id: u64,
    ) -> Result<()> {
        instructions::redeem_yield_tokens::handle_redeem_yield_tokens(ctx, yield_token_amount, strategy_id)
    }

    // === MARKETPLACE INSTRUCTIONS ===

    pub fn create_marketplace(
        ctx: Context<CreateMarketplace>,
        strategy_id: u64,
        marketplace_id: u64,
        trading_fee_bps: u16,
    ) -> Result<()> {
        instructions::handle_create_marketplace(ctx, strategy_id, marketplace_id, trading_fee_bps)
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        order_id: u64,
        order_type: u8,
        yield_token_amount: u64,
        price_per_token: u64,
    ) -> Result<()> {
        instructions::handle_place_order(ctx, order_id, order_type, yield_token_amount, price_per_token)
    }

    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        trade_amount: u64,
    ) -> Result<()> {
        instructions::handle_execute_trade(ctx, trade_amount)
    }

    pub fn cancel_order(
        ctx: Context<CancelOrder>,
        order_id: u64,
    ) -> Result<()> {
        instructions::handle_cancel_order(ctx, order_id)
    }
}

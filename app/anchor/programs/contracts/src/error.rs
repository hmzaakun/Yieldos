use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Deposit is not yet mature.")]
    NotMature,
}

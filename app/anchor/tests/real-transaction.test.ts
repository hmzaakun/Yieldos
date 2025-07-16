import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Contracts } from "../target/types/contracts";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { expect } from "chai";

describe("Real Yieldos Transactions", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Contracts as Program<Contracts>;

    let underlyingToken: PublicKey;
    const strategyId = 1;
    const strategyName = "DeFi Test Strategy";
    const apyBasisPoints = 1200; // 12% APY

    it("Should create a real strategy with yield tokens", async () => {
        console.log("🔧 Création d'une stratégie réelle...");

        // 1. Créer un token underlying
        underlyingToken = await createMint(
            provider.connection,
            provider.wallet.payer,
            provider.wallet.publicKey,
            provider.wallet.publicKey,
            6
        );
        console.log("✅ Underlying token créé:", underlyingToken.toString());

        // 2. Calculer les PDAs
        const strategyIdBuffer = Buffer.alloc(8);
        strategyIdBuffer.writeBigUInt64LE(BigInt(strategyId), 0);

        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), strategyIdBuffer],
            program.programId
        );

        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        const [yieldTokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yield_token"), strategyIdBuffer],
            program.programId
        );

        console.log("📍 Strategy PDA:", strategyPda.toString());
        console.log("📍 YT Mint PDA:", yieldTokenMintPda.toString());

        // 3. Créer la stratégie
        const tx = await program.methods
            .createStrategy(strategyName, apyBasisPoints, new anchor.BN(strategyId))
            .accounts({
                admin: provider.wallet.publicKey,
                strategy: strategyPda,
                strategyCounter: strategyCounterPda,
                underlyingToken: underlyingToken,
                yieldTokenMint: yieldTokenMintPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Stratégie créée! TX:", tx);

        // 4. Vérifier que la stratégie a été créée
        const strategy = await program.account.strategy.fetch(strategyPda);
        expect(strategy.name).to.equal(strategyName);
        expect(strategy.apy.toNumber()).to.equal(apyBasisPoints);
        expect(strategy.strategyId.toNumber()).to.equal(strategyId);

        console.log("✅ Stratégie vérifiée:");
        console.log("   Nom:", strategy.name);
        console.log("   APY:", strategy.apy.toNumber() / 100, "%");
        console.log("   ID:", strategy.strategyId.toNumber());

        // 5. Vérifier le compteur
        const counter = await program.account.strategyCounter.fetch(strategyCounterPda);
        expect(counter.count.toNumber()).to.be.greaterThan(0);
        console.log("✅ Compteur mis à jour:", counter.count.toNumber(), "stratégies");
    });

    it("Should create user tokens and deposit", async () => {
        console.log("💰 Création de tokens utilisateur et dépôt...");

        // 1. Créer compte utilisateur pour underlying token
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            underlyingToken,
            provider.wallet.publicKey
        );

        // 2. Mint des tokens à l'utilisateur
        const mintAmount = 1000 * Math.pow(10, 6); // 1000 tokens
        await mintTo(
            provider.connection,
            provider.wallet.payer,
            underlyingToken,
            userTokenAccount.address,
            provider.wallet.publicKey,
            mintAmount
        );

        console.log("✅ 1000 tokens mintés à l'utilisateur");

        // 3. Calculer PDAs pour le dépôt
        const strategyIdBuffer = Buffer.alloc(8);
        strategyIdBuffer.writeBigUInt64LE(BigInt(strategyId), 0);

        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), strategyIdBuffer],
            program.programId
        );

        const [userPositionPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("user_position"),
                provider.wallet.publicKey.toBuffer(),
                strategyPda.toBuffer(),
            ],
            program.programId
        );

        const [yieldTokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yield_token"), strategyIdBuffer],
            program.programId
        );

        // 4. Créer compte YT pour l'utilisateur
        const userYtAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            yieldTokenMintPda,
            provider.wallet.publicKey
        );

        // 5. Effectuer un dépôt
        const depositAmount = 100 * Math.pow(10, 6); // 100 tokens

        const depositTx = await program.methods
            .depositToStrategy(new anchor.BN(depositAmount), new anchor.BN(strategyId))
            .accounts({
                user: provider.wallet.publicKey,
                strategy: strategyPda,
                userPosition: userPositionPda,
                userTokenAccount: userTokenAccount.address,
                userYtAccount: userYtAccount.address,
                underlyingTokenMint: underlyingToken,
                yieldTokenMint: yieldTokenMintPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Dépôt effectué! TX:", depositTx);

        // 6. Vérifier la position utilisateur
        const userPosition = await program.account.userPosition.fetch(userPositionPda);
        expect(userPosition.depositedAmount.toNumber()).to.equal(depositAmount);

        console.log("✅ Position vérifiée:");
        console.log("   Déposé:", userPosition.depositedAmount.toNumber() / Math.pow(10, 6), "tokens");
        console.log("   YT mintés:", userPosition.yieldTokensMinted.toNumber() / Math.pow(10, 6), "YT");

        console.log("\n🎉 SUCCESS! Des données réelles ont été créées sur la blockchain!");
        console.log("💡 Lancez 'npm run analytics' pour voir vos yield tokens!");
    });
}); 
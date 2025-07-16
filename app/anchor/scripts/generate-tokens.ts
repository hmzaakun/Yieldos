import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { createMint, createAccount, mintTo, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Contracts } from "../target/types/contracts";

async function generateTokens() {
    console.log("🎯 === GÉNÉRATION DE YIELD TOKENS ===\n");

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.AnchorProvider.env().wallet;
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);

    const program = anchor.workspace.Contracts as Program<Contracts>;
    console.log("📋 Program ID:", program.programId.toString());
    console.log("🔑 Wallet:", wallet.publicKey.toString());

    if (!wallet.payer) {
        throw new Error("Wallet payer non disponible");
    }

    try {
        // 1. Récupérer la stratégie existante (ID 1)
        const strategyId = 1;
        console.log(`\n🎯 Utilisation de la stratégie existante (ID ${strategyId})...`);

        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const strategy = await program.account.strategy.fetch(strategyPda);
        console.log("✅ Stratégie trouvée:", strategy.name);
        console.log("   APY:", strategy.apy.toString(), "basis points");
        console.log("   Underlying Token:", strategy.underlyingToken.toString());
        console.log("   Yield Token Mint:", strategy.yieldTokenMint.toString());

        // 2. Créer un account token pour l'utilisateur (underlying token)
        console.log("\n💰 Création de votre compte token...");

        const userUnderlyingTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            strategy.underlyingToken,
            wallet.publicKey
        );

        console.log("✅ Compte token créé:", userUnderlyingTokenAccount.address.toString());

        // 3. Minter des tokens vers le compte utilisateur
        const depositAmount = 1000 * Math.pow(10, 6); // 1000 tokens (6 décimales)
        console.log(`\n🪙 Mint de ${depositAmount / Math.pow(10, 6)} tokens vers votre compte...`);

        await mintTo(
            connection,
            wallet.payer,
            strategy.underlyingToken,
            userUnderlyingTokenAccount.address,
            wallet.publicKey,
            depositAmount
        );

        console.log("✅ Tokens mintés avec succès!");

        // 4. Effectuer le dépôt dans la stratégie
        console.log("\n🏦 Dépôt dans la stratégie pour générer des yield tokens...");

        const [userPositionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_position"), wallet.publicKey.toBuffer(), strategyPda.toBuffer()],
            program.programId
        );

        const [strategyVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_vault"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        // Créer le compte yield token pour l'utilisateur
        const userYieldTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            strategy.yieldTokenMint,
            wallet.publicKey
        );

        const depositTx = await program.methods
            .depositToStrategy(
                new anchor.BN(depositAmount),
                new anchor.BN(strategyId)
            )
            .accountsPartial({
                user: wallet.publicKey,
                strategy: strategyPda,
                userPosition: userPositionPda,
                underlyingTokenMint: strategy.underlyingToken,
                userUnderlyingToken: userUnderlyingTokenAccount.address,
                strategyVault: strategyVaultPda,
                yieldTokenMint: strategy.yieldTokenMint,
                userYieldTokenAccount: userYieldTokenAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("🎉 DÉPÔT RÉUSSI!");
        console.log("📊 Transaction:", depositTx.slice(0, 20) + "...");

        // 5. Vérifier les résultats
        console.log("\n📈 Vérification des résultats...");

        const userPosition = await program.account.userPosition.fetch(userPositionPda);
        const updatedStrategy = await program.account.strategy.fetch(strategyPda);

        console.log("✅ Position utilisateur créée:");
        console.log("   Montant déposé:", userPosition.depositedAmount.toString(), "tokens");
        console.log("   Yield tokens reçus:", userPosition.yieldTokensMinted.toString(), "YT");
        console.log("   Date de dépôt:", new Date(userPosition.depositTime.toNumber() * 1000).toISOString());

        console.log("✅ Stratégie mise à jour:");
        console.log("   Total deposits:", updatedStrategy.totalDeposits.toString(), "tokens");
        console.log("   Total yield tokens mintés:", updatedStrategy.totalYieldTokensMinted.toString(), "YT");

        // 6. Vérifier le solde de yield tokens
        const yieldTokenBalance = await connection.getTokenAccountBalance(userYieldTokenAccount.address);
        console.log("✅ Votre solde yield tokens:", yieldTokenBalance.value.uiAmount, "YT");

        console.log("\n🎉 === GÉNÉRATION TERMINÉE ===");
        console.log("💡 Relancez 'npm run analytics' pour voir vos nouvelles statistiques!");

    } catch (error: any) {
        console.error("❌ Erreur:", error);

        // Diagnostiques utiles
        if (error.message?.includes("already in use")) {
            console.log("ℹ️  Position déjà existante - utiliser withdraw puis redéposer");
        } else if (error.message?.includes("insufficient funds")) {
            console.log("ℹ️  Solde SOL insuffisant pour les frais de transaction");
        }
    }
}

generateTokens(); 
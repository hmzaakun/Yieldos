import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Contracts } from "../target/types/contracts";

async function createStrategy() {
    console.log("🎯 === CRÉATION D'UNE NOUVELLE STRATÉGIE ===\n");

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
        // Paramètres de la nouvelle stratégie
        const strategyName = "High Yield USDC";
        const apyBasisPoints = 1500; // 15% APY en basis points
        const strategyId = 2; // ID de la nouvelle stratégie

        console.log(`\n🏗️ Création de la stratégie "${strategyName}"...`);
        console.log("   APY:", apyBasisPoints, "basis points (", apyBasisPoints / 100, "%)");
        console.log("   ID:", strategyId);

        // 1. Créer un nouveau token mint pour cette stratégie (underlying token)
        console.log("\n💰 Création du token mint underlying...");

        const underlyingMint = await createMint(
            connection,
            wallet.payer,
            wallet.publicKey, // mint authority
            wallet.publicKey, // freeze authority
            6 // decimals
        );

        console.log("✅ Underlying token mint créé:", underlyingMint.toString());

        // 2. Calculer les PDAs nécessaires
        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        // Le yield_token_mint est un PDA calculé automatiquement
        const [yieldTokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yield_token"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        console.log("✅ Yield token mint PDA calculé:", yieldTokenMintPda.toString());

        // 3. Créer la stratégie
        console.log("\n🚀 Création de la stratégie on-chain...");

        const tx = await program.methods
            .createStrategy(strategyName, apyBasisPoints, new anchor.BN(strategyId))
            .accountsPartial({
                admin: wallet.publicKey,
                strategy: strategyPda,
                strategyCounter: strategyCounterPda,
                underlyingToken: underlyingMint,
                yieldTokenMint: yieldTokenMintPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Stratégie créée avec succès!");
        console.log("📝 Transaction:", tx);
        console.log("🔗 PDA de la stratégie:", strategyPda.toString());

        // 4. Vérifier la création
        console.log("\n🔍 Vérification de la stratégie créée...");

        const strategyAccount = await program.account.strategy.fetch(strategyPda);
        console.log("✅ Stratégie vérifiée:");
        console.log("   Nom:", strategyAccount.name);
        console.log("   APY:", strategyAccount.apy.toString(), "basis points");
        console.log("   Underlying Token:", strategyAccount.underlyingToken.toString());
        console.log("   Yield Token Mint:", strategyAccount.yieldTokenMint.toString());
        console.log("   Total Deposits:", strategyAccount.totalDeposits.toString());
        console.log("   Admin:", strategyAccount.admin.toString());
        console.log("   Strategy ID:", strategyAccount.strategyId.toString());

        console.log("\n🎉 STRATÉGIE CRÉÉE AVEC SUCCÈS!");
        console.log("💡 Tu peux maintenant la voir dans le frontend à l'adresse /strategies");

    } catch (error) {
        console.error("❌ Erreur lors de la création de la stratégie:", error);
        throw error;
    }
}

// Exécuter le script
createStrategy()
    .then(() => {
        console.log("\n✅ Script terminé avec succès");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Erreur dans le script:", error);
        process.exit(1);
    }); 
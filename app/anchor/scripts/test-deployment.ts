import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { createMint, createAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Contracts } from "../target/types/contracts";

async function testDeployment() {
    console.log("🧪 Test du nouveau déploiement...");

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.AnchorProvider.env().wallet;
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);

    const program = anchor.workspace.Contracts as Program<Contracts>;
    console.log("📋 Program ID:", program.programId.toString());
    console.log("🆔 Expected Program ID: 9dEwdrEo7Tu9eTW3S3opbJa1fyyppRGPpdn8CqBxJX27");
    console.log("🔑 Wallet:", wallet.publicKey.toString());

    try {
        // Test 1: Vérifier que le programme existe
        const programAccount = await connection.getAccountInfo(program.programId);
        if (!programAccount) {
            throw new Error("Programme non trouvé!");
        }
        console.log("✅ Programme trouvé sur devnet");

        // Test 2: PDAs
        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        // Test 3: Initialiser le protocole si nécessaire
        console.log("\n🔄 Test d'initialisation du protocole...");

        const protocolAccount = await connection.getAccountInfo(strategyCounterPda);

        if (!protocolAccount) {
            console.log("Initialisation du protocole...");
            const tx = await program.methods
                .initializeProtocol()
                .accountsPartial({
                    admin: provider.wallet.publicKey,
                    strategyCounter: strategyCounterPda,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            console.log("✅ Protocole initialisé:", tx);
        } else {
            console.log("✅ Protocole déjà initialisé");
        }

        // Test 4: Créer un token mint (USDC mock)
        console.log("\n🪙 Création d'un token mint pour les tests...");

        if (!wallet.payer) {
            throw new Error("Wallet payer non disponible");
        }

        const underlyingTokenMint = await createMint(
            connection,
            wallet.payer,
            wallet.publicKey,
            null,
            6 // 6 décimales comme USDC
        );

        console.log("✅ Token mint créé:", underlyingTokenMint.toString());

        // Test 5: Créer une stratégie (le test critique!)
        console.log("\n🎯 Test critique: Création d'une stratégie...");

        const strategyId = 1;
        const strategyName = "Test Strategy";
        const strategyApy = 1200; // 12.00% en basis points

        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        // Le yield token mint est un PDA, pas un keypair
        const [yieldTokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yield_token"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        console.log("📍 Strategy PDA:", strategyPda.toString());
        console.log("🎫 Yield Token Mint PDA:", yieldTokenMintPda.toString());

        const tx = await program.methods
            .createStrategy(
                strategyName,           // name: string
                strategyApy,           // apy_basis_points: u16
                new anchor.BN(strategyId) // strategy_id: u64
            )
            .accountsPartial({
                admin: provider.wallet.publicKey,
                strategy: strategyPda,
                strategyCounter: strategyCounterPda,
                underlyingToken: underlyingTokenMint,
                yieldTokenMint: yieldTokenMintPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("🎉 SUCCÈS! Stratégie créée:", tx);
        console.log("📊 Transaction signature:", tx.slice(0, 20) + "...");

        // Récupérer les données de la stratégie
        console.log("\n📈 Vérification des données de la stratégie...");
        const strategyData = await program.account.strategy.fetch(strategyPda);
        console.log("✅ Données de la stratégie récupérées:");
        console.log("  - Nom:", strategyData.name);
        console.log("  - APY:", strategyData.apy.toString(), "basis points");
        console.log("  - Strategy ID:", strategyData.strategyId.toString());
        console.log("  - Total Deposits:", strategyData.totalDeposits.toString());
        console.log("  - Admin:", strategyData.admin.toString());
        console.log("  - Underlying Token:", strategyData.underlyingToken.toString());
        console.log("  - Yield Token Mint:", strategyData.yieldTokenMint.toString());
        console.log("  - Is Active:", strategyData.isActive);
        console.log("  - Created At:", new Date(strategyData.createdAt.toNumber() * 1000).toISOString());

        console.log("\n🎉 TOUS LES TESTS SONT PASSÉS!");
        console.log("✅ Programme déployé et fonctionnel");
        console.log("✅ Protocole initialisé");
        console.log("✅ Stratégie créée avec succès");
        console.log("❌ Plus de problème InstructionDidNotDeserialize!");

    } catch (error: any) {
        console.error("❌ Erreur lors du test:", error);
        if (error.message?.includes("InstructionDidNotDeserialize")) {
            console.error("💥 Le problème de désérialisation persiste!");
        } else {
            console.error("🔍 Nouvelle erreur détectée:", error.message);
        }
    }
}

testDeployment(); 
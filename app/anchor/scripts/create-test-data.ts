import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Contracts } from "../target/types/contracts";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    PublicKey,
} from "@solana/web3.js";

async function createTestData() {
    console.log("🔧 === CRÉATION DE DONNÉES DE TEST ===\n");

    // Configuration
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Contracts as Program<Contracts>;

    console.log("📍 Program ID:", program.programId.toString());
    console.log("💰 Wallet:", provider.wallet.publicKey.toString());

    const admin = provider.wallet.publicKey;
    const decimals = 6;

    try {
        // 1. Vérifier si on a assez de SOL
        const balance = await provider.connection.getBalance(admin);
        console.log("💰 Solde SOL:", balance / 1e9, "SOL");

        if (balance < 0.1 * 1e9) {
            console.log("⚠️  Solde SOL faible, certaines opérations peuvent échouer");
        }

        // 2. Créer un token simple (sans mint authority complexe)
        console.log("\n🪙 === CRÉATION DU TOKEN DE TEST ===");

        if (!provider.wallet.payer) {
            throw new Error("Pas de payer disponible dans le wallet");
        }

        const tokenMint = await createMint(
            provider.connection,
            provider.wallet.payer,
            admin,
            admin,
            decimals
        );
        console.log("✅ Token créé:", tokenMint.toString());

        // 3. Créer le compte utilisateur et mint des tokens
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            admin
        );

        const mintAmount = 1000 * Math.pow(10, decimals);
        await mintTo(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            userTokenAccount.address,
            admin,
            mintAmount
        );
        console.log("✅ Tokens mintés:", mintAmount / Math.pow(10, decimals));

        // 4. Initialiser le protocole si nécessaire
        console.log("\n🔧 === INITIALISATION DU PROTOCOLE ===");

        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        try {
            const counter = await program.account.strategyCounter.fetch(strategyCounterPda);
            console.log("✅ Protocole déjà initialisé. Stratégies:", counter.count.toNumber());
        } catch (error) {
            console.log("🔧 Initialisation du protocole...");

            try {
                const tx = await program.methods.initializeProtocol()
                    .accounts({
                        admin: admin,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();

                console.log("✅ Protocole initialisé! TX:", tx.slice(0, 8) + "...");

                // Attendre un peu
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (initError) {
                console.log("ℹ️  Protocole déjà initialisé ou erreur:", (initError as any).message?.slice(0, 100));
            }
        }

        // 5. Initialiser le marketplace si nécessaire
        console.log("\n🛒 === INITIALISATION DU MARKETPLACE ===");

        const [marketplaceCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("marketplace_counter")],
            program.programId
        );

        try {
            const counter = await program.account.marketplaceCounter.fetch(marketplaceCounterPda);
            console.log("✅ Marketplace déjà initialisé. Ordres:", counter.count.toNumber());
        } catch (error) {
            console.log("🔧 Initialisation du marketplace...");

            try {
                const tx = await program.methods.createMarketplace()
                    .accounts({
                        admin: admin,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();

                console.log("✅ Marketplace initialisé! TX:", tx.slice(0, 8) + "...");
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (initError) {
                console.log("ℹ️  Marketplace déjà initialisé ou erreur:", (initError as any).message?.slice(0, 100));
            }
        }

        console.log("\n✅ === DONNÉES DE BASE CRÉÉES ===");
        console.log("🎯 Token de test disponible:", tokenMint.toString());
        console.log("💼 Solde utilisateur:", mintAmount / Math.pow(10, decimals), "tokens");
        console.log("🔧 Protocole initialisé");
        console.log("🛒 Marketplace initialisé");
        console.log("\n💡 Maintenant vous pouvez:");
        console.log("   - Utiliser 'npm run demo:interact' pour interactions avancées");
        console.log("   - Utiliser 'npm run analytics' pour voir l'état");

        // 6. Créer une stratégie simple (optionnel)
        console.log("\n📈 === TENTATIVE DE CRÉATION D'UNE STRATÉGIE ===");

        const strategyId = Math.floor(Math.random() * 1000000);
        console.log("🎲 Strategy ID généré:", strategyId);

        // Juste afficher ce qui serait nécessaire
        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), Buffer.from(strategyId.toString())],
            program.programId
        );

        console.log("📍 Strategy PDA calculée:", strategyPda.toString());
        console.log("ℹ️  Pour créer une stratégie complète, utilisez 'npm run demo:interact'");

    } catch (error) {
        console.error("❌ Erreur:", (error as any).message);
        console.log("\n💡 Essayez 'npm run analytics' pour voir l'état actuel");
    }
}

// Exécuter
createTestData().catch(console.error); 
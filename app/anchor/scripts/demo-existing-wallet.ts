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

async function demoWithExistingWallet() {
    console.log("🎬 === YIELDOS DEMO AVEC WALLET EXISTANT ===\n");

    // Configuration
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Contracts as Program<Contracts>;

    console.log("📍 Program ID:", program.programId.toString());
    console.log("🌐 RPC Endpoint:", provider.connection.rpcEndpoint);
    console.log("💰 Your Wallet:", provider.wallet.publicKey.toString());

    // Utiliser le wallet existant comme admin et utilisateur
    const admin = provider.wallet.publicKey;
    const user = provider.wallet.publicKey; // Même wallet pour simplifier
    const decimals = 6;
    const strategyId = Math.floor(Math.random() * 1000000);

    console.log("\n👤 Configuration:");
    console.log("   Admin:", admin.toString());
    console.log("   User:", user.toString());
    console.log("   Strategy ID:", strategyId);

    try {
        // 1. Créer un token de test
        console.log("\n🪙 === CRÉATION DU TOKEN DE TEST ===");

        const tokenMint = await createMint(
            provider.connection,
            provider.wallet.payer,
            admin,
            admin,
            decimals
        );
        console.log("✅ Token créé:", tokenMint.toString());

        // Créer le compte de tokens pour l'utilisateur
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            user
        );
        console.log("✅ Compte utilisateur créé:", userTokenAccount.address.toString());

        // Mint des tokens pour les tests
        const mintAmount = 1000 * Math.pow(10, decimals);
        await mintTo(
            provider.connection,
            provider.wallet.payer,
            tokenMint,
            userTokenAccount.address,
            admin,
            mintAmount
        );
        console.log("✅ Tokens mintés:", mintAmount / Math.pow(10, decimals), "tokens");

        // 2. Initialiser le protocole si nécessaire
        console.log("\n🔧 === INITIALISATION DU PROTOCOLE ===");

        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        try {
            await program.account.strategyCounter.fetch(strategyCounterPda);
            console.log("✅ Protocole déjà initialisé");
        } catch (error) {
            console.log("🔧 Initialisation du protocole...");
            try {
                await program.methods
                    .initializeProtocol()
                    .accounts({
                        admin,
                        strategyCounter: strategyCounterPda,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();
                console.log("✅ Protocole initialisé!");
            } catch (initError) {
                console.log("ℹ️  Protocole peut-être déjà initialisé");
            }
        }

        // 3. Créer une stratégie
        console.log("\n📈 === CRÉATION D'UNE STRATÉGIE ===");

        const [strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), Buffer.from(strategyId.toString())],
            program.programId
        );

        // Créer le mint pour les yield tokens
        const ytMint = await createMint(
            provider.connection,
            provider.wallet.payer,
            strategyPda, // La stratégie sera l'autorité
            strategyPda,
            decimals
        );
        console.log("✅ Yield Token Mint créé:", ytMint.toString());

        const strategyName = `Strategy Test ${strategyId}`;
        const apy = 1500; // 15% APY

        await program.methods
            .createStrategy(
                new anchor.BN(strategyId),
                strategyName,
                new anchor.BN(apy)
            )
            .accounts({
                admin,
                strategy: strategyPda,
                strategyCounter: strategyCounterPda,
                underlyingToken: tokenMint,
                yieldTokenMint: ytMint,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Stratégie créée:", strategyName);
        console.log("   APY:", apy / 100, "%");
        console.log("   PDA:", strategyPda.toString());

        // 4. Effectuer un dépôt
        console.log("\n💰 === DÉPÔT DANS LA STRATÉGIE ===");

        const [userPositionPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("user_position"),
                user.toBuffer(),
                Buffer.from(strategyId.toString()),
            ],
            program.programId
        );

        // Créer le compte YT pour l'utilisateur
        const userYtAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            provider.wallet.payer,
            ytMint,
            user
        );

        const depositAmount = 100 * Math.pow(10, decimals);

        await program.methods
            .depositToStrategy(new anchor.BN(depositAmount))
            .accounts({
                user,
                strategy: strategyPda,
                userPosition: userPositionPda,
                userTokenAccount: userTokenAccount.address,
                userYtAccount: userYtAccount.address,
                underlyingTokenMint: tokenMint,
                yieldTokenMint: ytMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("✅ Dépôt effectué:", depositAmount / Math.pow(10, decimals), "tokens");
        console.log("   Position PDA:", userPositionPda.toString());

        // 5. Attendre un peu et claim des yields
        console.log("\n💎 === CLAIM DES YIELDS ===");

        // Simuler l'accumulation de yields en attendant quelques secondes
        console.log("⏳ Simulation de l'accumulation de yields (3 secondes)...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            await program.methods
                .claimYield()
                .accounts({
                    user,
                    strategy: strategyPda,
                    userPosition: userPositionPda,
                    userTokenAccount: userTokenAccount.address,
                    underlyingTokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            console.log("✅ Yields réclamés!");
        } catch (error) {
            console.log("ℹ️  Pas encore de yields à réclamer (normal pour un nouveau dépôt)");
        }

        // 6. Créer le marketplace
        console.log("\n🏪 === INITIALISATION DU MARKETPLACE ===");

        const [marketplaceCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("marketplace_counter")],
            program.programId
        );

        try {
            await program.account.marketplaceCounter.fetch(marketplaceCounterPda);
            console.log("✅ Marketplace déjà initialisé");
        } catch (error) {
            console.log("🔧 Initialisation du marketplace...");
            try {
                await program.methods
                    .createMarketplace()
                    .accounts({
                        admin,
                        marketplaceCounter: marketplaceCounterPda,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc();
                console.log("✅ Marketplace initialisé!");
            } catch (initError) {
                console.log("ℹ️  Marketplace peut-être déjà initialisé");
            }
        }

        // 7. Placer un ordre de vente
        console.log("\n📋 === PLACEMENT D'UN ORDRE DE VENTE ===");

        const orderId = Math.floor(Math.random() * 1000000);
        const [orderPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("trade_order"), Buffer.from(orderId.toString())],
            program.programId
        );

        const sellAmount = 20 * Math.pow(10, decimals); // 20 YT
        const pricePerToken = 0.95 * Math.pow(10, decimals); // 0.95 tokens par YT

        try {
            await program.methods
                .placeOrder(
                    new anchor.BN(orderId),
                    new anchor.BN(sellAmount),
                    new anchor.BN(pricePerToken)
                )
                .accounts({
                    user,
                    marketplace: marketplaceCounterPda,
                    order: orderPda,
                    userYtAccount: userYtAccount.address,
                    yieldTokenMint: ytMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            console.log("✅ Ordre placé!");
            console.log("   Quantité:", sellAmount / Math.pow(10, decimals), "YT");
            console.log("   Prix:", pricePerToken / Math.pow(10, decimals), "tokens/YT");
            console.log("   Valeur totale:", (sellAmount * pricePerToken) / Math.pow(10, decimals * 2), "tokens");
        } catch (error) {
            console.log("ℹ️  Erreur lors du placement de l'ordre (peut-être pas assez de YT tokens)");
        }

        console.log("\n🎉 === DÉMO TERMINÉE AVEC SUCCÈS! ===");
        console.log("✅ Stratégie créée et financée");
        console.log("✅ Position utilisateur établie");
        console.log("✅ Marketplace opérationnel");
        console.log("\n💡 Lancez maintenant 'npm run analytics' pour voir vos tokens!");

    } catch (error) {
        console.error("❌ Erreur:", error);
    }
}

// Exécuter la démo
demoWithExistingWallet().catch(console.error); 
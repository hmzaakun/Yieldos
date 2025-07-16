import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Contracts } from "../target/types/contracts";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAccount,
} from "@solana/spl-token";
import {
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    PublicKey,
    Connection,
} from "@solana/web3.js";

interface StrategyInfo {
    id: number;
    name: string;
    apy: number;
    totalDeposited: number;
    totalYieldTokens: number;
    admin: string;
    mint: string;
    ytMint: string;
}

interface UserPosition {
    strategyId: number;
    deposited: number;
    yieldTokens: number;
    lastYieldClaim: number;
    accumulatedYield: number;
}

interface MarketplaceOrder {
    id: number;
    seller: string;
    ytAmount: number;
    pricePerToken: number;
    totalValue: number;
    strategyId: number;
    isActive: boolean;
}

async function analyzeYieldos() {
    console.log("📊 === YIELDOS ANALYTICS DASHBOARD ===\n");

    // Configuration
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Contracts as Program<Contracts>;
    const connection = provider.connection;

    console.log("🔧 Configuration:");
    console.log("   Program ID:", program.programId.toString());
    console.log("   RPC Endpoint:", provider.connection.rpcEndpoint);
    console.log("   Your Wallet:", provider.wallet.publicKey.toString());
    console.log("   ──────────────────────────────────────────────────────\n");

    const wallet = provider.wallet.publicKey;
    const strategies: StrategyInfo[] = [];
    const userPositions: UserPosition[] = [];
    const marketplaceOrders: MarketplaceOrder[] = [];

    // 1. Analyser les stratégies
    console.log("🎯 === ANALYSE DES STRATÉGIES DISPONIBLES ===");

    try {
        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        let totalStrategies = 0;
        try {
            const counter = await program.account.strategyCounter.fetch(strategyCounterPda);
            totalStrategies = counter.count.toNumber();
            console.log(`✅ Nombre total de stratégies: ${totalStrategies}`);
        } catch (error) {
            console.log("ℹ️  Aucune stratégie trouvée");
        }

        // Analyser chaque stratégie
        for (let i = 1; i <= totalStrategies; i++) {
            try {
                const [strategyPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("strategy"), new anchor.BN(i).toArrayLike(Buffer, "le", 8)],
                    program.programId
                );

                const strategy = await program.account.strategy.fetch(strategyPda);

                const strategyInfo: StrategyInfo = {
                    id: strategy.strategyId.toNumber(),
                    name: strategy.name,
                    apy: strategy.apy.toNumber(),
                    totalDeposited: strategy.totalDeposits.toNumber() / 1e6,
                    totalYieldTokens: strategy.totalYieldTokensMinted.toNumber() / 1e6,
                    admin: strategy.admin.toString(),
                    mint: strategy.underlyingToken.toString(),
                    ytMint: strategy.yieldTokenMint.toString(),
                };

                strategies.push(strategyInfo);

                console.log(`\n📈 Stratégie #${strategyInfo.id}: "${strategyInfo.name}"`);
                console.log(`   APY: ${strategyInfo.apy}%`);
                console.log(`   Total déposé: ${strategyInfo.totalDeposited.toFixed(2)} tokens`);
                console.log(`   Yield Tokens émis: ${strategyInfo.totalYieldTokens.toFixed(2)} YT`);
                console.log(`   Admin: ${strategyInfo.admin.slice(0, 8)}...`);
                console.log(`   Token Mint: ${strategyInfo.mint.slice(0, 8)}...`);
                console.log(`   YT Mint: ${strategyInfo.ytMint.slice(0, 8)}...`);

            } catch (error) {
                // Stratégie n'existe pas, continuer
            }
        }

    } catch (error) {
        console.log("❌ Erreur lors de l'analyse des stratégies:", (error as any).message);
    }

    // 2. Analyser les positions de l'utilisateur
    console.log("\n\n💼 === VOS POSITIONS ET YIELD TOKENS ===");

    let totalValueLocked = 0;
    let totalYieldTokensOwned = 0;
    let totalPotentialYield = 0;

    for (const strategy of strategies) {
        try {
            // Recalculer le strategy PDA correct
            const [actualStrategyPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("strategy"), new anchor.BN(strategy.id).toArrayLike(Buffer, "le", 8)],
                program.programId
            );

            const [userPositionPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("user_position"),
                    wallet.toBuffer(),
                    actualStrategyPda.toBuffer(),
                ],
                program.programId
            );

            const position = await program.account.userPosition.fetch(userPositionPda);

            const userPosition: UserPosition = {
                strategyId: strategy.id,
                deposited: position.depositedAmount.toNumber() / 1e6,
                yieldTokens: position.yieldTokensMinted.toNumber() / 1e6,
                lastYieldClaim: position.lastYieldClaim.toNumber(),
                accumulatedYield: position.totalYieldClaimed.toNumber() / 1e6,
            };

            userPositions.push(userPosition);

            // Calculer les métriques
            totalValueLocked += userPosition.deposited;
            totalYieldTokensOwned += userPosition.yieldTokens;

            // Estimer le rendement potentiel annuel
            const annualYield = (userPosition.deposited * strategy.apy) / 100;
            totalPotentialYield += annualYield;

            console.log(`\n🔹 Position dans "${strategy.name}" (ID: ${strategy.id}):`);
            console.log(`   💰 Montant déposé: ${userPosition.deposited.toFixed(2)} tokens`);
            console.log(`   🎫 Yield Tokens possédés: ${userPosition.yieldTokens.toFixed(2)} YT`);
            console.log(`   💎 Rendement accumulé: ${userPosition.accumulatedYield.toFixed(2)} tokens`);
            console.log(`   📅 Dernier claim: ${new Date(userPosition.lastYieldClaim * 1000).toLocaleDateString()}`);
            console.log(`   📊 Rendement annuel estimé: ${annualYield.toFixed(2)} tokens (${strategy.apy}% APY)`);

            // Vérifier le solde des YT tokens dans le wallet
            try {
                // Calculer l'adresse du compte token associé
                const { getAssociatedTokenAddress } = await import("@solana/spl-token");
                const associatedTokenAddress = await getAssociatedTokenAddress(
                    new PublicKey(strategy.ytMint),
                    wallet
                );

                const accountInfo = await getAccount(connection, associatedTokenAddress);
                const walletYtBalance = Number(accountInfo.amount) / 1e6;

                console.log(`   💳 YT dans votre wallet: ${walletYtBalance.toFixed(2)} YT`);
            } catch (error) {
                console.log(`   💳 YT dans votre wallet: 0.00 YT (compte non créé)`);
            }

        } catch (error) {
            // Pas de position dans cette stratégie
            console.log(`\n🔹 Aucune position dans "${strategy.name}" (ID: ${strategy.id})`);
        }
    }

    // 3. Analyser le marketplace
    console.log("\n\n🛒 === ANALYSE DU MARKETPLACE ===");

    try {
        const [marketplaceCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("marketplace_counter")],
            program.programId
        );

        let totalOrders = 0;
        try {
            const counter = await program.account.marketplaceCounter.fetch(marketplaceCounterPda);
            totalOrders = counter.count.toNumber();
            console.log(`📦 Nombre total d'ordres: ${totalOrders}`);
        } catch (error) {
            console.log("ℹ️  Marketplace pas encore initialisé");
        }

        let activeOrders = 0;
        let totalVolumeForSale = 0;

        for (let i = 0; i < totalOrders; i++) {
            try {
                const [orderPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("trade_order"), Buffer.from(i.toString())],
                    program.programId
                );

                const order = await program.account.tradeOrder.fetch(orderPda);

                const marketOrder: MarketplaceOrder = {
                    id: order.orderId.toNumber(),
                    seller: order.user.toString(),
                    ytAmount: order.yieldTokenAmount.toNumber() / 1e6,
                    pricePerToken: order.pricePerToken.toNumber() / 1e6,
                    totalValue: (order.yieldTokenAmount.toNumber() * order.pricePerToken.toNumber()) / 1e12,
                    strategyId: 0, // Pas disponible dans ce struct
                    isActive: order.isActive,
                };

                if (marketOrder.isActive) {
                    activeOrders++;
                    totalVolumeForSale += marketOrder.totalValue;

                    const relatedStrategy = strategies.find(s => s.id === marketOrder.strategyId);

                    console.log(`\n📋 Ordre #${marketOrder.id} ${marketOrder.seller === wallet.toString() ? '(VOS)' : ''}:`);
                    console.log(`   👤 Vendeur: ${marketOrder.seller.slice(0, 8)}...`);
                    console.log(`   🎫 Quantité YT: ${marketOrder.ytAmount.toFixed(2)} YT`);
                    console.log(`   💰 Prix unitaire: ${marketOrder.pricePerToken.toFixed(2)} tokens/YT`);
                    console.log(`   💎 Valeur totale: ${marketOrder.totalValue.toFixed(2)} tokens`);
                    console.log(`   📈 Stratégie: ${relatedStrategy ? relatedStrategy.name : `ID ${marketOrder.strategyId}`}`);
                }

                marketplaceOrders.push(marketOrder);

            } catch (error) {
                // Ordre n'existe pas
            }
        }

        console.log(`\n📊 Résumé Marketplace:`);
        console.log(`   🟢 Ordres actifs: ${activeOrders}`);
        console.log(`   💰 Volume total en vente: ${totalVolumeForSale.toFixed(2)} tokens`);

    } catch (error) {
        console.log("❌ Erreur lors de l'analyse du marketplace:", (error as any).message);
    }

    // 4. Résumé global
    console.log("\n\n📈 === RÉSUMÉ DE VOTRE PORTEFEUILLE ===");
    console.log(`💰 Total Value Locked: ${totalValueLocked.toFixed(2)} tokens`);
    console.log(`🎫 Total Yield Tokens: ${totalYieldTokensOwned.toFixed(2)} YT`);
    console.log(`📊 Rendement annuel potentiel: ${totalPotentialYield.toFixed(2)} tokens`);
    console.log(`💼 Nombre de positions: ${userPositions.length}`);
    console.log(`🛒 Vos ordres actifs: ${marketplaceOrders.filter(o => o.seller === wallet.toString() && o.isActive).length}`);

    // 5. Recommandations
    console.log("\n\n💡 === RECOMMANDATIONS ===");

    if (userPositions.length === 0) {
        console.log("🚀 Commencez par déposer dans une stratégie pour générer des yield tokens!");
    } else {
        const oldestPosition = userPositions.reduce((oldest, current) =>
            current.lastYieldClaim < oldest.lastYieldClaim ? current : oldest
        );

        if (oldestPosition.accumulatedYield > 0.001) {
            console.log(`💎 Vous avez ${oldestPosition.accumulatedYield.toFixed(2)} tokens de rendement à claim!`);
        }

        if (totalYieldTokensOwned > 0) {
            console.log(`🎫 Vous pourriez vendre ${totalYieldTokensOwned.toFixed(2)} YT sur le marketplace`);
        }
    }

    console.log("\n✨ === ANALYSE TERMINÉE ===");
}

// Fonction pour créer des données de test
async function createTestTransaction() {
    console.log("\n🔧 === CRÉATION RAPIDE DE DONNÉES DE TEST ===");

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Contracts as Program<Contracts>;

    try {
        // Essayer d'initialiser le protocole
        const [strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            program.programId
        );

        try {
            const counter = await program.account.strategyCounter.fetch(strategyCounterPda);
            console.log("✅ Protocole déjà initialisé avec", counter.count.toNumber(), "stratégies");
        } catch (error) {
            console.log("🚀 Tentative d'initialisation du protocole...");

            try {
                const tx = await program.methods.initializeProtocol()
                    .accounts({
                        admin: provider.wallet.publicKey,
                    })
                    .rpc();
                console.log("✅ Protocole initialisé! TX:", tx.slice(0, 16));
            } catch (initError) {
                console.log("⚠️  Erreur d'initialisation:", (initError as any).message?.slice(0, 100));
            }
        }

        console.log("ℹ️  Pour le marketplace, utilisez les commandes séparées");

    } catch (error) {
        console.log("❌ Erreur générale:", (error as any).message?.slice(0, 100));
    }
}

// Exécuter l'analyse puis tenter de créer des données
async function main() {
    await analyzeYieldos();
    await createTestTransaction();

    console.log("\n💡 Relancez 'npm run analytics' pour voir les changements!");
}

main().catch(console.error); 
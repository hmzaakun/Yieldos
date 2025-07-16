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
    Connection,
    clusterApiUrl,
} from "@solana/web3.js";

// Configuration
const NETWORK = "devnet"; // ou "localnet" pour tests locaux
const PROGRAM_ID = "5S3gna7dtmoGD1M6AqRLRZvP7MUDHp8K8pkXRMovsrR9";

class YieldosInteraction {
    private connection: Connection;
    private program: Program<Contracts>;
    private provider: anchor.AnchorProvider;
    private admin: Keypair;
    private user1: Keypair;
    private user2: Keypair;

    // États du protocole
    private underlyingMint: PublicKey | null = null;
    private strategyCounterPda: PublicKey | null = null;
    private strategyPda: PublicKey | null = null;
    private strategyVaultPda: PublicKey | null = null;
    private yieldTokenMintPda: PublicKey | null = null;
    private userPositionPda: PublicKey | null = null;
    private marketplacePda: PublicKey | null = null;
    private marketplaceCounterPda: PublicKey | null = null;

    // Paramètres
    private readonly strategyId = 0;
    private readonly strategyName = "Yieldos Demo Strategy";
    private readonly strategyApy = 1500; // 15% APY
    private readonly decimals = 6;
    private readonly depositAmount = 1000 * 10 ** this.decimals; // 1000 tokens

    constructor() {
        console.log("🚀 Initialisation de l'interaction avec Yieldos...");

        // Connexion selon l'environnement
        if (NETWORK === "devnet") {
            this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        } else {
            this.connection = new Connection("http://localhost:8899", "confirmed");
        }

        // Configuration du provider
        const wallet = new anchor.Wallet(Keypair.generate()); // Temporaire
        this.provider = new anchor.AnchorProvider(this.connection, wallet, {
            commitment: "confirmed",
        });
        anchor.setProvider(this.provider);

        // Chargement du programme
        const idl = require("../target/idl/contracts.json");
        const programId = new PublicKey(PROGRAM_ID);
        this.program = new Program(idl, this.provider, programId as any);

        // Génération des comptes de test
        this.admin = Keypair.generate();
        this.user1 = Keypair.generate();
        this.user2 = Keypair.generate();

        console.log("📍 Program ID:", this.program.programId.toString());
        console.log("👤 Admin:", this.admin.publicKey.toString());
        console.log("👤 User1:", this.user1.publicKey.toString());
        console.log("👤 User2:", this.user2.publicKey.toString());
    }

    async setupAccounts() {
        console.log("\n💰 === CONFIGURATION DES COMPTES ===");

        // Airdrop SOL aux comptes de test
        try {
            console.log("🔄 Airdrop SOL aux comptes...");

            const airdropPromises = [
                this.connection.requestAirdrop(this.admin.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
                this.connection.requestAirdrop(this.user1.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
                this.connection.requestAirdrop(this.user2.publicKey, 3 * anchor.web3.LAMPORTS_PER_SOL),
            ];

            await Promise.all(airdropPromises.map(p => p.then(sig => this.connection.confirmTransaction(sig))));

            console.log("✅ Airdrop terminé");
        } catch (error) {
            console.log("⚠️  Limite d'airdrop atteinte, utilisation des fonds existants");
        }

        // Création du token de test
        console.log("🔄 Création du token sous-jacent...");
        this.underlyingMint = await createMint(
            this.connection,
            this.admin,
            this.admin.publicKey,
            null,
            this.decimals
        );
        console.log("✅ Token sous-jacent créé:", this.underlyingMint.toString());

        // Calcul des PDAs
        this.derivePDAs();
    }

    private derivePDAs() {
        console.log("\n🔑 === DÉRIVATION DES PDAs ===");

        [this.strategyCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_counter")],
            this.program.programId
        );
        console.log("📊 Strategy Counter PDA:", this.strategyCounterPda.toString());

        [this.strategyPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy"), new anchor.BN(this.strategyId).toArrayLike(Buffer, "le", 8)],
            this.program.programId
        );
        console.log("📈 Strategy PDA:", this.strategyPda.toString());

        [this.strategyVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("strategy_vault"), new anchor.BN(this.strategyId).toArrayLike(Buffer, "le", 8)],
            this.program.programId
        );
        console.log("🏦 Strategy Vault PDA:", this.strategyVaultPda.toString());

        [this.yieldTokenMintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("yield_token"), new anchor.BN(this.strategyId).toArrayLike(Buffer, "le", 8)],
            this.program.programId
        );
        console.log("🪙 Yield Token Mint PDA:", this.yieldTokenMintPda.toString());

        [this.userPositionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_position"), this.user1.publicKey.toBuffer(), this.strategyPda.toBuffer()],
            this.program.programId
        );
        console.log("👤 User Position PDA:", this.userPositionPda.toString());

        [this.marketplacePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("marketplace"), this.strategyPda.toBuffer()],
            this.program.programId
        );
        console.log("🏪 Marketplace PDA:", this.marketplacePda.toString());

        [this.marketplaceCounterPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("marketplace_counter")],
            this.program.programId
        );
        console.log("📊 Marketplace Counter PDA:", this.marketplaceCounterPda.toString());
    }

    async initializeProtocol() {
        console.log("\n🔄 === INITIALISATION DU PROTOCOLE YIELDOS ===");

        try {
            const tx = await this.program.methods
                .initializeProtocol()
                .accounts({
                    admin: this.admin.publicKey,
                    strategyCounter: this.strategyCounterPda,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                } as any)
                .signers([this.admin])
                .rpc();

            console.log("✅ Protocole Yieldos initialisé!");
            console.log("📝 Transaction:", tx);

            // Vérification
            const counter = await this.program.account.strategyCounter.fetch(this.strategyCounterPda!);
            console.log("📊 Compteur de stratégies:", counter.count.toNumber());

        } catch (error: any) {
            if (error.message.includes("already in use")) {
                console.log("ℹ️  Protocole déjà initialisé");
            } else {
                console.error("❌ Erreur d'initialisation:", error.message);
                throw error;
            }
        }
    }

    async createStrategy() {
        console.log("\n🔄 === CRÉATION DE STRATÉGIE YIELDOS ===");

        try {
            const tx = await this.program.methods
                .createStrategy(this.strategyName, this.strategyApy, new anchor.BN(this.strategyId))
                .accounts({
                    admin: this.admin.publicKey,
                    strategy: this.strategyPda,
                    strategyCounter: this.strategyCounterPda,
                    underlyingToken: this.underlyingMint,
                    yieldTokenMint: this.yieldTokenMintPda,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                } as any)
                .signers([this.admin])
                .rpc();

            console.log("✅ Stratégie Yieldos créée!");
            console.log("📝 Transaction:", tx);

            // Vérification
            const strategy = await this.program.account.strategy.fetch(this.strategyPda!);
            console.log("📊 Détails de la stratégie:");
            console.log("   🏷️  Nom:", strategy.name);
            console.log("   📈 APY:", strategy.apy.toNumber() / 100, "%");
            console.log("   ✅ Active:", strategy.isActive);
            console.log("   💰 Dépôts totaux:", strategy.totalDeposits.toNumber() / 10 ** this.decimals);

        } catch (error: any) {
            if (error.message.includes("already in use")) {
                console.log("ℹ️  Stratégie déjà créée");
            } else {
                console.error("❌ Erreur de création:", error.message);
                throw error;
            }
        }
    }

    async setupUserTokens() {
        console.log("\n🔄 === CONFIGURATION DES TOKENS UTILISATEUR ===");

        // Création du compte de tokens pour user1
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.user1,
            this.underlyingMint!,
            this.user1.publicKey
        );

        // Mint de tokens pour les tests
        await mintTo(
            this.connection,
            this.admin,
            this.underlyingMint!,
            userTokenAccount.address,
            this.admin,
            this.depositAmount * 3 // 3000 tokens
        );

        console.log("✅ User1 a reçu", (this.depositAmount * 3) / 10 ** this.decimals, "tokens");
        console.log("💰 Compte de tokens:", userTokenAccount.address.toString());

        return userTokenAccount;
    }

    async depositToStrategy(userTokenAccount: any) {
        console.log("\n🔄 === DÉPÔT DANS LA STRATÉGIE YIELDOS ===");

        try {
            // Création du compte de yield tokens
            const userYieldTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.user1,
                this.yieldTokenMintPda!,
                this.user1.publicKey
            );

            const tx = await this.program.methods
                .depositToStrategy(new anchor.BN(this.depositAmount), new anchor.BN(this.strategyId))
                .accounts({
                    user: this.user1.publicKey,
                    strategy: this.strategyPda,
                    userPosition: this.userPositionPda,
                    underlyingTokenMint: this.underlyingMint,
                    userUnderlyingToken: userTokenAccount.address,
                    strategyVault: this.strategyVaultPda,
                    yieldTokenMint: this.yieldTokenMintPda,
                    userYieldTokenAccount: userYieldTokenAccount.address,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                } as any)
                .signers([this.user1])
                .rpc();

            console.log("✅ Dépôt effectué avec succès!");
            console.log("📝 Transaction:", tx);
            console.log("💰 Montant déposé:", this.depositAmount / 10 ** this.decimals, "tokens");

            // Vérification
            const userPosition = await this.program.account.userPosition.fetch(this.userPositionPda!);
            const strategy = await this.program.account.strategy.fetch(this.strategyPda!);

            console.log("📊 Position utilisateur:");
            console.log("   💰 Montant déposé:", userPosition.depositedAmount.toNumber() / 10 ** this.decimals);
            console.log("   🪙 Yield tokens mintés:", userPosition.yieldTokensMinted.toNumber() / 10 ** this.decimals);

            console.log("📊 Stratégie mise à jour:");
            console.log("   💰 Dépôts totaux:", strategy.totalDeposits.toNumber() / 10 ** this.decimals);
            console.log("   🪙 Yield tokens totaux:", strategy.totalYieldTokensMinted.toNumber() / 10 ** this.decimals);

        } catch (error: any) {
            console.error("❌ Erreur de dépôt:", error.message);
            throw error;
        }
    }

    async claimYield() {
        console.log("\n🔄 === RÉCLAMATION DU YIELD ===");

        try {
            // Attendre un peu pour que le yield s'accumule
            console.log("⏳ Attente pour accumulation du yield...");
            await new Promise(resolve => setTimeout(resolve, 3000));

            const userYieldTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.user1,
                this.yieldTokenMintPda!,
                this.user1.publicKey
            );

            const initialBalance = Number(userYieldTokenAccount.amount);
            console.log("💰 Balance initiale de yield tokens:", initialBalance / 10 ** this.decimals);

            const tx = await this.program.methods
                .claimYield(new anchor.BN(this.strategyId))
                .accounts({
                    user: this.user1.publicKey,
                    strategy: this.strategyPda,
                    userPosition: this.userPositionPda,
                    yieldTokenMint: this.yieldTokenMintPda,
                    userYieldTokenAccount: userYieldTokenAccount.address,
                    tokenProgram: TOKEN_PROGRAM_ID,
                } as any)
                .signers([this.user1])
                .rpc();

            console.log("✅ Yield réclamé!");
            console.log("📝 Transaction:", tx);

            // Vérification
            const finalTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.user1,
                this.yieldTokenMintPda!,
                this.user1.publicKey
            );

            const finalBalance = Number(finalTokenAccount.amount);
            const yieldEarned = (finalBalance - initialBalance) / 10 ** this.decimals;

            console.log("💰 Balance finale de yield tokens:", finalBalance / 10 ** this.decimals);
            console.log("📈 Yield gagné:", yieldEarned);

        } catch (error: any) {
            console.error("❌ Erreur de réclamation:", error.message);
            throw error;
        }
    }

    async createMarketplace() {
        console.log("\n🔄 === CRÉATION DU MARKETPLACE YIELDOS ===");

        try {
            const tradingFeeBps = 100; // 1%
            const marketplaceId = 0;

            const tx = await this.program.methods
                .createMarketplace(
                    new anchor.BN(this.strategyId),
                    new anchor.BN(marketplaceId),
                    tradingFeeBps
                )
                .accounts({
                    admin: this.admin.publicKey,
                    strategy: this.strategyPda,
                    marketplace: this.marketplacePda,
                    marketplaceCounter: this.marketplaceCounterPda,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                } as any)
                .signers([this.admin])
                .rpc();

            console.log("✅ Marketplace Yieldos créé!");
            console.log("📝 Transaction:", tx);

            // Vérification
            const marketplace = await this.program.account.marketplace.fetch(this.marketplacePda!);
            console.log("📊 Détails du marketplace:");
            console.log("   🏪 Strategy:", marketplace.strategy.toString());
            console.log("   💰 Frais de trading:", marketplace.tradingFeeBps / 100, "%");
            console.log("   ✅ Actif:", marketplace.isActive);
            console.log("   📊 Volume total:", marketplace.totalVolume.toNumber());
            console.log("   🔄 Trades totaux:", marketplace.totalTrades.toNumber());

        } catch (error: any) {
            if (error.message.includes("already in use")) {
                console.log("ℹ️  Marketplace déjà créé");
            } else {
                console.error("❌ Erreur de création du marketplace:", error.message);
                throw error;
            }
        }
    }

    async displaySummary() {
        console.log("\n📊 === RÉSUMÉ FINAL YIELDOS ===");
        console.log("=====================================");

        try {
            const strategy = await this.program.account.strategy.fetch(this.strategyPda!);
            const userPosition = await this.program.account.userPosition.fetch(this.userPositionPda!);
            const marketplace = await this.program.account.marketplace.fetch(this.marketplacePda!);

            console.log("🏗️  STRATÉGIE:");
            console.log(`   📝 Nom: ${strategy.name}`);
            console.log(`   📈 APY: ${strategy.apy.toNumber() / 100}%`);
            console.log(`   💰 Dépôts totaux: ${strategy.totalDeposits.toNumber() / 10 ** this.decimals} tokens`);
            console.log(`   🪙 Yield tokens mintés: ${strategy.totalYieldTokensMinted.toNumber() / 10 ** this.decimals}`);
            console.log("");

            console.log("👤 POSITION UTILISATEUR:");
            console.log(`   💰 Déposé: ${userPosition.depositedAmount.toNumber() / 10 ** this.decimals} tokens`);
            console.log(`   🪙 Yield tokens: ${userPosition.yieldTokensMinted.toNumber() / 10 ** this.decimals}`);
            console.log(`   📅 Date de dépôt: ${new Date(userPosition.depositTime.toNumber() * 1000).toLocaleString()}`);
            console.log("");

            console.log("🏪 MARKETPLACE:");
            console.log(`   💰 Frais: ${marketplace.tradingFeeBps / 100}%`);
            console.log(`   📊 Volume: ${marketplace.totalVolume.toNumber() / 10 ** this.decimals} tokens`);
            console.log(`   🔄 Trades: ${marketplace.totalTrades.toNumber()}`);
            console.log("");

            console.log("🎯 STATUS: YIELDOS ENTIÈREMENT FONCTIONNEL!");
            console.log("✅ Toutes les fonctions ont été testées avec succès");
            console.log("=====================================");

        } catch (error: any) {
            console.error("❌ Erreur lors du résumé:", error.message);
        }
    }

    async run() {
        try {
            console.log("🎬 === DÉMO INTERACTIVE YIELDOS ===\n");

            await this.setupAccounts();
            await this.initializeProtocol();
            await this.createStrategy();

            const userTokenAccount = await this.setupUserTokens();
            await this.depositToStrategy(userTokenAccount);
            await this.claimYield();
            await this.createMarketplace();

            await this.displaySummary();

            console.log("\n🎉 === DÉMO YIELDOS TERMINÉE AVEC SUCCÈS ===");

        } catch (error) {
            console.error("\n💥 Erreur lors de la démo:", error);
            process.exit(1);
        }
    }
}

// Exécution du script
async function main() {
    const demo = new YieldosInteraction();
    await demo.run();
}

main().catch(console.error); 
'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair, Transaction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createMint, mintTo, getAssociatedTokenAddress } from '@solana/spl-token'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { useMemo } from 'react'
import { useTransactionToast } from '@/components/use-transaction-toast'
import YieldosIDL from '@/idl/yieldos.json'

// Program ID pour devnet (notre contrat déployé)
export const YIELDOS_PROGRAM_ID = new PublicKey('9dEwdrEo7Tu9eTW3S3opbJa1fyyppRGPpdn8CqBxJX27')

// Types basés sur notre IDL
export interface Strategy {
    id: anchor.BN
    name: string
    apy: number
    underlyingToken: PublicKey
    yieldTokenMint: PublicKey
    totalLocked: anchor.BN
    admin: PublicKey
    bump: number
}

export interface UserPosition {
    user: PublicKey
    strategy: PublicKey
    tokensDeposited: anchor.BN
    yieldTokensMinted: anchor.BN
    lastUpdateSlot: anchor.BN
    bump: number
}

export interface Marketplace {
    authority: PublicKey
    bump: number
    feePercentage: number
    totalVolume: anchor.BN
}

export interface Order {
    id: anchor.BN
    user: PublicKey
    marketplace: PublicKey
    tokenOffered: PublicKey
    tokenDesired: PublicKey
    amountOffered: anchor.BN
    amountDesired: anchor.BN
    isActive: boolean
    bump: number
}

// IDL type (version simplifiée pour TypeScript)
type YieldosProgram = {
    version: string
    name: string
    instructions: Array<any>
    accounts: Array<any>
    types: Array<any>
}

export function useYieldosProgram() {
    const { connection } = useConnection()
    const wallet = useWallet()
    const { cluster } = useCluster()
    const transactionToast = useTransactionToast()

    const provider = useMemo(() => {
        if (!wallet || !wallet.publicKey) return null
        return new anchor.AnchorProvider(connection, wallet as any, {
            commitment: 'confirmed',
        })
    }, [connection, wallet])

    const program = useMemo(() => {
        if (!provider) return null

        try {
            return new Program(YieldosIDL as anchor.Idl, provider)
        } catch (error) {
            console.error('Error creating Yieldos program:', error)
            return null
        }
    }, [provider])

    // Utilitaires pour les PDAs
    const getPDAs = useMemo(() => ({
        getProtocolPda: () => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("protocol")],
                YIELDOS_PROGRAM_ID
            )
        },

        getStrategyPda: (strategyId: number) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("strategy"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
                YIELDOS_PROGRAM_ID
            )
        },

        getUserPositionPda: (user: PublicKey, strategyId: number) => {
            const [strategyPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("strategy"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
                YIELDOS_PROGRAM_ID
            )
            return PublicKey.findProgramAddressSync(
                [Buffer.from("user_position"), user.toBuffer(), strategyPda.toBuffer()],
                YIELDOS_PROGRAM_ID
            )
        },

        getMarketplacePda: () => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("marketplace")],
                YIELDOS_PROGRAM_ID
            )
        }
    }), [])

    // Query pour lister toutes les stratégies
    const strategiesQuery = useQuery({
        queryKey: ['yieldos', 'strategies', { cluster: cluster.name }],
        queryFn: async () => {
            if (!connection) throw new Error('Connection not available')

            try {
                // Récupérer toutes les stratégies via RPC
                const accounts = await connection.getProgramAccounts(YIELDOS_PROGRAM_ID, {
                    filters: [
                        {
                            memcmp: {
                                offset: 0,
                                bytes: "strategy" // Discriminator simplifié
                            }
                        }
                    ]
                })

                console.log(`Found ${accounts.length} strategy accounts`)
                return accounts
            } catch (error) {
                console.error('Error fetching strategies:', error)
                return []
            }
        },
        enabled: !!connection
    })

    // Query pour récupérer une stratégie spécifique
    const getStrategyQuery = (strategyId: number) => useQuery({
        queryKey: ['yieldos', 'strategy', strategyId, { cluster: cluster.name }],
        queryFn: async () => {
            if (!connection) throw new Error('Connection not available')

            const [strategyPda] = getPDAs.getStrategyPda(strategyId)

            try {
                const accountInfo = await connection.getAccountInfo(strategyPda)
                if (!accountInfo) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }

                // Parse manuel pour éviter les problèmes d'IDL
                return {
                    publicKey: strategyPda,
                    account: accountInfo
                }
            } catch (error) {
                console.error(`Error fetching strategy ${strategyId}:`, error)
                throw error
            }
        },
        enabled: !!connection
    })

    // Query pour les positions utilisateur
    const userPositionsQuery = useQuery({
        queryKey: ['yieldos', 'userPositions', wallet.publicKey?.toString(), { cluster: cluster.name }],
        queryFn: async () => {
            if (!connection || !wallet.publicKey) throw new Error('Wallet not connected')

            try {
                const accounts = await connection.getProgramAccounts(YIELDOS_PROGRAM_ID, {
                    filters: [
                        {
                            memcmp: {
                                offset: 8, // Skip discriminator
                                bytes: wallet.publicKey.toBase58()
                            }
                        }
                    ]
                })

                return accounts.filter(account => account.account.data.length > 0)
            } catch (error) {
                console.error('Error fetching user positions:', error)
                return []
            }
        },
        enabled: !!connection && !!wallet.publicKey
    })

    // Mutations pour les instructions principales
    const createStrategyMutation = useMutation({
        mutationKey: ['yieldos', 'createStrategy'],
        mutationFn: async ({ name, apyBasisPoints, strategyId }: {
            name: string,
            apyBasisPoints: number,
            strategyId: number
        }) => {
            if (!connection || !wallet.publicKey || !provider || !program) {
                throw new Error('Wallet or program not available')
            }

            try {
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)

                // Créer un mock underlying token (en production, ceci serait passé en paramètre)
                const mockUnderlyingToken = new PublicKey('So11111111111111111111111111111111111111112')

                // Calculer l'adresse du token account de la stratégie
                const strategyTokenAccount = await getAssociatedTokenAddress(
                    mockUnderlyingToken,
                    strategyPda,
                    true
                )

                const tx = await program.methods
                    .createStrategy(name, apyBasisPoints, new anchor.BN(strategyId))
                    .accounts({
                        admin: wallet.publicKey,
                        strategy: strategyPda,
                        underlyingToken: mockUnderlyingToken,
                        strategyTokenAccount: strategyTokenAccount,
                        yieldTokenMint: strategyPda, // Temporary - should be proper mint
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc()

                console.log('Create strategy transaction:', tx)
                return tx
            } catch (error) {
                console.error('Create strategy error:', error)
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
        }
    })

    const initializeProtocolMutation = useMutation({
        mutationKey: ['yieldos', 'initializeProtocol'],
        mutationFn: async () => {
            if (!connection || !wallet.publicKey || !provider || !program) {
                throw new Error('Wallet or program not available')
            }

            try {
                const [protocolPda] = getPDAs.getProtocolPda()

                const tx = await program.methods
                    .initializeProtocol()
                    .accounts({
                        admin: wallet.publicKey,
                        protocol: protocolPda,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc()

                console.log('Initialize protocol transaction:', tx)
                return tx
            } catch (error) {
                console.error('Initialize protocol error:', error)
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
        }
    })

    return {
        program,
        provider,
        programId: YIELDOS_PROGRAM_ID,
        getPDAs,
        strategiesQuery,
        getStrategyQuery,
        userPositionsQuery,
        createStrategyMutation,
        initializeProtocolMutation,
        cluster,
        connection
    }
}

// Hook pour interagir avec une stratégie spécifique
export function useYieldosStrategy({ strategyId }: { strategyId: number }) {
    const { connection, provider, getPDAs } = useYieldosProgram()
    const wallet = useWallet()
    const transactionToast = useTransactionToast()

    const strategyQuery = useQuery({
        queryKey: ['yieldos', 'strategy', strategyId],
        queryFn: async () => {
            if (!connection) throw new Error('Connection not available')

            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const accountInfo = await connection.getAccountInfo(strategyPda)

            if (!accountInfo) {
                throw new Error(`Strategy ${strategyId} not found`)
            }

            return {
                publicKey: strategyPda,
                account: accountInfo
            }
        },
        enabled: !!connection
    })

    // Mutation pour depositer dans une stratégie
    const depositMutation = useMutation({
        mutationKey: ['yieldos', 'deposit', strategyId],
        mutationFn: async ({ amount }: { amount: number }) => {
            if (!connection || !wallet.publicKey || !provider) {
                throw new Error('Wallet not connected')
            }

            const yieldosProgram = new Program(YieldosIDL as anchor.Idl, provider)

            console.log(`Depositing ${amount} tokens to strategy ${strategyId}`)

            try {
                // Calculer les PDAs nécessaires
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)
                const [userPositionPda] = getPDAs.getUserPositionPda(wallet.publicKey, strategyId)

                // Pour l'instant, on utilise des placeholders pour les token accounts
                // En production, ces adresses devraient être récupérées de la stratégie
                const mockUnderlyingToken = new PublicKey('So11111111111111111111111111111111111111112') // SOL wrapped
                const mockYieldTokenMint = new PublicKey('So11111111111111111111111111111111111111112')

                const userTokenAccount = await getAssociatedTokenAddress(
                    mockUnderlyingToken,
                    wallet.publicKey
                )

                const strategyTokenAccount = await getAssociatedTokenAddress(
                    mockUnderlyingToken,
                    strategyPda,
                    true
                )

                const userYieldTokenAccount = await getAssociatedTokenAddress(
                    mockYieldTokenMint,
                    wallet.publicKey
                )

                // Exécuter l'instruction depositToStrategy
                const tx = await yieldosProgram.methods
                    .depositToStrategy(new anchor.BN(amount))
                    .accounts({
                        user: wallet.publicKey,
                        strategy: strategyPda,
                        userPosition: userPositionPda,
                        userTokenAccount: userTokenAccount,
                        strategyTokenAccount: strategyTokenAccount,
                        yieldTokenMint: mockYieldTokenMint,
                        userYieldTokenAccount: userYieldTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc()

                console.log('Deposit transaction:', tx)
                return tx
            } catch (error) {
                console.error('Deposit error:', error)
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
        },
        onError: (error) => {
            console.error('Deposit failed:', error)
        }
    })

    // Mutation pour retirer des tokens
    const withdrawMutation = useMutation({
        mutationKey: ['yieldos', 'withdraw', strategyId],
        mutationFn: async ({ amount }: { amount: number }) => {
            if (!connection || !wallet.publicKey || !provider) {
                throw new Error('Wallet not connected')
            }

            const yieldosProgram = new Program(YieldosIDL as anchor.Idl, provider)

            console.log(`Withdrawing ${amount} tokens from strategy ${strategyId}`)

            try {
                // Calculer les PDAs nécessaires
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)
                const [userPositionPda] = getPDAs.getUserPositionPda(wallet.publicKey, strategyId)

                // Placeholders pour les token accounts
                const mockUnderlyingToken = new PublicKey('So11111111111111111111111111111111111111112')
                const mockYieldTokenMint = new PublicKey('So11111111111111111111111111111111111111112')

                const userTokenAccount = await getAssociatedTokenAddress(
                    mockUnderlyingToken,
                    wallet.publicKey
                )

                const strategyTokenAccount = await getAssociatedTokenAddress(
                    mockUnderlyingToken,
                    strategyPda,
                    true
                )

                const userYieldTokenAccount = await getAssociatedTokenAddress(
                    mockYieldTokenMint,
                    wallet.publicKey
                )

                // Exécuter l'instruction withdrawFromStrategy
                const tx = await yieldosProgram.methods
                    .withdrawFromStrategy(new anchor.BN(amount))
                    .accounts({
                        user: wallet.publicKey,
                        strategy: strategyPda,
                        userPosition: userPositionPda,
                        userTokenAccount: userTokenAccount,
                        strategyTokenAccount: strategyTokenAccount,
                        yieldTokenMint: mockYieldTokenMint,
                        userYieldTokenAccount: userYieldTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc()

                console.log('Withdraw transaction:', tx)
                return tx
            } catch (error) {
                console.error('Withdraw error:', error)
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
        }
    })

    return {
        strategyQuery,
        depositMutation,
        withdrawMutation
    }
} 
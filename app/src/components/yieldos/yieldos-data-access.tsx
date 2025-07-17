'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createMint, mintTo } from '@solana/spl-token'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { useMemo } from 'react'
import { useTransactionToast } from '@/components/use-transaction-toast'

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
        // Pour l'instant, on n'utilise pas le Program d'Anchor pour éviter les problèmes d'IDL
        // On utilise directement les requêtes RPC via connection
        return null
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

    return {
        program,
        provider,
        programId: YIELDOS_PROGRAM_ID,
        getPDAs,
        strategiesQuery,
        getStrategyQuery,
        userPositionsQuery,
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

            console.log(`Depositing ${amount} tokens to strategy ${strategyId}`)

            // Cette logique sera complétée avec les instructions réelles
            const signature = await connection.requestAirdrop(wallet.publicKey, 1000000)
            await connection.confirmTransaction(signature)

            return signature
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
            if (!connection || !wallet.publicKey) {
                throw new Error('Wallet not connected')
            }

            console.log(`Withdrawing ${amount} tokens from strategy ${strategyId}`)

            // Cette logique sera complétée avec les instructions réelles
            const signature = await connection.requestAirdrop(wallet.publicKey, 1000000)
            await connection.confirmTransaction(signature)

            return signature
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
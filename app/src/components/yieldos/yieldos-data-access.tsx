'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, NATIVE_MINT, createSyncNativeInstruction } from '@solana/spl-token'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { useMemo, useState } from 'react'
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
// type YieldosProgram = {
//     version: string
//     name: string
//     instructions: Array<any>
//     accounts: Array<any>
//     types: Array<any>
// }

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

        getStrategyCounterPda: () => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("strategy_counter")],
                YIELDOS_PROGRAM_ID
            )
        },

        getYieldTokenMintPda: (strategyId: number) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("yield_token"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
                YIELDOS_PROGRAM_ID
            )
        },

        getStrategyVaultPda: (strategyId: number) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("strategy_vault"), new anchor.BN(strategyId).toArrayLike(Buffer, "le", 8)],
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

        getMarketplacePda: (strategyPda: PublicKey) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("marketplace"), strategyPda.toBuffer()],
                YIELDOS_PROGRAM_ID
            )
        },

        getMarketplaceCounterPda: () => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("marketplace_counter")],
                YIELDOS_PROGRAM_ID
            )
        },

        getOrderPda: (user: PublicKey, orderId: number) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("order"), user.toBuffer(), new anchor.BN(orderId).toArrayLike(Buffer, "le", 8)],
                YIELDOS_PROGRAM_ID
            )
        },

        getOrderCounterPda: () => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("order_counter")],
                YIELDOS_PROGRAM_ID
            )
        },

        getEscrowPda: (orderPda: PublicKey) => {
            return PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), orderPda.toBuffer()],
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
                // D'abord essayer de récupérer le strategy counter pour savoir combien de stratégies existent
                const [strategyCounterPda] = getPDAs.getStrategyCounterPda()
                const counterAccount = await connection.getAccountInfo(strategyCounterPda)

                if (!counterAccount) {
                    console.log('Strategy counter not found, no strategies exist yet')
                    return []
                }

                // Parser le nombre de stratégies depuis le counter
                const data = counterAccount.data
                let strategyCount = 0
                if (data.length >= 16) {
                    const view = new DataView(data.buffer, data.byteOffset + 8, 8)
                    strategyCount = Number(view.getBigUint64(0, true))
                }

                console.log(`Strategy counter shows ${strategyCount} strategies`)

                // Récupérer chaque stratégie individuellement avec décodage (délais pour éviter rate limiting)
                const strategies = []
                for (let i = 1; i <= strategyCount; i++) {
                    try {
                        // Attendre 300ms entre chaque requête pour éviter le rate limiting
                        if (i > 1) {
                            await new Promise(resolve => setTimeout(resolve, 300))
                        }

                        const [strategyPda] = getPDAs.getStrategyPda(i)
                        const accountInfo = await connection.getAccountInfo(strategyPda)

                        if (accountInfo) {
                            // Essayer de décoder avec Anchor
                            let decodedData = null
                            if (program) {
                                try {
                                    const coder = new anchor.BorshAccountsCoder(YieldosIDL as anchor.Idl)
                                    decodedData = coder.decode('strategy', accountInfo.data)
                                } catch (decodeError) {
                                    console.warn(`Failed to decode strategy ${i}:`, decodeError)
                                }
                            }

                            strategies.push({
                                pubkey: strategyPda,
                                account: accountInfo,
                                decodedData: decodedData,
                                strategyId: i
                            })
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch strategy ${i}:`, error)
                    }
                }

                console.log(`Successfully loaded ${strategies.length} strategies`)
                return strategies
            } catch (error) {
                console.error('Error fetching strategies:', error)
                return []
            }
        },
        enabled: !!connection,
        staleTime: 30000, // 30 secondes - ne pas refetch si les données sont récentes
        gcTime: 60000, // 1 minute - garder en cache (remplace cacheTime)
        refetchOnWindowFocus: false, // Ne pas refetch quand on revient sur l'onglet
        refetchInterval: false // Pas de polling automatique
    })

    // Function pour créer une query pour récupérer une stratégie spécifique
    const useStrategyQuery = (strategyId: number) => useQuery({
        queryKey: ['yieldos', 'strategy', strategyId, { cluster: cluster.name }],
        queryFn: async () => {
            if (!connection) throw new Error('Connection not available')

            const [strategyPda] = getPDAs.getStrategyPda(strategyId)

            try {
                const accountInfo = await connection.getAccountInfo(strategyPda)
                if (!accountInfo) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }

                // Parser manuellement les données (Anchor decode ne fonctionne pas avec notre IDL)
                let decodedData = null
                try {
                    const data = accountInfo.data
                    let offset = 8 // Skip discriminator

                    // Skip admin (32), underlying_token (32), yield_token_mint (32)
                    offset += 96

                    // Parse name (4 bytes length + string data)
                    const nameLength = data.readUInt32LE(offset)
                    offset += 4
                    const nameBytes = data.subarray(offset, offset + nameLength)
                    const name = new TextDecoder().decode(nameBytes)
                    offset += nameLength

                    // Parse APY (8 bytes u64)
                    const apyLow = data.readUInt32LE(offset)
                    const apyHigh = data.readUInt32LE(offset + 4)
                    const apy = apyHigh * 0x100000000 + apyLow
                    offset += 8

                    // Parse total_deposits (8 bytes u64)
                    const totalDepositsLow = data.readUInt32LE(offset)
                    const totalDepositsHigh = data.readUInt32LE(offset + 4)
                    const totalDeposits = totalDepositsHigh * 0x100000000 + totalDepositsLow
                    offset += 8

                    // Parse is_active (1 byte bool)
                    const isActive = data[offset] !== 0
                    offset += 1

                    // Skip created_at (8 bytes)
                    offset += 8

                    // Skip total_yield_tokens_minted (8 bytes)
                    offset += 8

                    // Parse strategy_id (8 bytes u64)
                    const strategyIdLow = data.readUInt32LE(offset)
                    const strategyIdHigh = data.readUInt32LE(offset + 4)
                    const strategyId = strategyIdHigh * 0x100000000 + strategyIdLow

                    decodedData = {
                        name,
                        apy,
                        totalDeposits,
                        isActive,
                        strategyId
                    }

                    console.log('Manually parsed strategy:', decodedData)
                } catch (parseError) {
                    console.warn('Failed to parse strategy data:', parseError)
                }

                return {
                    publicKey: strategyPda,
                    account: accountInfo,
                    decodedData: decodedData,
                    strategyId: strategyId
                }
            } catch (error) {
                console.error(`Error fetching strategy ${strategyId}:`, error)
                throw error
            }
        },
        enabled: !!connection,
        staleTime: 20000, // 20 secondes
        gcTime: 60000, // 1 minute 
        refetchOnWindowFocus: false,
        refetchInterval: false
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
        enabled: !!connection && !!wallet.publicKey,
        staleTime: 15000, // 15 secondes
        gcTime: 60000, // 1 minute
        refetchOnWindowFocus: false,
        refetchInterval: false
    })

    // Query pour obtenir le prochain strategy ID disponible
    const getNextStrategyIdQuery = useQuery({
        queryKey: ['yieldos', 'nextStrategyId', { cluster: cluster.name }],
        queryFn: async () => {
            if (!connection) throw new Error('Connection not available')

            try {
                const [strategyCounterPda] = getPDAs.getStrategyCounterPda()
                const accountInfo = await connection.getAccountInfo(strategyCounterPda)

                if (!accountInfo) {
                    // Si le counter n'existe pas, commencer à 1
                    return 1
                }

                // Parser le counter depuis les données du compte (simple u64 à l'offset 8)
                const data = accountInfo.data
                if (data.length >= 16) {
                    const view = new DataView(data.buffer, data.byteOffset + 8, 8)
                    const counter = view.getBigUint64(0, true) // little endian
                    return Number(counter) + 1
                }

                return 1
            } catch (error) {
                console.error('Error fetching next strategy ID:', error)
                return 1
            }
        },
        enabled: !!connection
    })

    // Mutations pour les instructions principales
    const createStrategyMutation = useMutation({
        mutationKey: ['yieldos', 'createStrategy'],
        mutationFn: async ({ name, apyBasisPoints }: {
            name: string,
            apyBasisPoints: number
        }) => {
            if (!connection || !wallet.publicKey || !provider || !program) {
                throw new Error('Wallet or program not available')
            }

            // Obtenir le prochain strategy ID
            const strategyId = getNextStrategyIdQuery.data || 1

            try {
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)
                const [strategyCounterPda] = getPDAs.getStrategyCounterPda()
                const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(strategyId)

                // Utiliser WSOL comme underlying token par défaut
                const underlyingToken = new PublicKey('So11111111111111111111111111111111111111112')

                console.log('Creating strategy with:', {
                    name,
                    apyBasisPoints,
                    strategyId,
                    strategyPda: strategyPda.toString(),
                    strategyCounterPda: strategyCounterPda.toString(),
                    yieldTokenMintPda: yieldTokenMintPda.toString()
                })

                const tx = await program.methods
                    .createStrategy(name, apyBasisPoints, new anchor.BN(strategyId))
                    .accounts({
                        admin: wallet.publicKey,
                        strategy: strategyPda,
                        strategyCounter: strategyCounterPda,
                        underlyingToken: underlyingToken,
                        yieldTokenMint: yieldTokenMintPda,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .rpc()

                console.log('Create strategy transaction:', tx)

                // Refetch queries après succès
                strategiesQuery.refetch()
                getNextStrategyIdQuery.refetch()

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
        useStrategyQuery,
        userPositionsQuery,
        getNextStrategyIdQuery,
        createStrategyMutation,
        initializeProtocolMutation,
        cluster,
        connection
    }
}

// Hook pour interagir avec une stratégie spécifique
export function useYieldosStrategy({ strategyId }: { strategyId: number }) {
    const { connection, provider, getPDAs, useStrategyQuery: createStrategyQuery } = useYieldosProgram()
    const wallet = useWallet()
    const transactionToast = useTransactionToast()

    const strategyQuery = createStrategyQuery(strategyId)

    // Mutation pour depositer dans une stratégie
    const depositMutation = useMutation({
        mutationKey: ['yieldos', 'deposit', strategyId],
        mutationFn: async ({ amount }: { amount: number }) => {
            console.log('=== DEPOSIT MUTATION START ===')
            console.log('Received amount:', amount, 'type:', typeof amount)

            if (!connection || !wallet.publicKey || !provider) {
                throw new Error('Wallet not connected')
            }

            const yieldosProgram = new Program(YieldosIDL as anchor.Idl, provider)

            console.log(`Depositing ${amount} tokens to strategy ${strategyId}`)

            try {
                // Calculer toutes les PDAs nécessaires
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)
                const [userPositionPda] = getPDAs.getUserPositionPda(wallet.publicKey, strategyId)
                const [strategyVaultPda] = getPDAs.getStrategyVaultPda(strategyId)
                const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(strategyId)

                // Récupérer les informations de la stratégie pour obtenir l'underlying token
                const strategyAccount = await connection.getAccountInfo(strategyPda)
                if (!strategyAccount) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }

                // Parser l'underlying token depuis les données de la stratégie
                let underlyingTokenMint: PublicKey
                try {
                    // L'underlying token est à l'offset 40 (discriminator 8 + admin 32)
                    const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                    underlyingTokenMint = new PublicKey(underlyingTokenBytes)
                } catch (parseError) {
                    console.warn('Failed to parse underlying token, using WSOL:', parseError)
                    underlyingTokenMint = NATIVE_MINT // Utiliser NATIVE_MINT au lieu d'hardcoder
                }

                // Calculer les addresses des token accounts
                const userUnderlyingToken = await getAssociatedTokenAddress(
                    underlyingTokenMint,
                    wallet.publicKey
                )

                const userYieldTokenAccount = await getAssociatedTokenAddress(
                    yieldTokenMintPda,
                    wallet.publicKey
                )

                // Vérifier si c'est WSOL (SOL natif)
                const isWSol = underlyingTokenMint.equals(NATIVE_MINT)

                // Préparer les instructions préparatoires
                const setupInstructions: TransactionInstruction[] = []

                // Vérifier si le compte de token utilisateur existe
                const userTokenAccountInfo = await connection.getAccountInfo(userUnderlyingToken)

                if (!userTokenAccountInfo) {
                    console.log('Creating user token account for', underlyingTokenMint.toString())
                    // Créer le compte de token associé
                    setupInstructions.push(
                        createAssociatedTokenAccountInstruction(
                            wallet.publicKey, // payer
                            userUnderlyingToken, // associatedToken
                            wallet.publicKey, // owner
                            underlyingTokenMint // mint
                        )
                    )
                }

                // Si c'est WSOL, gérer la conversion SOL → WSOL
                if (isWSol) {
                    // Vérifier le solde SOL de l'utilisateur
                    const solBalance = await connection.getBalance(wallet.publicKey)
                    const requiredLamports = amount // amount est en lamports pour SOL
                    const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(165) // Taille d'un TokenAccount

                    // Vérifier le solde WSOL actuel si le compte existe
                    let currentWsolBalance = 0
                    if (userTokenAccountInfo) {
                        try {
                            const tokenBalance = await connection.getTokenAccountBalance(userUnderlyingToken)
                            currentWsolBalance = Number(tokenBalance.value.amount)
                        } catch (error) {
                            console.warn('Could not read WSOL balance:', error)
                        }
                    }

                    console.log('WSOL deposit check:', {
                        solBalance: solBalance / 1e9,
                        currentWsolBalance: currentWsolBalance / 1e9,
                        requiredAmount: amount / 1e9,
                        hasWSolAccount: !!userTokenAccountInfo
                    })

                    // Si l'utilisateur a suffisamment de WSOL, utiliser ça
                    if (currentWsolBalance >= amount) {
                        console.log('Using existing WSOL balance')
                        // Rien à faire, utiliser le WSOL existant
                    } else {
                        // Sinon, convertir SOL → WSOL
                        const amountToWrap = amount - currentWsolBalance // Seulement wrapper ce qui manque

                        if (solBalance < amountToWrap + rentExemptAmount + 5000) { // 5000 lamports pour les frais de tx
                            throw new Error(`Insufficient SOL balance. You need ${(amountToWrap + rentExemptAmount) / 1e9} SOL but only have ${solBalance / 1e9} SOL`)
                        }

                        console.log('Converting SOL to WSOL:', {
                            amountToWrap: amountToWrap / 1e9,
                            existingWSol: currentWsolBalance / 1e9
                        })

                        // Transférer SOL vers le compte WSOL
                        setupInstructions.push(
                            SystemProgram.transfer({
                                fromPubkey: wallet.publicKey,
                                toPubkey: userUnderlyingToken,
                                lamports: amountToWrap,
                            })
                        )

                        // Synchroniser le compte WSOL
                        setupInstructions.push(
                            createSyncNativeInstruction(userUnderlyingToken)
                        )
                    }
                } else {
                    // Pour les autres tokens, vérifier le solde
                    if (userTokenAccountInfo) {
                        const tokenBalance = await connection.getTokenAccountBalance(userUnderlyingToken)
                        const currentBalance = Number(tokenBalance.value.amount)

                        if (currentBalance < amount) {
                            throw new Error(`Insufficient token balance. You need ${amount} tokens but only have ${currentBalance} tokens.`)
                        }
                    } else {
                        throw new Error(`You don't have a token account for this strategy's underlying token. Please obtain some tokens first.`)
                    }
                }

                console.log('Deposit accounts:', {
                    user: wallet.publicKey.toString(),
                    strategy: strategyPda.toString(),
                    userPosition: userPositionPda.toString(),
                    underlyingTokenMint: underlyingTokenMint.toString(),
                    userUnderlyingToken: userUnderlyingToken.toString(),
                    strategyVault: strategyVaultPda.toString(),
                    yieldTokenMint: yieldTokenMintPda.toString(),
                    userYieldTokenAccount: userYieldTokenAccount.toString(),
                    isWSol,
                    setupInstructionsCount: setupInstructions.length
                })

                // Si on a des instructions de setup, les exécuter d'abord
                if (setupInstructions.length > 0) {
                    console.log('Executing setup instructions...')
                    const setupTx = new Transaction().add(...setupInstructions)
                    const setupSignature = await provider.sendAndConfirm(setupTx)
                    console.log('Setup transaction:', setupSignature)
                }

                // Validation finale avant l'envoi
                console.log('Final validation before contract call:')
                console.log('- amount:', amount, 'type:', typeof amount)
                console.log('- strategyId:', strategyId, 'type:', typeof strategyId)
                console.log('- new anchor.BN(amount):', new anchor.BN(amount).toString())
                console.log('- amount > 0?', amount > 0)

                if (!amount || amount <= 0) {
                    throw new Error(`Invalid amount before contract call: ${amount}`)
                }

                // Exécuter l'instruction depositToStrategy avec la structure complète
                const tx = await yieldosProgram.methods
                    .depositToStrategy(new anchor.BN(amount), new anchor.BN(strategyId))
                    .accounts({
                        user: wallet.publicKey,
                        strategy: strategyPda,
                        userPosition: userPositionPda,
                        underlyingTokenMint: underlyingTokenMint,
                        userUnderlyingToken: userUnderlyingToken,
                        strategyVault: strategyVaultPda,
                        yieldTokenMint: yieldTokenMintPda,
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

                // Message d'erreur plus utile pour l'utilisateur
                if (error instanceof Error) {
                    if (error.message.includes('AccountNotInitialized')) {
                        throw new Error('Token account setup failed. Please try again.')
                    } else if (error.message.includes('already in use')) {
                        throw new Error('User position already exists. This might be a normal state.')
                    } else if (error.message.includes('insufficient funds')) {
                        throw new Error('Insufficient token balance for this deposit.')
                    }
                }
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
                // Calculer toutes les PDAs nécessaires
                const [strategyPda] = getPDAs.getStrategyPda(strategyId)
                const [userPositionPda] = getPDAs.getUserPositionPda(wallet.publicKey, strategyId)
                const [strategyVaultPda] = getPDAs.getStrategyVaultPda(strategyId)
                const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(strategyId)

                // Récupérer les informations de la stratégie pour obtenir l'underlying token
                const strategyAccount = await connection.getAccountInfo(strategyPda)
                if (!strategyAccount) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }

                // Parser l'underlying token depuis les données de la stratégie
                let underlyingTokenMint: PublicKey
                try {
                    // L'underlying token est à l'offset 40 (discriminator 8 + admin 32)
                    const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                    underlyingTokenMint = new PublicKey(underlyingTokenBytes)
                } catch (parseError) {
                    console.warn('Failed to parse underlying token, using WSOL:', parseError)
                    underlyingTokenMint = new PublicKey('So11111111111111111111111111111111111111112')
                }

                // Calculer les addresses des token accounts
                const userUnderlyingToken = await getAssociatedTokenAddress(
                    underlyingTokenMint,
                    wallet.publicKey
                )

                const userYieldTokenAccount = await getAssociatedTokenAddress(
                    yieldTokenMintPda,
                    wallet.publicKey
                )

                console.log('Withdraw accounts:', {
                    user: wallet.publicKey.toString(),
                    strategy: strategyPda.toString(),
                    userPosition: userPositionPda.toString(),
                    strategyVault: strategyVaultPda.toString(),
                    userUnderlyingToken: userUnderlyingToken.toString(),
                    yieldTokenMint: yieldTokenMintPda.toString(),
                    userYieldTokenAccount: userYieldTokenAccount.toString()
                })

                // Exécuter l'instruction withdrawFromStrategy avec la structure complète
                const tx = await yieldosProgram.methods
                    .withdrawFromStrategy(new anchor.BN(amount), new anchor.BN(strategyId))
                    .accounts({
                        user: wallet.publicKey,
                        strategy: strategyPda,
                        userPosition: userPositionPda,
                        strategyVault: strategyVaultPda,
                        userUnderlyingToken: userUnderlyingToken,
                        yieldTokenMint: yieldTokenMintPda,
                        userYieldTokenAccount: userYieldTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .rpc()

                console.log('Withdraw transaction:', tx)
                return tx
            } catch (error) {
                console.error('Withdraw error:', error)

                // Message d'erreur plus utile pour l'utilisateur
                if (error instanceof Error) {
                    if (error.message.includes('AccountNotInitialized')) {
                        throw new Error('No position found for this strategy. You need to deposit first.')
                    } else if (error.message.includes('insufficient funds')) {
                        throw new Error('Insufficient yield tokens to withdraw this amount.')
                    } else if (error.message.includes('InvalidAccountData')) {
                        throw new Error('Invalid withdrawal amount or strategy state.')
                    }
                }
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
        }
    })

    // Cache pour éviter les requêtes répétées
    const [tokenRequirementsCache, setTokenRequirementsCache] = useState<any>(null)
    const [lastCacheTime, setLastCacheTime] = useState(0)

    // Fonction utilitaire pour obtenir des infos sur les tokens requis
    const getTokenRequirements = async () => {
        if (!connection || !wallet.publicKey) {
            return null
        }

        // Cache pendant 30 secondes pour éviter le rate limiting
        const now = Date.now()
        if (tokenRequirementsCache && (now - lastCacheTime) < 30000) {
            console.log('Using cached token requirements')
            return tokenRequirementsCache
        }

        try {
            console.log('Fetching fresh token requirements...')
            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const strategyAccount = await connection.getAccountInfo(strategyPda)

            if (!strategyAccount) {
                return null
            }

            // Parser l'underlying token
            let underlyingTokenMint: PublicKey
            try {
                const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                underlyingTokenMint = new PublicKey(underlyingTokenBytes)
            } catch (parseError) {
                underlyingTokenMint = NATIVE_MINT
            }

            const isWSol = underlyingTokenMint.equals(NATIVE_MINT)
            const userTokenAddress = await getAssociatedTokenAddress(underlyingTokenMint, wallet.publicKey)
            const userTokenAccountInfo = await connection.getAccountInfo(userTokenAddress)

            let currentBalance = 0
            let solBalance = 0

            // Obtenir le solde SOL
            solBalance = await connection.getBalance(wallet.publicKey)

            // Obtenir le solde du token si le compte existe
            if (userTokenAccountInfo) {
                try {
                    const tokenBalance = await connection.getTokenAccountBalance(userTokenAddress)
                    currentBalance = Number(tokenBalance.value.amount)
                } catch (error) {
                    console.warn('Could not fetch token balance:', error)
                }
            }

            const result = {
                underlyingTokenMint: underlyingTokenMint.toString(),
                isWSol,
                hasTokenAccount: !!userTokenAccountInfo,
                currentTokenBalance: currentBalance,
                currentSolBalance: solBalance,
                tokenName: isWSol ? 'WSOL (Wrapped SOL)' : 'Token',
                canUseNativeSOL: isWSol,
                recommendedAction: isWSol
                    ? (userTokenAccountInfo && currentBalance > 0)
                        ? 'You can use your existing WSOL tokens'
                        : 'You can deposit SOL directly - it will be converted to WSOL automatically'
                    : userTokenAccountInfo
                        ? 'Use your existing tokens'
                        : 'You need to obtain this token first'
            }

            // Sauvegarder en cache
            setTokenRequirementsCache(result)
            setLastCacheTime(Date.now())

            return result
        } catch (error) {
            console.error('Error getting token requirements:', error)
            return null
        }
    }

    // Fonction pour récupérer les données de la position utilisateur
    const getUserPosition = async () => {
        if (!connection || !wallet.publicKey) {
            return null
        }

        try {
            const [userPositionPda] = getPDAs.getUserPositionPda(wallet.publicKey, strategyId)
            const positionAccount = await connection.getAccountInfo(userPositionPda)

            if (!positionAccount) {
                return null
            }

            // Parser manuellement les données UserPosition
            const data = positionAccount.data
            let offset = 8 // Skip discriminator

            // user: Pubkey (32 bytes)
            offset += 32

            // strategy: Pubkey (32 bytes) 
            offset += 32

            // deposited_amount: u64 (8 bytes)
            const depositedAmount = data.readBigUInt64LE(offset)
            offset += 8

            // yield_tokens_minted: u64 (8 bytes)
            const yieldTokensMinted = data.readBigUInt64LE(offset)
            offset += 8

            // deposit_time: i64 (8 bytes)
            const depositTime = data.readBigInt64LE(offset)
            offset += 8

            // last_yield_claim: i64 (8 bytes) 
            const lastYieldClaim = data.readBigInt64LE(offset)
            offset += 8

            // total_yield_claimed: u64 (8 bytes)
            const totalYieldClaimed = data.readBigUInt64LE(offset)

            return {
                deposited_amount: Number(depositedAmount),
                yield_tokens_minted: Number(yieldTokensMinted),
                deposit_time: Number(depositTime),
                last_yield_claim: Number(lastYieldClaim),
                total_yield_claimed: Number(totalYieldClaimed)
            }
        } catch (error) {
            console.warn('Error getting user position:', error)
            return null
        }
    }

    // Fonction pour récupérer le solde de yield tokens de l'utilisateur
    const getUserYieldTokenBalance = async () => {
        if (!connection || !wallet.publicKey) {
            return 0
        }

        try {
            const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(strategyId)
            const userYieldTokenAccount = await getAssociatedTokenAddress(
                yieldTokenMintPda,
                wallet.publicKey
            )

            const accountInfo = await connection.getAccountInfo(userYieldTokenAccount)
            if (!accountInfo) {
                return 0
            }

            const tokenBalance = await connection.getTokenAccountBalance(userYieldTokenAccount)
            return Number(tokenBalance.value.amount)
        } catch (error) {
            console.warn('Error getting yield token balance:', error)
            return 0
        }
    }

    return {
        strategyQuery,
        depositMutation,
        withdrawMutation,
        getTokenRequirements,
        getUserYieldTokenBalance,
        getUserPosition
    }
}

// Types pour le marketplace
export interface MarketplaceData {
    admin: PublicKey
    strategy: PublicKey
    yieldTokenMint: PublicKey
    underlyingTokenMint: PublicKey
    totalVolume: number
    totalTrades: number
    bestBidPrice: number
    bestAskPrice: number
    tradingFeeBps: number
    isActive: boolean
    createdAt: number
    marketplaceId: number
}

export interface TradeOrderData {
    user: PublicKey
    marketplace: PublicKey
    orderType: number // 0 = Buy, 1 = Sell
    yieldTokenAmount: number
    pricePerToken: number
    totalValue: number
    filledAmount: number
    isActive: boolean
    createdAt: number
    orderId: number
}

export function useMarketplace() {
    const { connection } = useConnection()
    const wallet = useWallet()
    const { cluster } = useCluster()
    const transactionToast = useTransactionToast()
    const { program, getPDAs } = useYieldosProgram()

    // Query pour récupérer tous les marketplaces
    const marketplacesQuery = useQuery({
        queryKey: ['yieldos', 'marketplaces', { cluster: cluster.name }],
        queryFn: async (): Promise<MarketplaceData[]> => {
            if (!connection) throw new Error('Connection not available')

            try {
                // Récupérer tous les comptes du programme et analyser leurs tailles
                const accounts = await connection.getProgramAccounts(YIELDOS_PROGRAM_ID)

                console.log(`Found ${accounts.length} total program accounts`)

                // Analyser les tailles de comptes pour identifier les marketplaces
                const accountSizes = accounts.map(acc => acc.account.data.length)
                const uniqueSizes = [...new Set(accountSizes)].sort((a, b) => a - b)
                console.log('Account sizes found:', uniqueSizes)

                // Essayons plusieurs tailles possibles pour les marketplaces
                const possibleMarketplaceSizes = [
                    8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 1 + 8 + 8, // taille calculée
                    185, // taille alternative possible
                    193, // autre taille possible
                ]

                console.log('Testing marketplace sizes:', possibleMarketplaceSizes)

                // Filtrer les comptes qui pourraient être des marketplaces
                const marketplaceAccounts = accounts.filter(account => {
                    const size = account.account.data.length
                    const couldBeMarketplace = possibleMarketplaceSizes.includes(size)

                    if (couldBeMarketplace) {
                        console.log(`Potential marketplace account: ${account.pubkey.toString()}, size: ${size}`)
                    }

                    return couldBeMarketplace
                })

                console.log(`Found ${marketplaceAccounts.length} potential marketplace accounts`)

                const marketplaces: MarketplaceData[] = []

                // Si aucun compte n'a la bonne taille, essayons de parser tous les comptes
                const accountsToTry = marketplaceAccounts.length > 0 ? marketplaceAccounts : accounts

                console.log(`Trying to parse ${accountsToTry.length} accounts as marketplaces...`)

                for (const account of accountsToTry) {
                    try {
                        const data = account.account.data
                        console.log(`\nParsing marketplace account: ${account.pubkey.toString()}`)
                        console.log(`Data length: ${data.length}`)
                        console.log(`First 64 bytes:`, Array.from(data.subarray(0, Math.min(64, data.length))))

                        let offset = 8 // Skip discriminator

                        // Parse marketplace data
                        const admin = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32
                        const strategy = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32
                        const yieldTokenMint = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32
                        const underlyingTokenMint = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32

                        // Vérifier qu'on a encore assez de données
                        if (offset + 8 > data.length) {
                            console.warn(`Not enough data for volume at offset ${offset}, data length: ${data.length}`)
                            continue
                        }

                        const totalVolume = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const totalTrades = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const bestBidPrice = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const bestAskPrice = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const tradingFeeBps = data.readUInt16LE(offset)
                        offset += 2
                        const isActive = data.readUInt8(offset) === 1
                        offset += 1
                        const createdAt = Number(data.readBigInt64LE(offset))
                        offset += 8
                        const marketplaceId = Number(data.readBigUInt64LE(offset))

                        // Validation basique pour s'assurer que c'est vraiment un marketplace
                        const isValidMarketplace = (
                            admin.toString() !== '11111111111111111111111111111111' && // Pas le system program
                            strategy.toString() !== '11111111111111111111111111111111' &&
                            yieldTokenMint.toString() !== '11111111111111111111111111111111' &&
                            underlyingTokenMint.toString() !== '11111111111111111111111111111111' &&
                            tradingFeeBps <= 10000 && // Fee ne peut pas être > 100%
                            (isActive === true || isActive === false) // Boolean valide
                        )

                        if (!isValidMarketplace) {
                            console.log('Invalid marketplace data, skipping...')
                            continue
                        }

                        const marketplaceData = {
                            admin,
                            strategy,
                            yieldTokenMint,
                            underlyingTokenMint,
                            totalVolume,
                            totalTrades,
                            bestBidPrice,
                            bestAskPrice,
                            tradingFeeBps,
                            isActive,
                            createdAt,
                            marketplaceId
                        }

                        console.log('✅ Successfully parsed valid marketplace:', {
                            pubkey: account.pubkey.toString(),
                            strategy: strategy.toString(),
                            marketplaceId,
                            isActive,
                            tradingFeeBps
                        })

                        marketplaces.push(marketplaceData)
                    } catch (parseError) {
                        console.warn(`Error parsing marketplace account ${account.pubkey.toString()}:`, parseError)
                        console.log('Raw data:', Array.from(account.account.data))
                    }
                }

                return marketplaces
            } catch (error) {
                console.error('Error fetching marketplaces:', error)
                return []
            }
        },
        enabled: !!connection,
        staleTime: 30000,
        gcTime: 60000,
        refetchOnWindowFocus: false,
        retry: 2, // Limite le nombre de retry
        retryDelay: 1000, // Délai entre les retry
    })

    // Query pour récupérer les ordres actifs d'un marketplace
    const getOrdersQuery = (marketplacePda: PublicKey | null) => useQuery({
        queryKey: ['yieldos', 'orders', marketplacePda?.toString(), { cluster: cluster.name }],
        queryFn: async (): Promise<TradeOrderData[]> => {
            if (!connection || !marketplacePda) throw new Error('Connection or marketplace not available')

            try {
                const accounts = await connection.getProgramAccounts(YIELDOS_PROGRAM_ID, {
                    filters: [
                        {
                            memcmp: {
                                offset: 40, // marketplace field offset in TradeOrder
                                bytes: marketplacePda.toBase58(),
                            }
                        }
                    ]
                })

                const orders: TradeOrderData[] = []

                for (const account of accounts) {
                    try {
                        const data = account.account.data
                        let offset = 8 // Skip discriminator

                        // Parse order data
                        const user = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32
                        const marketplace = new PublicKey(data.subarray(offset, offset + 32))
                        offset += 32
                        const orderType = data.readUInt8(offset)
                        offset += 1
                        const yieldTokenAmount = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const pricePerToken = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const totalValue = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const filledAmount = Number(data.readBigUInt64LE(offset))
                        offset += 8
                        const isActive = data.readUInt8(offset) === 1
                        offset += 1
                        const createdAt = Number(data.readBigInt64LE(offset))
                        offset += 8
                        const orderId = Number(data.readBigUInt64LE(offset))

                        // Only include active orders
                        if (isActive && filledAmount < yieldTokenAmount) {
                            orders.push({
                                user,
                                marketplace,
                                orderType,
                                yieldTokenAmount,
                                pricePerToken,
                                totalValue,
                                filledAmount,
                                isActive,
                                createdAt,
                                orderId
                            })
                        }
                    } catch (parseError) {
                        console.warn('Error parsing order account:', parseError)
                    }
                }

                return orders.sort((a, b) => {
                    // Sort sell orders by price (ascending), buy orders by price (descending)
                    if (a.orderType !== b.orderType) {
                        return a.orderType - b.orderType // Sell orders first
                    }
                    return a.orderType === 1 ? a.pricePerToken - b.pricePerToken : b.pricePerToken - a.pricePerToken
                })
            } catch (error) {
                console.error('Error fetching orders:', error)
                return []
            }
        },
        enabled: !!connection && !!marketplacePda,
        staleTime: 15000,
        gcTime: 60000,
        refetchOnWindowFocus: false,
        retry: 2, // Limite le nombre de retry
        retryDelay: 1000, // Délai entre les retry
    })

    // Mutation pour créer un marketplace
    const createMarketplaceMutation = useMutation({
        mutationFn: async ({ strategyId, tradingFeeBps }: { strategyId: number, tradingFeeBps: number }) => {
            if (!program || !wallet.publicKey) {
                throw new Error('Program or wallet not connected')
            }

            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const [marketplacePda] = getPDAs.getMarketplacePda(strategyPda)
            const [marketplaceCounterPda] = getPDAs.getMarketplaceCounterPda()
            const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(strategyId)

            // Check if marketplace already exists
            const existingMarketplace = await connection.getAccountInfo(marketplacePda)
            if (existingMarketplace) {
                throw new Error(`Marketplace already exists for strategy ${strategyId}`)
            }

            // Get strategy to find underlying token
            const strategyAccount = await connection.getAccountInfo(strategyPda)
            if (!strategyAccount) throw new Error('Strategy not found')

            const underlyingToken = new PublicKey(strategyAccount.data.subarray(40, 72))

            // Get marketplace counter to determine ID
            let marketplaceId = 1
            try {
                const counterAccount = await connection.getAccountInfo(marketplaceCounterPda)
                if (counterAccount) {
                    marketplaceId = Number(counterAccount.data.readBigUInt64LE(8)) + 1
                }
            } catch (error) {
                console.log('Marketplace counter not found, using ID 1')
            }

            const transaction = await program.methods
                .createMarketplace(new anchor.BN(strategyId), new anchor.BN(marketplaceId), tradingFeeBps)
                .accounts({
                    admin: wallet.publicKey,
                    strategy: strategyPda,
                    marketplace: marketplacePda,
                    marketplaceCounter: marketplaceCounterPda,
                    yieldTokenMint: yieldTokenMintPda,
                    underlyingTokenMint: underlyingToken,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .transaction()

            if (!program.provider) {
                throw new Error('Program provider not available')
            }
            const provider = program.provider as anchor.AnchorProvider
            return await provider.sendAndConfirm(transaction)
        },
        onSuccess: (signature) => {
            if (transactionToast) {
                transactionToast(signature)
            }
            // Refetch will be handled by React Query cache invalidation
        },
        onError: (error) => {
            console.error('Error creating marketplace:', error)
            throw error
        }
    })

    // Mutation pour placer un ordre
    const placeOrderMutation = useMutation({
        mutationFn: async ({
            marketplacePda,
            strategyId,
            orderType,
            yieldTokenAmount,
            pricePerToken
        }: {
            marketplacePda: PublicKey,
            strategyId: number,
            orderType: number,
            yieldTokenAmount: number,
            pricePerToken: number
        }) => {
            if (!program || !wallet.publicKey) {
                throw new Error('Program or wallet not connected')
            }

            // Get order counter to determine ID
            const [orderCounterPda] = getPDAs.getOrderCounterPda()
            let orderId = 1
            try {
                const counterAccount = await connection.getAccountInfo(orderCounterPda)
                if (counterAccount) {
                    orderId = Number(counterAccount.data.readBigUInt64LE(8)) + 1
                }
            } catch (error) {
                console.log('Order counter not found, using ID 1')
            }

            const [orderPda] = getPDAs.getOrderPda(wallet.publicKey, orderId)
            const [escrowPda] = getPDAs.getEscrowPda(orderPda)

            // Calculer les PDAs pour les token mints
            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const [yieldTokenMint] = getPDAs.getYieldTokenMintPda(strategyId)

            // Récupérer l'underlying token depuis la stratégie
            let underlyingTokenMint: PublicKey
            try {
                const strategyAccount = await connection.getAccountInfo(strategyPda)
                if (!strategyAccount) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }
                // L'underlying token est à l'offset 40 (discriminator 8 + admin 32)
                const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                underlyingTokenMint = new PublicKey(underlyingTokenBytes)
            } catch (parseError) {
                console.warn('Failed to parse underlying token, using WSOL:', parseError)
                underlyingTokenMint = new PublicKey('So11111111111111111111111111111111111111112')
            }

            // Get user token accounts
            const userYieldTokenAccount = await getAssociatedTokenAddress(yieldTokenMint, wallet.publicKey)
            const userUnderlyingTokenAccount = await getAssociatedTokenAddress(underlyingTokenMint, wallet.publicKey)

            const transaction = await program.methods
                .placeOrder(new anchor.BN(orderId), orderType, new anchor.BN(yieldTokenAmount), new anchor.BN(pricePerToken))
                .accounts({
                    user: wallet.publicKey,
                    marketplace: marketplacePda,
                    order: orderPda,
                    orderCounter: orderCounterPda,
                    yieldTokenMint,
                    underlyingTokenMint,
                    userYieldTokenAccount,
                    userUnderlyingTokenAccount,
                    escrowAccount: escrowPda,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .transaction()

            if (!program.provider) {
                throw new Error('Program provider not available')
            }
            const provider = program.provider as anchor.AnchorProvider
            return await provider.sendAndConfirm(transaction)
        },
        onSuccess: (signature) => {
            if (transactionToast) {
                transactionToast(signature)
            }
        },
        onError: (error) => {
            console.error('Error placing order:', error)
            throw error
        }
    })

    // Mutation pour annuler un ordre
    const cancelOrderMutation = useMutation({
        mutationFn: async ({ orderId, marketplacePda, strategyId }: { orderId: number, marketplacePda: PublicKey, strategyId: number }) => {
            if (!program || !wallet.publicKey) {
                throw new Error('Program or wallet not connected')
            }

            const [orderPda] = getPDAs.getOrderPda(wallet.publicKey, orderId)
            const [escrowPda] = getPDAs.getEscrowPda(orderPda)

            // Get order data to determine token account
            const orderAccount = await connection.getAccountInfo(orderPda)
            if (!orderAccount) throw new Error('Order not found')

            // Parse order type to determine which token account to use
            const orderType = orderAccount.data.readUInt8(72) // orderType field offset

            // Calculer les PDAs pour les token mints
            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const [yieldTokenMint] = getPDAs.getYieldTokenMintPda(strategyId)

            // Récupérer l'underlying token depuis la stratégie
            let underlyingTokenMint: PublicKey
            try {
                const strategyAccount = await connection.getAccountInfo(strategyPda)
                if (!strategyAccount) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }
                // L'underlying token est à l'offset 40 (discriminator 8 + admin 32)
                const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                underlyingTokenMint = new PublicKey(underlyingTokenBytes)
            } catch (parseError) {
                console.warn('Failed to parse underlying token, using WSOL:', parseError)
                underlyingTokenMint = new PublicKey('So11111111111111111111111111111111111111112')
            }

            // Determine user token account based on order type
            const tokenMint = orderType === 1 ? yieldTokenMint : underlyingTokenMint // 1 = sell order
            const userTokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey)

            const transaction = await program.methods
                .cancelOrder(new anchor.BN(orderId))
                .accounts({
                    user: wallet.publicKey,
                    marketplace: marketplacePda,
                    order: orderPda,
                    escrowAccount: escrowPda,
                    userTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction()

            if (!program.provider) {
                throw new Error('Program provider not available')
            }
            const provider = program.provider as anchor.AnchorProvider
            return await provider.sendAndConfirm(transaction)
        },
        onSuccess: (signature) => {
            if (transactionToast) {
                transactionToast(signature)
            }
        },
        onError: (error) => {
            console.error('Error canceling order:', error)
            throw error
        }
    })

    // Mutation pour exécuter un trade entre deux ordres
    const executeTradesMutation = useMutation({
        mutationFn: async ({
            buyOrderPda,
            sellOrderPda,
            tradeAmount,
            marketplacePda,
            strategyId
        }: {
            buyOrderPda: PublicKey,
            sellOrderPda: PublicKey,
            tradeAmount: number,
            marketplacePda: PublicKey,
            strategyId: number
        }) => {
            if (!program || !wallet.publicKey) {
                throw new Error('Program or wallet not connected')
            }

            // Get escrow PDAs
            const [buyOrderEscrowPda] = getPDAs.getEscrowPda(buyOrderPda)
            const [sellOrderEscrowPda] = getPDAs.getEscrowPda(sellOrderPda)

            // Calculer les PDAs pour les token mints
            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            const [yieldTokenMint] = getPDAs.getYieldTokenMintPda(strategyId)

            // Récupérer l'underlying token depuis la stratégie
            let underlyingTokenMint: PublicKey
            try {
                const strategyAccount = await connection.getAccountInfo(strategyPda)
                if (!strategyAccount) {
                    throw new Error(`Strategy ${strategyId} not found`)
                }
                // L'underlying token est à l'offset 40 (discriminator 8 + admin 32)
                const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                underlyingTokenMint = new PublicKey(underlyingTokenBytes)
            } catch (parseError) {
                console.warn('Failed to parse underlying token, using WSOL:', parseError)
                underlyingTokenMint = new PublicKey('So11111111111111111111111111111111111111112')
            }

            // Get order data to find users
            const buyOrderAccount = await connection.getAccountInfo(buyOrderPda)
            const sellOrderAccount = await connection.getAccountInfo(sellOrderPda)
            if (!buyOrderAccount || !sellOrderAccount) throw new Error('Orders not found')

            const buyerPubkey = new PublicKey(buyOrderAccount.data.subarray(8, 40))
            const sellerPubkey = new PublicKey(sellOrderAccount.data.subarray(8, 40))

            // Get user token accounts
            const buyerYieldTokenAccount = await getAssociatedTokenAddress(yieldTokenMint, buyerPubkey)
            const buyerUnderlyingTokenAccount = await getAssociatedTokenAddress(underlyingTokenMint, buyerPubkey)
            const sellerUnderlyingTokenAccount = await getAssociatedTokenAddress(underlyingTokenMint, sellerPubkey)

            // Fee collection account (marketplace admin)
            // Récupérer l'admin depuis les données du marketplace
            const marketplaceAccount = await connection.getAccountInfo(marketplacePda)
            if (!marketplaceAccount) throw new Error('Marketplace not found')
            const marketplaceAdmin = new PublicKey(marketplaceAccount.data.subarray(8, 40))
            const feeCollectionAccount = await getAssociatedTokenAddress(underlyingTokenMint, marketplaceAdmin)

            const transaction = await program.methods
                .executeTrade(new anchor.BN(tradeAmount))
                .accounts({
                    executor: wallet.publicKey,
                    marketplace: marketplacePda,
                    buyOrder: buyOrderPda,
                    sellOrder: sellOrderPda,
                    buyOrderEscrow: buyOrderEscrowPda,
                    sellOrderEscrow: sellOrderEscrowPda,
                    buyerYieldTokenAccount,
                    buyerUnderlyingTokenAccount,
                    sellerUnderlyingTokenAccount,
                    feeCollectionAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction()

            if (!program.provider) {
                throw new Error('Program provider not available')
            }
            const provider = program.provider as anchor.AnchorProvider
            return await provider.sendAndConfirm(transaction)
        },
        onSuccess: (signature) => {
            if (transactionToast) {
                transactionToast(signature)
            }
        },
        onError: (error) => {
            console.error('Error executing trade:', error)
            throw error
        }
    })

    // Fonction utilitaire pour récupérer un marketplace spécifique
    const getMarketplaceByStrategy = async (strategyId: number) => {
        if (!connection) throw new Error('Connection not available')

        try {
            console.log(`\n=== DIRECT MARKETPLACE LOOKUP for strategy ${strategyId} ===`)

            // Calculer la PDA de la stratégie
            const [strategyPda] = getPDAs.getStrategyPda(strategyId)
            console.log('Strategy PDA:', strategyPda.toString())

            // Calculer la PDA du marketplace
            const [marketplacePda] = getPDAs.getMarketplacePda(strategyPda)
            console.log('Expected marketplace PDA:', marketplacePda.toString())

            // Récupérer directement le compte marketplace
            const marketplaceAccount = await connection.getAccountInfo(marketplacePda)

            if (!marketplaceAccount) {
                console.log('❌ No marketplace account found at this PDA')
                return null
            }

            console.log('✅ Found marketplace account:', {
                pubkey: marketplacePda.toString(),
                dataLength: marketplaceAccount.data.length,
                owner: marketplaceAccount.owner.toString()
            })

            // Parser les données du marketplace
            const data = marketplaceAccount.data
            let offset = 8 // Skip discriminator

            const admin = new PublicKey(data.subarray(offset, offset + 32))
            offset += 32
            const strategy = new PublicKey(data.subarray(offset, offset + 32))
            offset += 32
            const yieldTokenMint = new PublicKey(data.subarray(offset, offset + 32))
            offset += 32
            const underlyingTokenMint = new PublicKey(data.subarray(offset, offset + 32))
            offset += 32
            const totalVolume = Number(data.readBigUInt64LE(offset))
            offset += 8
            const totalTrades = Number(data.readBigUInt64LE(offset))
            offset += 8
            const bestBidPrice = Number(data.readBigUInt64LE(offset))
            offset += 8
            const bestAskPrice = Number(data.readBigUInt64LE(offset))
            offset += 8
            const tradingFeeBps = data.readUInt16LE(offset)
            offset += 2
            const isActive = data.readUInt8(offset) === 1
            offset += 1
            const createdAt = Number(data.readBigInt64LE(offset))
            offset += 8
            const marketplaceId = Number(data.readBigUInt64LE(offset))

            const marketplaceData = {
                admin,
                strategy,
                yieldTokenMint,
                underlyingTokenMint,
                totalVolume,
                totalTrades,
                bestBidPrice,
                bestAskPrice,
                tradingFeeBps,
                isActive,
                createdAt,
                marketplaceId
            }

            console.log('✅ Successfully parsed direct marketplace:', {
                strategy: strategy.toString(),
                marketplaceId,
                isActive,
                tradingFeeBps
            })

            console.log('=== END DIRECT MARKETPLACE LOOKUP ===\n')

            return marketplaceData
        } catch (error) {
            console.error('Error in direct marketplace lookup:', error)
            return null
        }
    }

    return {
        marketplacesQuery,
        getOrdersQuery,
        createMarketplaceMutation,
        placeOrderMutation,
        cancelOrderMutation,
        executeTradesMutation,
        getMarketplaceByStrategy,
        getPDAs
    }
} 
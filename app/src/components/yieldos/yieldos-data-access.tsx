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

                    if (solBalance < requiredLamports + rentExemptAmount + 5000) { // 5000 lamports pour les frais de tx
                        throw new Error(`Insufficient SOL balance. You need ${(requiredLamports + rentExemptAmount) / 1e9} SOL but only have ${solBalance / 1e9} SOL`)
                    }

                    // Ajouter l'instruction pour convertir SOL → WSOL si le compte a été créé
                    if (!userTokenAccountInfo) {
                        // Transférer SOL vers le compte WSOL
                        setupInstructions.push(
                            SystemProgram.transfer({
                                fromPubkey: wallet.publicKey,
                                toPubkey: userUnderlyingToken,
                                lamports: amount,
                            })
                        )

                        // Synchroniser le compte WSOL
                        setupInstructions.push(
                            createSyncNativeInstruction(userUnderlyingToken)
                        )
                    } else {
                        // Le compte existe, vérifier son solde
                        const tokenBalance = await connection.getTokenAccountBalance(userUnderlyingToken)
                        const currentBalance = tokenBalance.value.uiAmount || 0

                        if (currentBalance * 1e9 < amount) {
                            throw new Error(`Insufficient WSOL balance. You need ${amount / 1e9} WSOL but only have ${currentBalance} WSOL. You can wrap more SOL or use native SOL.`)
                        }
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

    return {
        strategyQuery,
        depositMutation,
        withdrawMutation,
        getTokenRequirements
    }
} 
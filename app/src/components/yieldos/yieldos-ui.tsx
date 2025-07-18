'use client'

import { useMemo, useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useYieldosProgram, useYieldosStrategy } from './yieldos-data-access'
import { useProtocolStats, useUserPortfolioAnalytics } from './yieldos-analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

// Composant pour afficher une liste de stratégies
export function StrategiesList() {
    const { strategiesQuery } = useYieldosProgram()
    const wallet = useWallet()

    if (!wallet.connected) {
        return (
            <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
                        <span>🎯</span>
                        <span>Strategies</span>
                    </CardTitle>
                    <CardDescription className="text-amber-600 dark:text-amber-400">
                        Connect your wallet to view available strategies
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button disabled className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        🔌 Connect Wallet
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (strategiesQuery.isLoading) {
        return (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                        <span>🔄</span>
                        <span>Loading Strategies</span>
                    </CardTitle>
                    <CardDescription className="text-blue-600 dark:text-blue-400">
                        Fetching the latest yield strategies from the blockchain...
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-xl"></div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (strategiesQuery.error) {
        return (
            <Card className="border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-red-700 dark:text-red-300">
                        <span>⚠️</span>
                        <span>Error Loading Strategies</span>
                    </CardTitle>
                    <CardDescription className="text-red-600 dark:text-red-400">
                        Failed to load strategies from the blockchain
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-red-600 dark:text-red-400">
                            {strategiesQuery.error instanceof Error ? strategiesQuery.error.message : 'Unknown error occurred'}
                        </p>
                        <Button
                            onClick={() => strategiesQuery.refetch()}
                            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white"
                        >
                            🔄 Retry Loading
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const strategies = strategiesQuery.data || []

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                        <span>🚀</span>
                        <span>Available Strategies</span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-xs font-medium rounded-full">
                            {strategies.length} Active
                        </span>
                    </CardTitle>
                    <CardDescription className="text-green-600 dark:text-green-400">
                        Click on any strategy to view details and start earning yield on your tokens
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {strategies.length === 0 ? (
                        <div className="text-center py-12 space-y-4">
                            <div className="text-6xl">📭</div>
                            <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">No Strategies Available</h3>
                            <p className="text-green-600 dark:text-green-400">
                                No strategies have been created yet.
                                {wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt' && (
                                    <span className="block mt-2 font-medium">As an admin, you can create the first strategy above! 🎯</span>
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {strategies.map((strategy) => (
                                <StrategyCard
                                    key={strategy.pubkey.toString()}
                                    strategyId={strategy.strategyId}
                                    strategyData={strategy}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// Composant pour afficher une stratégie individuelle
export function StrategyCard({ strategyId, strategyData }: {
    strategyId: number,
    strategyData?: { pubkey: PublicKey, account: any, strategyId: number }
}) {
    const wallet = useWallet()
    const { strategyQuery, depositMutation, withdrawMutation, getTokenRequirements, getUserYieldTokenBalance, getUserPosition } = useYieldosStrategy({ strategyId })
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [tokenInfo, setTokenInfo] = useState<any>(null)
    const [yieldTokenBalance, setYieldTokenBalance] = useState<number>(0)
    const [userPosition, setUserPosition] = useState<any>(null)

    // Charger les informations sur les tokens requis (avec debouncing pour éviter le rate limiting)
    useEffect(() => {
        if (!wallet.connected || !getTokenRequirements || !getUserYieldTokenBalance || !getUserPosition) return

        // Debounce pour éviter trop de requêtes
        const timeoutId = setTimeout(async () => {
            try {
                const [info, balance, position] = await Promise.all([
                    getTokenRequirements(),
                    getUserYieldTokenBalance(),
                    getUserPosition()
                ])
                setTokenInfo(info)
                setYieldTokenBalance(balance)
                setUserPosition(position)
            } catch (error) {
                console.warn('Failed to load token info:', error)
            }
        }, 1500) // Attendre 1.5 secondes pour étaler les requêtes

        return () => clearTimeout(timeoutId)
    }, [wallet.connected, strategyId]) // Retirer getTokenRequirements des dépendances

    // Parser les vraies données du contrat
    const strategyInfo = useMemo(() => {
        // D'abord essayer d'utiliser les données décodées par Anchor
        if (strategyQuery.data?.decodedData) {
            const decoded = strategyQuery.data.decodedData
            console.log('Using Anchor-decoded data:', decoded)

            return {
                name: decoded.name || `Strategy #${strategyId}`,
                apy: Number(decoded.apy || 0),
                totalLocked: Number(decoded.totalDeposits || 0),
                isActive: decoded.isActive || false,
                strategyId: Number(decoded.strategyId || strategyId)
            }
        }

        // Sinon faire le parsing manuel si on a les données brutes
        if (strategyData?.account?.data) {
            try {
                const data = strategyData.account.data

                // Structure selon l'IDL Strategy:
                // Discriminator (8 bytes) + admin (32) + underlying_token (32) + yield_token_mint (32) + name (4 + length) + apy (8) + total_deposits (8) + is_active (1) + created_at (8) + total_yield_tokens_minted (8) + strategy_id (8)

                let offset = 8 // Skip discriminator

                // Skip admin (32 bytes)
                offset += 32

                // Skip underlying_token (32 bytes)  
                offset += 32

                // Skip yield_token_mint (32 bytes)
                offset += 32

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
                const parsedStrategyId = strategyIdHigh * 0x100000000 + strategyIdLow

                console.log('Manual parsed strategy data:', {
                    name,
                    apy,
                    totalDeposits,
                    isActive,
                    strategyId: parsedStrategyId
                })

                return {
                    name: name || `Strategy #${strategyId}`,
                    apy: apy,
                    totalLocked: totalDeposits,
                    isActive: isActive,
                    strategyId: parsedStrategyId
                }
            } catch (error) {
                console.error('Error parsing strategy data:', error)
                console.log('Raw data length:', strategyData.account.data.length)
                console.log('Raw data (first 100 bytes):', Array.from(strategyData.account.data.slice(0, 100)))
            }
        }
        return null
    }, [strategyQuery.data, strategyData, strategyId])

    if (!strategyData && strategyQuery.isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Strategy #{strategyId}</CardTitle>
                    <CardDescription>Loading...</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (!strategyData && strategyQuery.error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Strategy #{strategyId}</CardTitle>
                    <CardDescription>Error loading strategy</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const handleDeposit = async () => {
        if (!depositAmount) return
        try {
            // Recharger les infos token juste avant le deposit pour être sûr
            let currentTokenInfo = tokenInfo
            if (!currentTokenInfo && getTokenRequirements) {
                currentTokenInfo = await getTokenRequirements()
                setTokenInfo(currentTokenInfo)
            }

            // Convertir en lamports si c'est WSOL (SOL natif)
            // Par défaut, assumer que c'est WSOL si on n'arrive pas à détecter
            const isWSol = currentTokenInfo?.isWSol ?? true // Default to WSOL for SOL deposits
            const amount = isWSol
                ? Math.floor(Number(depositAmount) * 1e9) // Convertir SOL en lamports
                : Number(depositAmount)

            console.log('StrategyCard Deposit debug:', {
                depositAmount,
                'Number(depositAmount)': Number(depositAmount),
                'isWSol': isWSol,
                'calculated amount': amount,
                'tokenInfo': currentTokenInfo
            })

            if (amount <= 0) {
                throw new Error(`Invalid amount calculated: ${amount}. Please enter a positive number.`)
            }

            await depositMutation.mutateAsync({ amount })
            setDepositAmount('')

            // Recharger les informations sur les tokens après le deposit
            if (getTokenRequirements) {
                const info = await getTokenRequirements()
                setTokenInfo(info)
            }
        } catch (error) {
            console.error('Deposit failed:', error)
        }
    }

    const handleWithdraw = async () => {
        if (!withdrawAmount) return
        try {
            await withdrawMutation.mutateAsync({ amount: Number(withdrawAmount) })
            setWithdrawAmount('')

            // Recharger les données après le withdraw
            if (getUserYieldTokenBalance && getUserPosition) {
                const [balance, position] = await Promise.all([
                    getUserYieldTokenBalance(),
                    getUserPosition()
                ])
                setYieldTokenBalance(balance)
                setUserPosition(position)
            }
        } catch (error) {
            console.error('Withdraw failed:', error)
        }
    }

    const handleWithdrawAll = async () => {
        try {
            // Récupérer la position utilisateur la plus récente
            const currentPosition = await getUserPosition()

            if (!currentPosition || currentPosition.deposited_amount <= 0) {
                alert('No deposited tokens to withdraw from this strategy.')
                return
            }

            console.log('Withdrawing all deposited tokens:', {
                deposited_amount: currentPosition.deposited_amount,
                yield_tokens_minted: currentPosition.yield_tokens_minted
            })

            await withdrawMutation.mutateAsync({ amount: currentPosition.deposited_amount })
            setWithdrawAmount('')
            setUserPosition(null)
        } catch (error) {
            console.error('Withdraw all failed:', error)
        }
    }

    const displayInfo = strategyInfo || {
        name: `Strategy #${strategyId}`,
        apy: 1200,
        totalLocked: 0
    }

    return (
        <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-700">
            <CardHeader className="cursor-pointer" onClick={() => window.location.href = `/strategies/${strategyId}`}>
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-md">
                        {strategyId}
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {displayInfo.name}
                        </CardTitle>
                        <CardDescription>
                            {strategyData ? 'Live on Solana blockchain' : 'High-yield strategy for earning passive income'}
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        {strategyInfo?.isActive ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        ) : (
                            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        )}
                        <span className="text-xs text-gray-500">
                            {strategyInfo?.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Métriques colorées */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-sm text-green-600 dark:text-green-400 font-medium">APY</div>
                        <div className="text-xl font-bold text-green-700 dark:text-green-300">
                            {(displayInfo.apy / 100).toFixed(2)}%
                        </div>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">TVL</div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {(displayInfo.totalLocked / 1e9).toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* Position et Status */}
                <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm font-medium">Your Position:</span>
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            {userPosition?.deposited_amount ? (userPosition.deposited_amount / 1e9).toFixed(4) + ' SOL' : '0.00 SOL'}
                        </span>
                    </div>
                    {strategyData && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm font-medium">Strategy ID:</span>
                            <span className="text-sm font-mono">#{strategyInfo?.strategyId || strategyId}</span>
                        </div>
                    )}
                </div>

                {/* Affichage des soldes */}
                {(userPosition?.deposited_amount > 0 || yieldTokenBalance > 0) && (
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        {userPosition?.deposited_amount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-purple-600 dark:text-purple-400">💰 Deposited:</span>
                                <span className="font-semibold text-purple-700 dark:text-purple-300">
                                    {(userPosition.deposited_amount / 1e9).toFixed(4)} SOL
                                </span>
                            </div>
                        )}
                        {yieldTokenBalance > 0 && (
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-purple-600 dark:text-purple-400">🎯 Yield tokens:</span>
                                <span className="font-semibold text-purple-700 dark:text-purple-300">
                                    {(yieldTokenBalance / 1e9).toFixed(4)} YLD
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Deposit Section */}
                <div className="space-y-2 p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                    <Label htmlFor={`deposit-${strategyId}`} className="text-sm font-medium text-green-700 dark:text-green-300">
                        💰 Deposit Amount (SOL)
                    </Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`deposit-${strategyId}`}
                            type="number"
                            placeholder="0.0"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="border-green-200 dark:border-green-800"
                            step="0.001"
                        />
                        <Button
                            onClick={handleDeposit}
                            disabled={!depositAmount || depositMutation.isPending}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                        >
                            {depositMutation.isPending ? '🔄' : '💰'}
                        </Button>
                    </div>
                </div>

                {/* Withdraw Section */}
                <div className="space-y-2 p-3 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <Label htmlFor={`withdraw-${strategyId}`} className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        💸 Withdraw Amount (SOL)
                    </Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`withdraw-${strategyId}`}
                            type="number"
                            placeholder="0.0"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="border-orange-200 dark:border-orange-800"
                        />
                        <Button
                            onClick={handleWithdraw}
                            variant="outline"
                            disabled={!withdrawAmount || withdrawMutation.isPending}
                            className="border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                        >
                            {withdrawMutation.isPending ? '🔄' : '💸'}
                        </Button>
                    </div>

                    <Button
                        onClick={handleWithdrawAll}
                        variant="destructive"
                        size="sm"
                        disabled={!userPosition || userPosition.deposited_amount <= 0 || withdrawMutation.isPending}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                        {withdrawMutation.isPending ? '🔄 Processing...' :
                            userPosition && userPosition.deposited_amount > 0 ?
                                `💸 Withdraw All (${(userPosition.deposited_amount / 1e9).toFixed(4)} SOL)` :
                                'No position to withdraw'
                        }
                    </Button>
                </div>

                {/* View Details Button */}
                <Button
                    onClick={() => window.location.href = `/strategies/${strategyId}`}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                >
                    📊 View Full Details →
                </Button>
            </CardContent>
        </Card>
    )
}

// Composant pour afficher le portfolio utilisateur
export function UserPortfolio() {
    const { portfolio, positions, isLoading, error } = useUserPortfolioAnalytics()
    const wallet = useWallet()

    if (!wallet.connected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Your Portfolio</CardTitle>
                    <CardDescription>Connect your wallet to view your positions</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Your Portfolio</CardTitle>
                    <CardDescription>Loading your positions...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <p className="text-muted-foreground">Analyzing your on-chain positions...</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Your Portfolio</CardTitle>
                    <CardDescription>Error loading portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-red-500">
                        {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Portfolio</CardTitle>
                <CardDescription>
                    Overview of your yield farming positions
                    {portfolio.totalValue > 0 && (
                        <span className="ml-2 text-green-600">
                            • ${portfolio.totalValue.toFixed(2)} total value
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {positions.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-muted-foreground mb-2">No positions found.</p>
                        <p className="text-sm text-muted-foreground">
                            Start by depositing into a strategy to begin earning yield!
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Strategy</TableHead>
                                <TableHead>Deposited</TableHead>
                                <TableHead>Yield Tokens</TableHead>
                                <TableHead>Est. Annual Yield</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map((position) => (
                                <TableRow key={position.strategyId}>
                                    <TableCell className="font-medium">{position.strategyName}</TableCell>
                                    <TableCell>{position.tokensDeposited.toFixed(2)} tokens</TableCell>
                                    <TableCell>{position.yieldTokensOwned.toFixed(2)} YLD</TableCell>
                                    <TableCell className="text-green-600">
                                        +{position.estimatedAnnualYield.toFixed(2)} tokens/year
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {portfolio.totalValue > 0 && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">Portfolio Summary</h4>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span>Total Deposited:</span>
                                <span className="font-medium">{portfolio.totalValue.toFixed(2)} tokens</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total Yield Tokens:</span>
                                <span className="font-medium">{portfolio.totalYieldTokens.toFixed(2)} YLD</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Est. Annual Income:</span>
                                <span className="font-medium text-green-600">
                                    +{portfolio.estimatedAnnualIncome.toFixed(2)} tokens
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Average APY:</span>
                                <span className="font-medium text-green-600">
                                    {portfolio.averageAPY.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// Composant pour le marketplace de yield tokens
export function YieldTokenMarketplace() {
    const wallet = useWallet()

    if (!wallet.connected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Yield Token Marketplace</CardTitle>
                    <CardDescription>Connect your wallet to trade yield tokens</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Yield Token Marketplace</CardTitle>
                <CardDescription>Trade your yield tokens with other users</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Marketplace coming soon!</p>
                    <p className="text-sm text-muted-foreground">
                        Trade your yield tokens, place orders, and discover new opportunities.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

// Composant pour les statistiques générales
export function ProtocolStats() {
    const { stats, isLoading, error } = useProtocolStats()

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">---</div>
                            <p className="text-xs text-muted-foreground">Loading data...</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <p className="text-red-500">Error loading protocol stats</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalValueLocked.toLocaleString()} tokens</div>
                    <p className="text-xs text-muted-foreground">
                        Status: {stats.protocolStatus}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalStrategies}</div>
                    <p className="text-xs text-muted-foreground">Live on devnet</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Estimated Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">Protocol participants</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Network</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Solana</div>
                    <p className="text-xs text-muted-foreground">Devnet</p>
                </CardContent>
            </Card>
        </div>
    )
} 
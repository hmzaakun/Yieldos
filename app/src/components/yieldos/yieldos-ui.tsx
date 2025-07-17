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

// Composant pour afficher une liste de stratégies
export function StrategiesList() {
    const { strategiesQuery } = useYieldosProgram()
    const wallet = useWallet()

    if (!wallet.connected) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Strategies</CardTitle>
                    <CardDescription>Connect your wallet to view available strategies</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button disabled>Connect Wallet</Button>
                </CardContent>
            </Card>
        )
    }

    if (strategiesQuery.isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Strategies</CardTitle>
                    <CardDescription>Loading strategies...</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (strategiesQuery.error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Strategies</CardTitle>
                    <CardDescription>Error loading strategies</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-red-500">
                        {strategiesQuery.error instanceof Error ? strategiesQuery.error.message : 'Unknown error'}
                    </p>
                </CardContent>
            </Card>
        )
    }

    const strategies = strategiesQuery.data || []

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Available Strategies</CardTitle>
                    <CardDescription>Choose a strategy to start earning yield on your tokens</CardDescription>
                </CardHeader>
                <CardContent>
                    {strategies.length === 0 ? (
                        <p className="text-muted-foreground">
                            No strategies available yet.
                            {wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt' && (
                                <span> Create one using the form above!</span>
                            )}
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    const { strategyQuery, depositMutation, withdrawMutation, getTokenRequirements } = useYieldosStrategy({ strategyId })
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [tokenInfo, setTokenInfo] = useState<any>(null)

    // Charger les informations sur les tokens requis (avec debouncing pour éviter le rate limiting)
    useEffect(() => {
        if (!wallet.connected || !getTokenRequirements) return

        // Debounce pour éviter trop de requêtes
        const timeoutId = setTimeout(async () => {
            try {
                const info = await getTokenRequirements()
                setTokenInfo(info)
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
        } catch (error) {
            console.error('Withdraw failed:', error)
        }
    }

    const displayInfo = strategyInfo || {
        name: `Strategy #${strategyId}`,
        apy: 1200,
        totalLocked: 0
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{displayInfo.name}</CardTitle>
                <CardDescription>
                    {strategyData ? 'Active on-chain strategy' : 'High-yield strategy for earning passive income'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">APY:</span>
                        <span className="text-sm text-green-600">
                            {(displayInfo.apy / 100).toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Total Deposited:</span>
                        <span className="text-sm">{displayInfo.totalLocked.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <span className={`text-sm ${strategyInfo?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {strategyInfo?.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Your Position:</span>
                        <span className="text-sm">0.00 tokens</span>
                    </div>
                    {strategyData && (
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Strategy ID:</span>
                            <span className="text-sm font-mono">#{strategyInfo?.strategyId || strategyId}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`deposit-${strategyId}`}>Deposit Amount</Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`deposit-${strategyId}`}
                            type="number"
                            placeholder="0.0"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                        />
                        <Button
                            onClick={handleDeposit}
                            disabled={!depositAmount || depositMutation.isPending}
                        >
                            {depositMutation.isPending ? 'Depositing...' : 'Deposit'}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`withdraw-${strategyId}`}>Withdraw Amount</Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`withdraw-${strategyId}`}
                            type="number"
                            placeholder="0.0"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                        <Button
                            onClick={handleWithdraw}
                            variant="outline"
                            disabled={!withdrawAmount || withdrawMutation.isPending}
                        >
                            {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw'}
                        </Button>
                    </div>
                </div>
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
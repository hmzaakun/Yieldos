'use client'

import { useMemo } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useYieldosProgram, useYieldosStrategy } from './yieldos-data-access'
import { useProtocolStats, useUserPortfolioAnalytics } from './yieldos-analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

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
    const { strategyQuery, depositMutation, withdrawMutation } = useYieldosStrategy({ strategyId })
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')

    // Si on a strategyData, on peut essayer de parser les informations directement
    const strategyInfo = useMemo(() => {
        if (strategyData?.account?.data) {
            try {
                // Parser basique des données (structure simplifiée)
                const data = strategyData.account.data
                // Les données réelles nécessiteraient un parsing plus complexe selon la structure Rust
                return {
                    name: `Strategy #${strategyId}`,
                    apy: 1200, // 12% en basis points
                    totalLocked: 1000
                }
            } catch (error) {
                console.warn('Error parsing strategy data:', error)
            }
        }
        return null
    }, [strategyData, strategyId])

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
            await depositMutation.mutateAsync({ amount: Number(depositAmount) })
            setDepositAmount('')
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
                        <span className="text-sm font-medium">Total Locked:</span>
                        <span className="text-sm">{displayInfo.totalLocked.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm font-medium">Your Position:</span>
                        <span className="text-sm">0.00 tokens</span>
                    </div>
                    {strategyData && (
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Strategy ID:</span>
                            <span className="text-sm font-mono">{strategyId}</span>
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
'use client'

import { AppHero } from '@/components/app-hero'
import { UserPortfolio } from './yieldos-ui'
import { useUserPortfolioAnalytics } from './yieldos-analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'

export function DashboardFeature() {
    const wallet = useWallet()
    const { portfolio, positions, isLoading } = useUserPortfolioAnalytics()

    // Mock recent transactions (cette partie sera connectée plus tard aux événements on-chain)
    const recentTransactions = [
        { id: 1, type: 'deposit', strategy: 'Strategy #1', amount: '1000.00', date: '2024-01-15', status: 'completed' },
        { id: 2, type: 'yield', strategy: 'Strategy #1', amount: '+12.34', date: '2024-01-14', status: 'completed' },
        { id: 3, type: 'trade', strategy: 'Marketplace', amount: '50.00', date: '2024-01-13', status: 'completed' },
    ]

    if (!wallet.connected) {
        return (
            <div className="space-y-8">
                <AppHero
                    title="Your Dashboard"
                    subtitle="Connect your wallet to view your portfolio and earnings"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                        <p className="text-muted-foreground mb-4">
                            Connect your wallet to access your yield farming dashboard
                        </p>
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <AppHero
                title="Your Dashboard"
                subtitle="Overview of your yield farming portfolio and earnings"
            />

            {/* Portfolio Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
                        <span className="text-2xl">💰</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${portfolio.totalValue.toFixed(2)}</div>
                        <p className="text-xs text-green-600">+{(portfolio.estimatedAnnualIncome / 365).toFixed(2)} daily est.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Yield Earned</CardTitle>
                        <span className="text-2xl">📈</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${portfolio.estimatedAnnualIncome.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Estimated annual income</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average APY</CardTitle>
                        <span className="text-2xl">🎯</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{portfolio.averageAPY.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Across all positions</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                        <span className="text-2xl">📊</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{positions.length}</div>
                        <p className="text-xs text-muted-foreground">Strategies joined</p>
                    </CardContent>
                </Card>
            </div>

            {/* Portfolio Breakdown */}
            <UserPortfolio />

            {/* Quick Actions */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Explore Strategies</CardTitle>
                        <CardDescription>Find new yield opportunities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/strategies">
                            <Button className="w-full">Browse Strategies</Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Trade Yield Tokens</CardTitle>
                        <CardDescription>Access the marketplace</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/marketplace">
                            <Button variant="outline" className="w-full">Open Marketplace</Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Claim Rewards</CardTitle>
                        <CardDescription>Collect your earnings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full" disabled>
                            No Rewards Available
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest transactions and yield earnings</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Strategy</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentTransactions.map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell>
                                        <span className={`capitalize px-2 py-1 rounded text-xs ${tx.type === 'deposit' ? 'bg-blue-100 text-blue-800' :
                                            tx.type === 'yield' ? 'bg-green-100 text-green-800' :
                                                'bg-purple-100 text-purple-800'
                                            }`}>
                                            {tx.type}
                                        </span>
                                    </TableCell>
                                    <TableCell>{tx.strategy}</TableCell>
                                    <TableCell className={tx.amount.startsWith('+') ? 'text-green-600' : ''}>
                                        {tx.amount}
                                    </TableCell>
                                    <TableCell>{tx.date}</TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                                            {tx.status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Performance Chart Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>Portfolio Performance</CardTitle>
                    <CardDescription>Track your earnings over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <p className="text-muted-foreground mb-2">Performance chart coming soon</p>
                        <p className="text-sm text-muted-foreground">
                            Visualize your yield earnings, APY changes, and portfolio growth
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 
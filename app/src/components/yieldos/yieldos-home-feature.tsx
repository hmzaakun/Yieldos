'use client'

import { AppHero } from '@/components/app-hero'
import { ProtocolStats } from './yieldos-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'
import { useMarketplace } from './yieldos-data-access'
import { useProtocolStats } from './yieldos-analytics'

export function YieldosHomePage() {
    const wallet = useWallet()
    const { marketplacesQuery } = useMarketplace()
    const { stats: protocolStats, isLoading: statsLoading } = useProtocolStats()

    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <AppHero
                title="Yieldos Protocol"
                subtitle="Earn yield on your tokens through decentralized strategies on Solana"
            />

            {/* Unified Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
                        <span className="text-2xl">💰</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : protocolStats.totalValueLocked?.toLocaleString() ?? '...'} tokens</div>
                        <p className="text-xs text-green-600">Status: {protocolStats.protocolStatus}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
                        <span className="text-2xl">📈</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statsLoading ? '...' : protocolStats.totalStrategies ?? '...'}</div>
                        <p className="text-xs text-purple-600">Live strategies</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Marketplaces</CardTitle>
                        <span className="text-2xl">🏪</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {marketplacesQuery.isLoading ? '...' : marketplacesQuery.data ? marketplacesQuery.data.length : 0}
                        </div>
                        <p className="text-xs text-blue-600">Active marketplaces</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 border-orange-200 dark:border-orange-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Network</CardTitle>
                        <span className="text-2xl">⚡</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Solana</div>
                        <p className="text-xs text-orange-600">Devnet</p>
                    </CardContent>
                </Card>
            </div>

            {/* Value Proposition Modern */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <span>🌱</span>
                            <span>High Yield Strategies</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            Access professionally managed yield farming strategies with APYs up to 15%+.
                            Our smart contracts automatically optimize returns while minimizing risk.
                        </CardDescription>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <span>🎯</span>
                            <span>Yield Tokens</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            Receive tradeable yield tokens representing your future earnings.
                            Trade, transfer, or hold them - the flexibility is yours.
                        </CardDescription>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <span>🔒</span>
                            <span>Secured by Smart Contracts</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            Enjoy fast transactions and low fees on the Solana blockchain.
                            Our protocol is optimized for speed and cost-efficiency.
                        </CardDescription>
                    </CardContent>
                </Card>
            </div>

            {/* Call to Action Modern */}
            <div className="text-center space-y-6 py-12">
                <h2 className="text-3xl font-bold">Ready to start earning?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Join users already earning passive income through Yieldos. Connect your wallet and start with any amount.
                </p>
                <div className="flex justify-center space-x-4">
                    {wallet.connected ? (
                        <>
                            <Link href="/strategies">
                                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">View Strategies</Button>
                            </Link>
                            <Link href="/dashboard">
                                <Button variant="outline" size="lg">My Portfolio</Button>
                            </Link>
                        </>
                    ) : (
                        <Button size="lg" disabled>
                            Connect Wallet to Get Started
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
} 
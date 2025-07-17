'use client'

import { AppHero } from '@/components/app-hero'
import { ProtocolStats, StrategiesList } from './yieldos-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'

export function YieldosHomePage() {
    const wallet = useWallet()

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <AppHero
                title="Yieldos Protocol"
                subtitle="Earn yield on your tokens through decentralized strategies on Solana"
            />

            {/* Protocol Stats */}
            <ProtocolStats />

            {/* Value Proposition */}
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
                            <span>⚡</span>
                            <span>Built on Solana</span>
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

            {/* Call to Action */}
            <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Ready to start earning?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Join thousands of users already earning passive income through Yieldos.
                    Connect your wallet and start with any amount.
                </p>

                <div className="flex justify-center space-x-4">
                    {wallet.connected ? (
                        <>
                            <Link href="/strategies">
                                <Button size="lg">View Strategies</Button>
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

            {/* Featured Strategies Preview */}
            <div className="space-y-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Featured Strategies</h2>
                    <p className="text-muted-foreground">
                        Get a preview of our top-performing yield strategies
                    </p>
                </div>

                {wallet.connected ? (
                    <StrategiesList />
                ) : (
                    <Card>
                        <CardContent className="text-center py-12">
                            <p className="text-muted-foreground mb-4">
                                Connect your wallet to view and interact with our yield strategies
                            </p>
                            <Button disabled>Connect Wallet</Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* How it Works */}
            <div className="space-y-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">How It Works</h2>
                    <p className="text-muted-foreground">Simple steps to start earning yield on your tokens</p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                        <CardHeader className="text-center">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">1</span>
                            </div>
                            <CardTitle>Choose Strategy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-center">
                                Browse our curated selection of yield strategies and choose one that fits your risk tolerance and goals.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="text-center">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">2</span>
                            </div>
                            <CardTitle>Deposit Tokens</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-center">
                                Deposit your tokens into the strategy. You&apos;ll receive yield tokens representing your future earnings.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="text-center">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">3</span>
                            </div>
                            <CardTitle>Earn & Trade</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-center">
                                Watch your yield accumulate automatically. Trade your yield tokens on our marketplace or redeem them for the underlying assets.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Footer CTA */}
            <div className="text-center py-8 border-t">
                <p className="text-sm text-muted-foreground">
                    Start earning passive income today with Yieldos Protocol
                </p>
            </div>
        </div>
    )
} 
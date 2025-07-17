'use client'

import { AppHero } from '@/components/app-hero'
import { StrategiesList } from './yieldos-ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export function StrategiesPageFeature() {
    const wallet = useWallet()
    const [newStrategyName, setNewStrategyName] = useState('')
    const [newStrategyApy, setNewStrategyApy] = useState('')

    // Check if user is admin (même logique que dans admin-feature)
    const isAdmin = wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt'

    const handleCreateStrategy = async () => {
        if (!newStrategyName || !newStrategyApy) return

        console.log('Creating strategy:', { name: newStrategyName, apy: newStrategyApy })
        // Logic for creating strategy will be implemented later
        setNewStrategyName('')
        setNewStrategyApy('')
    }

    return (
        <div className="space-y-8">
            <AppHero
                title="Yield Strategies"
                subtitle="Discover and join high-performance yield farming strategies"
            />

            {!wallet.connected ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                        <p className="text-muted-foreground mb-4">
                            Connect your wallet to view and interact with our yield strategies
                        </p>
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Create New Strategy (Admin Only) */}
                    {isAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Create New Strategy</CardTitle>
                                <CardDescription>
                                    Launch a new yield strategy (Admin only)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="strategy-name">Strategy Name</Label>
                                        <Input
                                            id="strategy-name"
                                            placeholder="e.g. High Yield USDC"
                                            value={newStrategyName}
                                            onChange={(e) => setNewStrategyName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="strategy-apy">APY (basis points)</Label>
                                        <Input
                                            id="strategy-apy"
                                            type="number"
                                            placeholder="e.g. 1200 (12%)"
                                            value={newStrategyApy}
                                            onChange={(e) => setNewStrategyApy(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleCreateStrategy}
                                    disabled={!newStrategyName || !newStrategyApy}
                                >
                                    Create Strategy
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Strategies List */}
                    <StrategiesList />
                </>
            )}
        </div>
    )
} 
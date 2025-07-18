'use client'

import { AppHero } from '@/components/app-hero'
import { StrategiesList } from './yieldos-ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useYieldosProgram } from './yieldos-data-access'
import { toast } from 'sonner'

export function StrategiesPageFeature() {
    const wallet = useWallet()
    const { createStrategyMutation } = useYieldosProgram()
    const [newStrategyName, setNewStrategyName] = useState('')
    const [newStrategyApy, setNewStrategyApy] = useState('')

    // Check if user is admin (même logique que dans admin-feature)
    const isAdmin = wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt'

    const handleCreateStrategy = async () => {
        if (!newStrategyName || !newStrategyApy) {
            toast.error('Please fill in all fields')
            return
        }

        const apyBasisPoints = parseInt(newStrategyApy)
        if (isNaN(apyBasisPoints) || apyBasisPoints < 0 || apyBasisPoints > 10000) {
            toast.error('APY must be between 0 and 10000 basis points')
            return
        }

        try {
            await createStrategyMutation.mutateAsync({
                name: newStrategyName,
                apyBasisPoints: apyBasisPoints
            })

            toast.success(`Strategy "${newStrategyName}" created successfully!`)
            setNewStrategyName('')
            setNewStrategyApy('')
        } catch (error) {
            console.error('Error creating strategy:', error)
            toast.error('Failed to create strategy. Check console for details.')
        }
    }

    return (
        <div className="space-y-8">
            {/* Hero Section Amélioré */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 rounded-2xl border-0">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
                <div className="relative p-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                                    🎯
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                                        Yield Strategies
                                    </h1>
                                    <p className="text-lg text-gray-600 dark:text-gray-300">
                                        Discover high-performance yield farming strategies with automated compounding
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                                <span>📈 Real-time APY tracking</span>
                                <span>🔒 Secured by Solana</span>
                                <span>⚡ Instant deposits & withdrawals</span>
                                <span>🎪 Yield token marketplace</span>
                            </div>
                        </div>
                        {wallet.connected && (
                            <div className="text-right space-y-2">
                                <div className="text-sm text-gray-500 dark:text-gray-400">Connected</div>
                                <div className="font-mono text-xs bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                                    {wallet.publicKey?.toString().slice(0, 8)}...{wallet.publicKey?.toString().slice(-8)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!wallet.connected ? (
                <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
                    <CardContent className="text-center py-12">
                        <div className="space-y-6">
                            <div className="text-8xl">🔒</div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-amber-800 dark:text-amber-200">Connect Your Wallet</h3>
                                <p className="text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                                    Connect your Solana wallet to explore our yield strategies and start earning passive income on your SOL tokens
                                </p>
                            </div>
                            <div className="space-y-3">
                                <Button disabled className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-3 text-lg">
                                    🔌 Connect Wallet
                                </Button>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Supports Phantom, Solflare, and other Solana wallets
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Create New Strategy (Admin Only) - Design Amélioré */}
                    {isAdmin && (
                        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800 shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2 text-purple-700 dark:text-purple-300">
                                    <span>🛠️</span>
                                    <span>Create New Strategy</span>
                                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-xs font-medium rounded-full">
                                        Admin Only
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-purple-600 dark:text-purple-400">
                                    Launch a new yield strategy for the community
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="strategy-name" className="text-purple-700 dark:text-purple-300">
                                            Strategy Name
                                        </Label>
                                        <Input
                                            id="strategy-name"
                                            placeholder="e.g. High Yield SOL Strategy"
                                            value={newStrategyName}
                                            onChange={(e) => setNewStrategyName(e.target.value)}
                                            className="border-purple-200 dark:border-purple-800 focus:border-purple-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="strategy-apy" className="text-purple-700 dark:text-purple-300">
                                            APY (basis points)
                                        </Label>
                                        <Input
                                            id="strategy-apy"
                                            type="number"
                                            placeholder="e.g. 1200 (12%)"
                                            value={newStrategyApy}
                                            onChange={(e) => setNewStrategyApy(e.target.value)}
                                            className="border-purple-200 dark:border-purple-800 focus:border-purple-400"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Button
                                        onClick={handleCreateStrategy}
                                        disabled={!newStrategyName || !newStrategyApy || createStrategyMutation.isPending}
                                        className="w-full md:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3"
                                    >
                                        {createStrategyMutation.isPending ? (
                                            <>🔄 Creating Strategy...</>
                                        ) : (
                                            <>🚀 Create Strategy</>
                                        )}
                                    </Button>
                                    {newStrategyApy && (
                                        <p className="text-sm text-purple-600 dark:text-purple-400">
                                            💡 This will create a strategy with {(parseInt(newStrategyApy) / 100).toFixed(2)}% APY
                                        </p>
                                    )}
                                </div>
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
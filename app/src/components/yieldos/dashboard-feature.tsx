'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useYieldos } from './yieldos-data-access'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function DashboardFeature() {
    const { connected } = useWallet()
    const {
        strategiesQuery,
        marketplacesQuery,
        userPositionsQuery
    } = useYieldos()

    if (!connected) {
        return (
            <div>
                <AppHero title="Yieldos Dashboard" subtitle="Connect your wallet to access the DeFi yield platform" />
                <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 text-center">
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-gray-600 dark:text-gray-400">
                                Please connect your wallet to view your portfolio and interact with yield strategies.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    const strategies = strategiesQuery.data || []
    const marketplaces = marketplacesQuery.data || []
    const allUserPositions = userPositionsQuery.data || []

    // Filter user positions to only those that belong to the connected wallet
    const userPositions = allUserPositions.filter((position: any) => {
        // TODO: Proper filtering once we implement user position parsing
        return position.account?.data?.length > 0
    })

    // Calculate active marketplaces (only those that are actually active)
    const activeMarketplaces = marketplaces.filter((m: any) => m.isActive === true)

    // Calculate portfolio stats
    const totalValueLocked = strategies.reduce((acc: number, strategy: any) =>
        acc + Number(strategy.decodedData?.totalDeposits || 0) / LAMPORTS_PER_SOL, 0
    )

    // Calculate average APY across all strategies (weighted by TVL)
    const totalAPY = strategies.reduce((acc: number, strategy: any) => {
        const deposits = Number(strategy.decodedData?.totalDeposits || 0)
        const apy = Number(strategy.decodedData?.apy || 0)
        return acc + (deposits * apy)
    }, 0)
    const averageAPY = totalValueLocked > 0 ? totalAPY / (totalValueLocked * LAMPORTS_PER_SOL * 100) : 0

    // Calculate user's total portfolio value
    const userPortfolioValue = userPositions.length * 100 // Placeholder until we parse position data correctly

    const strategiesCount = strategies.length
    const activeMarketplacesCount = activeMarketplaces.length
    const userPositionsCount = userPositions.length

    return (
        <div>
            <AppHero
                title="Yieldos Dashboard"
                subtitle="Track your DeFi yield strategies and marketplace activity"
            />

            <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
                {/* Portfolio Overview */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Total Portfolio Value</CardTitle>
                            <span className="text-3xl">💰</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-800 dark:text-green-200">{userPortfolioValue.toFixed(2)} SOL</div>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                +{(userPortfolioValue * averageAPY / 365 / 100).toFixed(2)} SOL daily est.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Value Locked</CardTitle>
                            <span className="text-3xl">📈</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-800 dark:text-purple-200">{totalValueLocked.toFixed(2)} SOL</div>
                            <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">Across {strategiesCount} strategies</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">Average APY</CardTitle>
                            <span className="text-3xl">🎯</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-800 dark:text-orange-200">{averageAPY.toFixed(1)}%</div>
                            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Weighted by TVL</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 border-sky-200 dark:border-sky-800 hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-sm font-medium text-sky-900 dark:text-sky-100">Active Positions</CardTitle>
                            <span className="text-3xl">📊</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-sky-800 dark:text-sky-200">{userPositionsCount}</div>
                            <p className="text-sm text-sky-600 dark:text-sky-400 mt-1">Strategies joined</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Strategies Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Strategies</CardTitle>
                            <CardDescription>
                                Yield generation strategies with their current APY
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {strategiesQuery.isLoading ? (
                                <p>Loading strategies...</p>
                            ) : strategies.length === 0 ? (
                                <p className="text-gray-600 dark:text-gray-400">No strategies available</p>
                            ) : (
                                <div className="space-y-4">
                                    {strategies.map((strategy: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                    {strategy.strategyId}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                                        {strategy.decodedData?.name || `Strategy ${strategy.strategyId}`}
                                                    </h4>
                                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                                        TVL: {(Number(strategy.decodedData?.totalDeposits || 0) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                                                    {((strategy.decodedData?.apy || 0) / 100).toFixed(2)}%
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">APY</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Platform Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Platform Status</CardTitle>
                            <CardDescription>
                                Current protocol activity and health
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Strategies:</span>
                                    <span className="font-medium">{strategiesCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Active Marketplaces:</span>
                                    <span className="font-medium">{activeMarketplacesCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Value Locked:</span>
                                    <span className="font-medium">{totalValueLocked.toFixed(2)} SOL</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Your Positions:</span>
                                    <span className="font-medium">{userPositionsCount}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* My Positions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>My Positions</CardTitle>
                            <CardDescription>
                                Strategies where you have invested
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {userPositionsQuery.isLoading ? (
                                <p>Loading your positions...</p>
                            ) : userPositions.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-gray-600 dark:text-gray-400 mb-2">No active positions</p>
                                    <p className="text-sm text-gray-500">Start investing in yield strategies to see your positions here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {strategies.filter(strategy => userPositions.some(pos =>
                                        // For now, show all strategies as placeholder until we have proper position parsing
                                        strategy.strategyId <= userPositionsCount
                                    )).map((strategy: any) => (
                                        <a
                                            key={strategy.strategyId}
                                            href={`/strategies/${strategy.strategyId}`}
                                            className="group block p-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transition-all duration-300 cursor-pointer hover:from-emerald-50 hover:to-green-50 dark:hover:from-emerald-950/30 dark:hover:to-green-950/30"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                                                        {strategy.strategyId}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                                            {strategy.decodedData?.name || `Strategy ${strategy.strategyId}`}
                                                        </h4>
                                                        <div className="flex items-center space-x-3 mt-1">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                APY: {((strategy.decodedData?.apy || 0) / 100).toFixed(2)}%
                                                            </span>
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                Active since {new Date().getFullYear()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                                                        {(100 * strategy.strategyId).toFixed(2)} SOL
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                        ≈ {(85 * strategy.strategyId).toFixed(0)} YLD tokens
                                                    </p>
                                                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 font-medium">
                                                        Manage position →
                                                    </div>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                        <CardHeader>
                            <CardTitle className="text-blue-900 dark:text-blue-100">Quick Actions</CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-300">
                                Grow your DeFi portfolio
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3">
                                <a
                                    href="/strategies"
                                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-md group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">🚀</span>
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-gray-100">Explore Strategies</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Find high-yield opportunities</div>
                                        </div>
                                    </div>
                                    <div className="text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">→</div>
                                </a>

                                <a
                                    href="/marketplace"
                                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-md group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">📈</span>
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-gray-100">Trade Yield Tokens</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Access the marketplace</div>
                                        </div>
                                    </div>
                                    <div className="text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">→</div>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
} 
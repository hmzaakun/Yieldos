'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useYieldos } from '@/components/yieldos/yieldos-data-access'
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
  const userPositions = userPositionsQuery.data || []

  // Calculate basic stats
  const totalValueLocked = strategies.reduce((acc: number, strategy: any) =>
    acc + Number(strategy.decodedData?.totalDeposits || 0) / LAMPORTS_PER_SOL, 0
  )

  const strategiesCount = strategies.length
  const marketplacesCount = marketplaces.length
  const positionsCount = userPositions.length

  return (
    <div>
      <AppHero
        title="Yieldos Dashboard"
        subtitle="Track your DeFi yield strategies and marketplace activity"
      />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Value Locked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalValueLocked.toFixed(2)} SOL
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Across {strategies.length} strategies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                My Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {positionsCount}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Active positions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Available Strategies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {strategiesCount}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Yield strategies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Marketplaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {marketplacesCount}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Trading markets
              </p>
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
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{strategy.decodedData?.name || `Strategy ${strategy.strategyId}`}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          TVL: {(Number(strategy.decodedData?.totalDeposits || 0) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {((strategy.decodedData?.apy || 0) / 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">APY</div>
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
                  <span className="font-medium">{marketplacesCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Value Locked:</span>
                  <span className="font-medium">{totalValueLocked.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Your Positions:</span>
                  <span className="font-medium">{positionsCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Get started with Yieldos platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  🚀 Explore strategies to start earning yield
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  💰 Deposit tokens to generate yield
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📈 Trade yield tokens on the marketplace
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📊 Monitor your portfolio performance
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon */}
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Features in development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  🔧 Enhanced position tracking
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  📈 Order history and analytics
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  💼 Portfolio performance metrics
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  🎯 Advanced trading features
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

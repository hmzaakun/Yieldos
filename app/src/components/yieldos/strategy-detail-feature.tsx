'use client'

import { useYieldosStrategy } from './yieldos-data-access'
import { useMarketplace, useYieldosProgram } from './yieldos-data-access'
import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface StrategyDetailFeatureProps {
    strategyId: number
}

export function StrategyDetailFeature({ strategyId }: StrategyDetailFeatureProps) {
    const wallet = useWallet()
    const {
        strategyQuery,
        depositMutation,
        withdrawMutation,
        getTokenRequirements,
        getUserYieldTokenBalance,
        getUserPosition
    } = useYieldosStrategy({ strategyId })

    const { marketplacesQuery } = useMarketplace()
    const { getPDAs } = useYieldosProgram()

    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [tokenInfo, setTokenInfo] = useState<any>(null)
    const [yieldTokenBalance, setYieldTokenBalance] = useState<number>(0)
    const [userPosition, setUserPosition] = useState<any>(null)

    // Récupérer le marketplace associé à cette stratégie
    const associatedMarketplace = useMemo(() => {
        if (!marketplacesQuery.data || !strategyQuery.data) return null

        // Calculer le PDA de la stratégie pour comparer avec les marketplaces
        const [strategyPda] = getPDAs.getStrategyPda(strategyId)

        return marketplacesQuery.data.find((marketplace: any) =>
            marketplace.strategy.equals(strategyPda) && marketplace.isActive
        )
    }, [marketplacesQuery.data, strategyQuery.data, strategyId, getPDAs])

    // Calculer des métriques dérivées
    const metrics = useMemo(() => {
        const strategy = strategyQuery.data
        if (!strategy || !strategy.decodedData) return null

        const apy = strategy.decodedData.apy / 100 // Convertir en pourcentage
        const tvl = strategy.decodedData.totalDeposits / 1e9 // Convertir en tokens
        const userInvestment = userPosition?.deposited_amount ? userPosition.deposited_amount / 1e9 : 0
        const estimatedAnnualYield = userInvestment * (apy / 100)
        const estimatedDailyYield = estimatedAnnualYield / 365
        const yieldTokensOwned = yieldTokenBalance / 1e9

        return {
            apy,
            tvl,
            userInvestment,
            estimatedAnnualYield,
            estimatedDailyYield,
            yieldTokensOwned,
            strategyName: strategy.decodedData.name || `Strategy #${strategyId}`,
            isActive: strategy.decodedData.isActive,
            riskLevel: apy > 20 ? 'High' : apy > 10 ? 'Medium' : 'Low'
        }
    }, [strategyQuery.data, userPosition, yieldTokenBalance, strategyId])

    // Charger les informations sur les tokens requis
    useEffect(() => {
        if (!wallet.connected || !getTokenRequirements || !getUserYieldTokenBalance || !getUserPosition) return

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
        }, 1000)

        return () => clearTimeout(timeoutId)
    }, [wallet.connected, strategyId])

    const handleDeposit = async () => {
        if (!depositAmount) return
        try {
            let currentTokenInfo = tokenInfo
            if (!currentTokenInfo && getTokenRequirements) {
                currentTokenInfo = await getTokenRequirements()
                setTokenInfo(currentTokenInfo)
            }

            const isWSol = currentTokenInfo?.isWSol ?? true
            const amount = isWSol
                ? Math.floor(Number(depositAmount) * 1e9)
                : Number(depositAmount)

            if (amount <= 0) {
                throw new Error(`Invalid amount calculated: ${amount}. Please enter a positive number.`)
            }

            await depositMutation.mutateAsync({ amount })
            setDepositAmount('')

            // Recharger les données
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

    const handleMaxDeposit = () => {
        if (!tokenInfo) return

        if (tokenInfo.isWSol) {
            // Laisser un peu pour les frais de transaction
            const maxAmount = Math.max(0, (tokenInfo.currentSolBalance / 1e9) - 0.01)
            setDepositAmount(maxAmount.toFixed(4))
        } else {
            setDepositAmount(tokenInfo.currentTokenBalance.toString())
        }
    }

    const handleMaxWithdraw = () => {
        if (!userPosition) return
        const maxAmount = tokenInfo?.isWSol
            ? (userPosition.deposited_amount / 1e9).toFixed(4)
            : userPosition.deposited_amount.toString()
        setWithdrawAmount(maxAmount)
    }

    if (!wallet.connected) {
        return (
            <div className="space-y-8">
                <AppHero
                    title={`Strategy #${strategyId}`}
                    subtitle="Connect your wallet to view strategy details"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <div className="space-y-4">
                            <div className="text-6xl">🔒</div>
                            <h3 className="text-lg font-semibold">Wallet Required</h3>
                            <p className="text-muted-foreground">
                                Connect your wallet to access strategy details and manage your positions
                            </p>
                            <Button disabled>Connect Wallet</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (strategyQuery.isLoading) {
        return (
            <div className="space-y-8">
                <div className="animate-pulse">
                    <div className="h-32 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg"></div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    if (strategyQuery.error) {
        return (
            <div className="space-y-8">
                <AppHero
                    title={`Strategy #${strategyId}`}
                    subtitle="Error loading strategy"
                />
                <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="text-center py-12">
                        <div className="space-y-4">
                            <div className="text-6xl">⚠️</div>
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                                Strategy Not Found
                            </h3>
                            <p className="text-muted-foreground">
                                The strategy you're looking for doesn't exist or couldn't be loaded.
                            </p>
                            <Link href="/strategies">
                                <Button variant="outline">← Back to Strategies</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const strategy = strategyQuery.data

    return (
        <div className="space-y-8">
            {/* Hero Section avec Avatar de Stratégie */}
            <Card className="overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 border-0">
                <CardContent className="p-8">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                                    {strategyId}
                                </div>
                                {metrics?.isActive && (
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-gray-900"></div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-3">
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {metrics?.strategyName}
                                    </h1>
                                    <Badge variant={metrics?.isActive ? "default" : "secondary"}>
                                        {metrics?.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <p className="text-lg text-gray-600 dark:text-gray-300">
                                    Advanced yield farming strategy with automated compounding
                                </p>
                                <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                                    <span>💰 Strategy ID: {strategyId}</span>
                                    {associatedMarketplace && (
                                        <span>🏪 Marketplace Active</span>
                                    )}
                                    <span>🔒 Secured by Solana</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Métriques Principales */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-green-600 dark:text-green-400">APY</p>
                                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                                    {metrics?.apy.toFixed(2)}%
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Annual Percentage Yield
                                </p>
                            </div>
                            <div className="text-4xl">📈</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Value Locked</p>
                                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                                    {metrics?.tvl.toFixed(2)}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    SOL in strategy
                                </p>
                            </div>
                            <div className="text-4xl">🏦</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Your Investment</p>
                                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                                    {metrics?.userInvestment.toFixed(4)}
                                </p>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                    SOL invested
                                </p>
                            </div>
                            <div className="text-4xl">👛</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200 dark:border-orange-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Daily Yield</p>
                                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                                    {metrics?.estimatedDailyYield.toFixed(6)}
                                </p>
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    SOL per day
                                </p>
                            </div>
                            <div className="text-4xl">⚡</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Détails de la Stratégie et Performance */}
            <div className="space-y-6">
                {/* Détails Complets */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <span>📊</span>
                            <span>Strategy Details</span>
                        </CardTitle>
                        <CardDescription>Complete information about this yield strategy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <span className="font-medium">Strategy Type:</span>
                                    <span className="text-blue-600 dark:text-blue-400">Yield Farming</span>
                                </div>
                                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <span className="font-medium">Underlying Asset:</span>
                                    <span className="text-green-600 dark:text-green-400">SOL/WSOL</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <span className="font-medium">Min. Investment:</span>
                                    <span>0.01 SOL</span>
                                </div>
                                <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <span className="font-medium">Lock Period:</span>
                                    <span className="text-yellow-600 dark:text-yellow-400">Flexible</span>
                                </div>
                            </div>
                        </div>

                        {/* Yield Token Balance */}
                        {metrics && metrics.yieldTokensOwned > 0 && (
                            <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                                    🎯 Your Yield Tokens
                                </h4>
                                <p className="text-yellow-700 dark:text-yellow-300">
                                    You own <strong>{metrics.yieldTokensOwned.toFixed(4)} YLD tokens</strong> representing your future yield earnings.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>



                {/* Position et Actions côte à côte */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Position Utilisateur et Balance */}
                    <div className="space-y-6">
                        {/* Position Utilisateur */}
                        {userPosition && (
                            <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 border-indigo-200 dark:border-indigo-800">
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300">
                                        <span>👤</span>
                                        <span>Your Position</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-indigo-600 dark:text-indigo-400">Invested:</span>
                                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                                                {(userPosition.deposited_amount / 1e9).toFixed(4)} SOL
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-indigo-600 dark:text-indigo-400">Yield Tokens:</span>
                                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                                                {(userPosition.yield_tokens_minted / 1e9).toFixed(4)} YLD
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-indigo-600 dark:text-indigo-400">Est. Annual Yield:</span>
                                            <span className="font-semibold text-green-600 dark:text-green-400">
                                                {metrics?.estimatedAnnualYield.toFixed(4)} SOL
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Token Requirements */}
                        {tokenInfo && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <span>🪙</span>
                                        <span>Your Balance</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <span className="font-medium">SOL:</span>
                                            <span className="text-green-600 dark:text-green-400">
                                                {(tokenInfo.currentSolBalance / 1e9).toFixed(4)}
                                            </span>
                                        </div>
                                        {tokenInfo.hasTokenAccount && (
                                            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <span className="font-medium">WSOL:</span>
                                                <span className="text-blue-600 dark:text-blue-400">
                                                    {(tokenInfo.currentTokenBalance / 1e9).toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg dark:bg-blue-950">
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            💡 {tokenInfo.recommendedAction}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions Rapides */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <span>⚡</span>
                                    <span>Quick Actions</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {associatedMarketplace && (
                                    <Link href={`/marketplace/${strategyId}`}>
                                        <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                                            🏪 Trade Yield Tokens
                                        </Button>
                                    </Link>
                                )}
                                <Link href="/strategies">
                                    <Button variant="outline" className="w-full">
                                        📊 Compare Strategies
                                    </Button>
                                </Link>
                                <Link href="/dashboard">
                                    <Button variant="outline" className="w-full">
                                        🏠 Return to Dashboard
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions de Dépôt et Retrait */}
                    <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                                    <span>💰</span>
                                    <span>Deposit Tokens</span>
                                </CardTitle>
                                <CardDescription>
                                    Add SOL to this strategy to start earning yield automatically
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="deposit-amount" className="text-green-700 dark:text-green-300">
                                        Amount to Deposit (SOL)
                                    </Label>
                                    <div className="flex space-x-2">
                                        <Input
                                            id="deposit-amount"
                                            type="number"
                                            placeholder="0.0"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            step="0.001"
                                            className="border-green-200 dark:border-green-800"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={handleMaxDeposit}
                                            disabled={!tokenInfo}
                                            className="border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                                        >
                                            Max
                                        </Button>
                                    </div>
                                    {depositAmount && (
                                        <div className="text-xs text-green-600 dark:text-green-400 space-y-1">
                                            <p>≈ {(Number(depositAmount) * 1e9).toLocaleString()} lamports</p>
                                            <p>Est. daily yield: ~{(Number(depositAmount) * (metrics?.apy || 0) / 100 / 365).toFixed(6)} SOL</p>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={handleDeposit}
                                    disabled={!depositAmount || depositMutation.isPending}
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                >
                                    {depositMutation.isPending ? '🔄 Depositing...' : '💰 Deposit & Start Earning'}
                                </Button>
                                <div className="text-xs text-green-600 dark:text-green-400 space-y-1">
                                    <p>✅ Automatic yield compounding</p>
                                    <p>✅ Withdraw anytime</p>
                                    <p>✅ Receive tradeable yield tokens</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200 dark:border-orange-800">
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
                                    <span>💸</span>
                                    <span>Withdraw Tokens</span>
                                </CardTitle>
                                <CardDescription>
                                    Remove tokens from this strategy and claim your rewards
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {userPosition && userPosition.deposited_amount > 0 && (
                                    <div className="p-3 bg-orange-50 rounded-lg dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                                        <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                                            <p>💰 Available to withdraw: <strong>{(userPosition.deposited_amount / 1e9).toFixed(4)} SOL</strong></p>
                                            <p>🎯 Yield tokens: <strong>{(yieldTokenBalance / 1e9).toFixed(4)} YLD</strong></p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="withdraw-amount" className="text-orange-700 dark:text-orange-300">
                                        Amount to Withdraw (SOL)
                                    </Label>
                                    <div className="flex space-x-2">
                                        <Input
                                            id="withdraw-amount"
                                            type="number"
                                            placeholder="0.0"
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            className="border-orange-200 dark:border-orange-800"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={handleMaxWithdraw}
                                            disabled={!userPosition || userPosition.deposited_amount <= 0}
                                            className="border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                                        >
                                            Max
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Button
                                        onClick={handleWithdraw}
                                        variant="outline"
                                        disabled={!withdrawAmount || withdrawMutation.isPending}
                                        className="w-full border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                                    >
                                        {withdrawMutation.isPending ? '🔄 Processing...' : '💸 Withdraw Amount'}
                                    </Button>

                                    <Button
                                        onClick={async () => {
                                            if (!userPosition) return
                                            const maxAmount = (userPosition.deposited_amount / 1e9).toFixed(4)
                                            setWithdrawAmount(maxAmount)
                                            await handleWithdraw()
                                        }}
                                        disabled={!userPosition || userPosition.deposited_amount <= 0 || withdrawMutation.isPending}
                                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                                    >
                                        {withdrawMutation.isPending ? '🔄 Processing...' :
                                            userPosition ? `💸 Withdraw All (${(userPosition.deposited_amount / 1e9).toFixed(4)} SOL)` :
                                                '💸 Withdraw All'
                                        }
                                    </Button>
                                </div>

                                <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                                    <p>⚡ Instant withdrawal</p>
                                    <p>💰 Includes accumulated yield</p>
                                    <p>🎯 Keep yield tokens for trading</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
} 
'use client'

import { useYieldosStrategy } from './yieldos-data-access'
import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'

interface StrategyDetailFeatureProps {
    strategyId: number
}

export function StrategyDetailFeature({ strategyId }: StrategyDetailFeatureProps) {
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
        }, 1000) // Attendre 1 seconde avant de faire la requête

        return () => clearTimeout(timeoutId)
    }, [wallet.connected, strategyId]) // Retirer getTokenRequirements des dépendances

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

            console.log('Deposit debug:', {
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

    if (!wallet.connected) {
        return (
            <div className="space-y-8">
                <AppHero
                    title={`Strategy #${strategyId}`}
                    subtitle="Connect your wallet to view strategy details"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (strategyQuery.isLoading) {
        return (
            <div className="space-y-8">
                <AppHero
                    title={`Strategy #${strategyId}`}
                    subtitle="Loading strategy details..."
                />
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
                <Card>
                    <CardContent className="text-center py-12">
                        <p className="text-red-500 mb-4">Failed to load strategy details</p>
                        <Link href="/strategies">
                            <Button variant="outline">Back to Strategies</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <AppHero
                title={`Strategy #${strategyId}`}
                subtitle="Detailed view and management of your yield strategy"
            />

            {/* Strategy Overview */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Strategy Overview</CardTitle>
                        <CardDescription>Key metrics and information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex justify-between">
                                <span className="font-medium">APY:</span>
                                <span className="text-green-600 font-bold">12.00%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Total Value Locked:</span>
                                <span>1,000.00 tokens</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Your Position:</span>
                                <span>0.00 tokens</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Yield Tokens Earned:</span>
                                <span>0.00 YLD</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Estimated Annual Yield:</span>
                                <span className="text-green-600">0.00 tokens</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Strategy Performance</CardTitle>
                        <CardDescription>Historical performance data</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Performance chart coming soon</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Track APY changes, volume, and returns over time
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Token Requirements */}
            {tokenInfo && (
                <Card>
                    <CardHeader>
                        <CardTitle>Token Requirements</CardTitle>
                        <CardDescription>Information about the tokens required for this strategy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <h4 className="font-medium">Required Token</h4>
                                <p className="text-sm text-muted-foreground">{tokenInfo.tokenName}</p>
                                {tokenInfo.canUseNativeSOL && (
                                    <p className="text-xs text-green-600 mt-1">✓ You can use native SOL</p>
                                )}
                            </div>
                            <div>
                                <h4 className="font-medium">Your Balance</h4>
                                <div className="text-sm text-muted-foreground">
                                    {tokenInfo.isWSol ? (
                                        <>
                                            <p>SOL: {(tokenInfo.currentSolBalance / 1e9).toFixed(4)}</p>
                                            {tokenInfo.hasTokenAccount && (
                                                <p>WSOL: {(tokenInfo.currentTokenBalance / 1e9).toFixed(4)}</p>
                                            )}
                                        </>
                                    ) : (
                                        <p>Tokens: {tokenInfo.currentTokenBalance}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg dark:bg-blue-950">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                💡 {tokenInfo.recommendedAction}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Deposit Tokens</CardTitle>
                        <CardDescription>
                            {tokenInfo?.isWSol
                                ? "Deposit SOL or WSOL to this strategy to start earning yield"
                                : "Add tokens to this strategy to start earning yield"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="deposit-amount">
                                Amount to Deposit {tokenInfo?.isWSol ? "(in SOL)" : ""}
                            </Label>
                            <Input
                                id="deposit-amount"
                                type="number"
                                placeholder="0.0"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                step={tokenInfo?.isWSol ? "0.001" : "1"}
                            />
                            {tokenInfo?.isWSol && depositAmount && (
                                <p className="text-xs text-muted-foreground">
                                    = {(Number(depositAmount) * 1e9).toLocaleString()} lamports
                                </p>
                            )}
                        </div>
                        <Button
                            onClick={handleDeposit}
                            disabled={!depositAmount || depositMutation.isPending}
                            className="w-full"
                        >
                            {depositMutation.isPending ? 'Depositing...' : 'Deposit Tokens'}
                        </Button>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                You will receive yield tokens representing your future earnings
                            </p>
                            {tokenInfo?.isWSol && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    If you use SOL, it will be automatically converted to WSOL
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Withdraw Tokens</CardTitle>
                        <CardDescription>Remove tokens from this strategy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="withdraw-amount">Amount to Withdraw</Label>
                            <Input
                                id="withdraw-amount"
                                type="number"
                                placeholder="0.0"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={handleWithdraw}
                            variant="outline"
                            disabled={!withdrawAmount || withdrawMutation.isPending}
                            className="w-full"
                        >
                            {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw Tokens'}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Withdraw your deposited tokens and any earned yield
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <Link href="/strategies">
                    <Button variant="outline">← Back to Strategies</Button>
                </Link>
                <Link href="/dashboard">
                    <Button variant="outline">View Portfolio →</Button>
                </Link>
            </div>
        </div>
    )
} 
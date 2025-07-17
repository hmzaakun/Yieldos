'use client'

import { useYieldosStrategy } from './yieldos-data-access'
import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'

interface StrategyDetailFeatureProps {
    strategyId: number
}

export function StrategyDetailFeature({ strategyId }: StrategyDetailFeatureProps) {
    const wallet = useWallet()
    const { strategyQuery, depositMutation, withdrawMutation } = useYieldosStrategy({ strategyId })
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')

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

            {/* Actions */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Deposit Tokens</CardTitle>
                        <CardDescription>Add tokens to this strategy to start earning yield</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="deposit-amount">Amount to Deposit</Label>
                            <Input
                                id="deposit-amount"
                                type="number"
                                placeholder="0.0"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={handleDeposit}
                            disabled={!depositAmount || depositMutation.isPending}
                            className="w-full"
                        >
                            {depositMutation.isPending ? 'Depositing...' : 'Deposit Tokens'}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            You will receive yield tokens representing your future earnings
                        </p>
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
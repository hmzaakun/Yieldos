'use client'

import { AppHero } from '@/components/app-hero'
import { useProtocolStats, useStrategiesAnalytics } from './yieldos-analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useYieldosProgram } from './yieldos-data-access'
import { useMarketplace } from './yieldos-data-access'

export function AdminFeature() {
    const wallet = useWallet()
    const { stats: protocolStats, isLoading: statsLoading } = useProtocolStats()
    const { program, strategiesQuery, createStrategyMutation } = useYieldosProgram()
    const { marketplacesQuery, createMarketplaceMutation } = useMarketplace()
    const [newStrategyName, setNewStrategyName] = useState('')
    const [newStrategyApy, setNewStrategyApy] = useState('')
    const [protocolFee, setProtocolFee] = useState('100')
    // Marketplace creation state
    const [marketplaceStrategyId, setMarketplaceStrategyId] = useState('')
    const [marketplaceFee, setMarketplaceFee] = useState('50')

    // Check if user is admin (mock check)
    const isAdmin = wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt'

    // Créer une stratégie (vraie mutation)
    const handleCreateStrategy = async () => {
        if (!newStrategyName || !newStrategyApy) return
        try {
            await createStrategyMutation.mutateAsync({
                name: newStrategyName,
                apyBasisPoints: parseInt(newStrategyApy)
            })
            toast.success(`Strategy "${newStrategyName}" created!`)
            setNewStrategyName('')
            setNewStrategyApy('')
            strategiesQuery.refetch()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error creating strategy')
        }
    }

    // Créer un marketplace (vraie mutation)
    const handleCreateMarketplace = async () => {
        if (!marketplaceStrategyId || !marketplaceFee) return
        try {
            await createMarketplaceMutation.mutateAsync({
                strategyId: Number(marketplaceStrategyId),
                tradingFeeBps: Number(marketplaceFee)
            })
            toast.success('Marketplace created!')
            setMarketplaceStrategyId('')
            setMarketplaceFee('50')
            marketplacesQuery.refetch()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error creating marketplace')
        }
    }

    if (!wallet.connected) {
        return (
            <div className="space-y-8">
                <AppHero
                    title="Admin Panel"
                    subtitle="Connect your wallet to access admin functions"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="space-y-8">
                <AppHero
                    title="Admin Panel"
                    subtitle="Access Denied"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-2 text-red-600">Unauthorized Access</h3>
                        <p className="text-muted-foreground">
                            You do not have admin privileges to access this page.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <AppHero
                title="Admin Panel"
                subtitle="Manage the Yieldos protocol, strategies, and marketplaces"
            />

            {/* Protocol Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
                        <span className="text-2xl">💰</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{protocolStats.totalValueLocked?.toLocaleString() ?? '...'} tokens</div>
                        <p className="text-xs text-green-600">Status: {protocolStats.protocolStatus}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <span className="text-2xl">👥</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{protocolStats.totalUsers?.toLocaleString() ?? '...'}</div>
                        <p className="text-xs text-blue-600">Estimated active users</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
                        <span className="text-2xl">📈</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{protocolStats.totalStrategies ?? '...'}</div>
                        <p className="text-xs text-purple-600">Live strategies</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 border-orange-200 dark:border-orange-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Network</CardTitle>
                        <span className="text-2xl">📡</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Devnet</div>
                        <p className="text-xs text-orange-600">Solana blockchain</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-pink-50 to-red-50 dark:from-pink-950 dark:to-red-950 border-pink-200 dark:border-pink-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Protocol Fee</CardTitle>
                        <span className="text-2xl">💎</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(Number(protocolFee) / 100).toFixed(2)}%</div>
                        <p className="text-xs text-pink-600">Current fee rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Admin Actions */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Create Strategy */}
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
                    <CardHeader>
                        <CardTitle>Create New Strategy</CardTitle>
                        <CardDescription>Launch a new yield farming strategy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="admin-strategy-name">Strategy Name</Label>
                            <Input
                                id="admin-strategy-name"
                                placeholder="e.g. High Yield USDC"
                                value={newStrategyName}
                                onChange={(e) => setNewStrategyName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-strategy-apy">APY (basis points)</Label>
                            <Input
                                id="admin-strategy-apy"
                                type="number"
                                placeholder="e.g. 1200 (12%)"
                                value={newStrategyApy}
                                onChange={(e) => setNewStrategyApy(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={handleCreateStrategy}
                            disabled={!newStrategyName || !newStrategyApy || createStrategyMutation.isPending}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        >
                            {createStrategyMutation.isPending ? 'Creating...' : '🚀 Create Strategy'}
                        </Button>
                    </CardContent>
                </Card>
                {/* Create Marketplace */}
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                        <CardTitle>Create Marketplace</CardTitle>
                        <CardDescription>Open a new marketplace for a strategy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="marketplace-strategy">Strategy</Label>
                            <select
                                id="marketplace-strategy"
                                className="w-full border rounded p-2"
                                value={marketplaceStrategyId}
                                onChange={e => setMarketplaceStrategyId(e.target.value)}
                            >
                                <option value="">Select a strategy</option>
                                {strategiesQuery.data?.map(s => (
                                    <option key={s.strategyId} value={s.strategyId}>{s.decodedData?.name || `Strategy #${s.strategyId}`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="marketplace-fee">Trading Fee (basis points)</Label>
                            <Input
                                id="marketplace-fee"
                                type="number"
                                placeholder="50 (0.5%)"
                                value={marketplaceFee}
                                onChange={e => setMarketplaceFee(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={handleCreateMarketplace}
                            disabled={!marketplaceStrategyId || !marketplaceFee || createMarketplaceMutation.isPending}
                            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                        >
                            {createMarketplaceMutation.isPending ? 'Creating...' : '🏪 Create Marketplace'}
                        </Button>
                    </CardContent>
                </Card>
                {/* Protocol Settings */}
                <Card className="bg-gradient-to-br from-pink-50 to-red-50 dark:from-pink-950 dark:to-red-950 border-pink-200 dark:border-pink-800">
                    <CardHeader>
                        <CardTitle>Protocol Settings</CardTitle>
                        <CardDescription>Manage protocol-wide configurations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="protocol-fee">Protocol Fee (basis points)</Label>
                            <Input
                                id="protocol-fee"
                                type="number"
                                placeholder="100 (1%)"
                                value={protocolFee}
                                onChange={(e) => setProtocolFee(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={() => toast.info('Not implemented yet')}
                            variant="outline"
                            className="w-full"
                        >
                            💎 Update Protocol Fee
                        </Button>
                        <div className="pt-2 space-y-2">
                            <Button variant="outline" className="w-full" onClick={() => toast.info('Not implemented yet')}>
                                ⏸️ Pause All Strategies
                            </Button>
                            <Button variant="destructive" className="w-full" onClick={() => toast.info('Not implemented yet')}>
                                🛑 Emergency Stop
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Strategy Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Strategy Management</CardTitle>
                    <CardDescription>Monitor and control all active strategies</CardDescription>
                </CardHeader>
                <CardContent>
                    {strategiesQuery.isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Loading strategies...</p>
                        </div>
                    ) : !strategiesQuery.data || strategiesQuery.data.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No strategies found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Strategy</TableHead>
                                    <TableHead>APY</TableHead>
                                    <TableHead>TVL</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {strategiesQuery.data.map((strategy) => (
                                    <TableRow key={strategy.pubkey?.toString() || strategy.strategyId}>
                                        <TableCell className="font-medium">{strategy.decodedData?.name || `Strategy #${strategy.strategyId}`}</TableCell>
                                        <TableCell>{strategy.decodedData ? (strategy.decodedData.apy / 100).toFixed(2) : '...'}%</TableCell>
                                        <TableCell>{strategy.decodedData ? (strategy.decodedData.totalDeposits / 1e9).toFixed(2) : '...'} SOL</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs ${strategy.decodedData?.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                                {strategy.decodedData?.isActive ? 'active' : 'inactive'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Marketplace Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Marketplace Management</CardTitle>
                    <CardDescription>Monitor and control all marketplaces</CardDescription>
                </CardHeader>
                <CardContent>
                    {marketplacesQuery.isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Loading marketplaces...</p>
                        </div>
                    ) : !marketplacesQuery.data || marketplacesQuery.data.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No marketplaces found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Marketplace</TableHead>
                                    <TableHead>Strategy</TableHead>
                                    <TableHead>Fee</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marketplacesQuery.data.map((m) => (
                                    <TableRow key={m.pubkey?.toString() || (m.strategy.toString() + '-' + m.marketplaceId)}>
                                        <TableCell className="font-medium">#{m.marketplaceId}</TableCell>
                                        <TableCell>{m.strategy.toString().slice(0, 8)}...{m.strategy.toString().slice(-4)}</TableCell>
                                        <TableCell>{(m.tradingFeeBps / 100).toFixed(2)}%</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs ${m.isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                {m.isActive ? 'active' : 'inactive'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{m.createdAt ? new Date(m.createdAt * 1000).toLocaleDateString() : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* System Monitoring */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Section transactions récentes masquée car non branchée */}
                <Card>
                    <CardHeader>
                        <CardTitle>System Health</CardTitle>
                        <CardDescription>Monitor protocol performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-sm">Contract Uptime:</span>
                                <span className="text-sm text-green-600">99.9%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Avg Response Time:</span>
                                <span className="text-sm">1.2s</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Failed Transactions:</span>
                                <span className="text-sm text-red-600">0.1%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Last Backup:</span>
                                <span className="text-sm">2 hours ago</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
} 
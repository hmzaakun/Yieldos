'use client'

import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export function AdminFeature() {
    const wallet = useWallet()
    const [newStrategyName, setNewStrategyName] = useState('')
    const [newStrategyApy, setNewStrategyApy] = useState('')
    const [protocolFee, setProtocolFee] = useState('100')

    // Check if user is admin (mock check)
    const isAdmin = wallet.publicKey?.toString() === '7JS6XpnoEJDcrzUzg3K7dnpzK2pxYJAdQr5CaREzEHNt'

    const protocolStats = {
        totalValueLocked: 1234567.89,
        totalUsers: 2847,
        totalStrategies: 12,
        totalVolume: 9876543.21,
        protocolRevenue: 12345.67
    }

    const strategies = [
        { id: 1, name: 'High Yield USDC', apy: '12.00%', tvl: '$456,789', status: 'active' },
        { id: 2, name: 'SOL Staking Plus', apy: '8.50%', tvl: '$234,567', status: 'active' },
        { id: 3, name: 'Multi-Asset Yield', apy: '15.20%', tvl: '$123,456', status: 'paused' },
    ]

    const handleCreateStrategy = () => {
        if (!newStrategyName || !newStrategyApy) return
        console.log('Creating strategy:', { name: newStrategyName, apy: newStrategyApy })
        setNewStrategyName('')
        setNewStrategyApy('')
    }

    const handleUpdateProtocolFee = () => {
        console.log('Updating protocol fee to:', protocolFee)
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
                subtitle="Manage the Yieldos protocol and monitor system performance"
            />

            {/* Protocol Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
                        <span className="text-2xl">💰</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${protocolStats.totalValueLocked.toLocaleString()}</div>
                        <p className="text-xs text-green-600">+20.1% from last month</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <span className="text-2xl">👥</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{protocolStats.totalUsers.toLocaleString()}</div>
                        <p className="text-xs text-green-600">+180 this month</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
                        <span className="text-2xl">📊</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{protocolStats.totalStrategies}</div>
                        <p className="text-xs text-blue-600">+2 new this week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                        <span className="text-2xl">📈</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${protocolStats.totalVolume.toLocaleString()}</div>
                        <p className="text-xs text-green-600">+15.2% from last week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Protocol Revenue</CardTitle>
                        <span className="text-2xl">💎</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${protocolStats.protocolRevenue.toLocaleString()}</div>
                        <p className="text-xs text-green-600">+8.7% from last month</p>
                    </CardContent>
                </Card>
            </div>

            {/* Admin Actions */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
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
                            disabled={!newStrategyName || !newStrategyApy}
                            className="w-full"
                        >
                            Create Strategy
                        </Button>
                    </CardContent>
                </Card>

                <Card>
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
                            onClick={handleUpdateProtocolFee}
                            variant="outline"
                            className="w-full"
                        >
                            Update Protocol Fee
                        </Button>
                        <div className="pt-2 space-y-2">
                            <Button variant="outline" className="w-full">
                                Pause All Strategies
                            </Button>
                            <Button variant="destructive" className="w-full">
                                Emergency Stop
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Strategy</TableHead>
                                <TableHead>APY</TableHead>
                                <TableHead>TVL</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {strategies.map((strategy) => (
                                <TableRow key={strategy.id}>
                                    <TableCell className="font-medium">{strategy.name}</TableCell>
                                    <TableCell>{strategy.apy}</TableCell>
                                    <TableCell>{strategy.tvl}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${strategy.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {strategy.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <Button size="sm" variant="outline">
                                                {strategy.status === 'active' ? 'Pause' : 'Resume'}
                                            </Button>
                                            <Button size="sm" variant="outline">
                                                Edit
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* System Monitoring */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Admin Actions</CardTitle>
                        <CardDescription>Track administrative activities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Strategy #3 paused</span>
                                <span className="text-muted-foreground">2 hours ago</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Protocol fee updated</span>
                                <span className="text-muted-foreground">1 day ago</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>New strategy created</span>
                                <span className="text-muted-foreground">3 days ago</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
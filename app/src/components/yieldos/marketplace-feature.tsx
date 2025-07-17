'use client'

import { AppHero } from '@/components/app-hero'
import { YieldTokenMarketplace } from './yieldos-ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export function MarketplaceFeature() {
    const wallet = useWallet()
    const [sellAmount, setSellAmount] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [buyAmount, setBuyAmount] = useState('')
    const [buyPrice, setBuyPrice] = useState('')

    // Mock data for orders
    const mockOrders = [
        { id: 1, type: 'sell', token: 'YLD-1', amount: '100.00', price: '1.05', total: '105.00' },
        { id: 2, type: 'buy', token: 'YLD-1', amount: '50.00', price: '0.98', total: '49.00' },
        { id: 3, type: 'sell', token: 'YLD-2', amount: '250.00', price: '1.12', total: '280.00' },
    ]

    const handleCreateSellOrder = () => {
        if (!sellAmount || !sellPrice) return
        console.log('Creating sell order:', { amount: sellAmount, price: sellPrice })
        setSellAmount('')
        setSellPrice('')
    }

    const handleCreateBuyOrder = () => {
        if (!buyAmount || !buyPrice) return
        console.log('Creating buy order:', { amount: buyAmount, price: buyPrice })
        setBuyAmount('')
        setBuyPrice('')
    }

    return (
        <div className="space-y-8">
            <AppHero
                title="Yield Token Marketplace"
                subtitle="Trade your yield tokens with other users in our decentralized marketplace"
            />

            {!wallet.connected ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                        <p className="text-muted-foreground mb-4">
                            Connect your wallet to access the marketplace and trade yield tokens
                        </p>
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Market Overview */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Volume (24h)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">$12,345</div>
                                <p className="text-xs text-green-600">+15.2% from yesterday</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Orders</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">127</div>
                                <p className="text-xs text-muted-foreground">Across all yield tokens</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Avg. Trade Size</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">$97</div>
                                <p className="text-xs text-blue-600">-5.1% from last week</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trading Interface */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Create Sell Order</CardTitle>
                                <CardDescription>Sell your yield tokens to other users</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sell-amount">Amount (YLD tokens)</Label>
                                    <Input
                                        id="sell-amount"
                                        type="number"
                                        placeholder="0.0"
                                        value={sellAmount}
                                        onChange={(e) => setSellAmount(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sell-price">Price per token</Label>
                                    <Input
                                        id="sell-price"
                                        type="number"
                                        placeholder="1.0"
                                        value={sellPrice}
                                        onChange={(e) => setSellPrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Total Value:</span>
                                        <span>{(Number(sellAmount || 0) * Number(sellPrice || 0)).toFixed(2)} tokens</span>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleCreateSellOrder}
                                    disabled={!sellAmount || !sellPrice}
                                    className="w-full"
                                >
                                    Create Sell Order
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Create Buy Order</CardTitle>
                                <CardDescription>Buy yield tokens from other users</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="buy-amount">Amount (YLD tokens)</Label>
                                    <Input
                                        id="buy-amount"
                                        type="number"
                                        placeholder="0.0"
                                        value={buyAmount}
                                        onChange={(e) => setBuyAmount(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="buy-price">Price per token</Label>
                                    <Input
                                        id="buy-price"
                                        type="number"
                                        placeholder="1.0"
                                        value={buyPrice}
                                        onChange={(e) => setBuyPrice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Total Cost:</span>
                                        <span>{(Number(buyAmount || 0) * Number(buyPrice || 0)).toFixed(2)} tokens</span>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleCreateBuyOrder}
                                    disabled={!buyAmount || !buyPrice}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Create Buy Order
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Order Book */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Book</CardTitle>
                            <CardDescription>Current buy and sell orders in the marketplace</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Token</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <span className={`capitalize px-2 py-1 rounded text-xs ${order.type === 'sell' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    {order.type}
                                                </span>
                                            </TableCell>
                                            <TableCell>{order.token}</TableCell>
                                            <TableCell>{order.amount}</TableCell>
                                            <TableCell>{order.price}</TableCell>
                                            <TableCell>{order.total}</TableCell>
                                            <TableCell>
                                                <Button size="sm" variant="outline">
                                                    {order.type === 'sell' ? 'Buy' : 'Sell'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Your Orders */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Orders</CardTitle>
                            <CardDescription>Manage your active orders</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">No active orders</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Create your first order using the forms above
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
} 
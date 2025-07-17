'use client'

import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useMarketplace, useYieldosProgram, MarketplaceData, TradeOrderData } from './yieldos-data-access'
import { PublicKey } from '@solana/web3.js'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function MarketplaceFeature() {
    const wallet = useWallet()
    const { strategiesQuery } = useYieldosProgram()
    const { marketplacesQuery, getOrdersQuery, createMarketplaceMutation, placeOrderMutation, cancelOrderMutation, executeTradesMutation, getPDAs } = useMarketplace()

    const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null)
    const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceData | null>(null)
    const [sellAmount, setSellAmount] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [buyAmount, setBuyAmount] = useState('')
    const [buyPrice, setBuyPrice] = useState('')
    const [createMarketplaceFee, setCreateMarketplaceFee] = useState('100') // 1% default

    // Get marketplace for selected strategy
    const currentMarketplace = useMemo(() => {
        if (!selectedStrategy || !marketplacesQuery.data || !strategiesQuery.data) return null

        // Find the strategy data to get its PDA
        const strategyData = strategiesQuery.data.find(s => s.strategyId === selectedStrategy)
        if (!strategyData) return null

        // Find marketplace that matches this strategy's PDA
        return marketplacesQuery.data.find(m =>
            m.strategy.toString() === strategyData.pubkey.toString()
        ) || null
    }, [selectedStrategy, marketplacesQuery.data, strategiesQuery.data])

    // Get orders for current marketplace
    const ordersQuery = getOrdersQuery(currentMarketplace?.strategy ? new PublicKey(currentMarketplace.strategy) : null)

    // Auto-select first strategy and marketplace
    useEffect(() => {
        if (strategiesQuery.data && strategiesQuery.data.length > 0 && !selectedStrategy) {
            console.log('Auto-selecting first strategy:', strategiesQuery.data[0].strategyId)
            setSelectedStrategy(strategiesQuery.data[0].strategyId)
        }
    }, [strategiesQuery.data, selectedStrategy])

    useEffect(() => {
        if (currentMarketplace && !selectedMarketplace) {
            console.log('Setting current marketplace:', currentMarketplace)
            setSelectedMarketplace(currentMarketplace)
        }
    }, [currentMarketplace, selectedMarketplace])

    // Debug logs
    useEffect(() => {
        console.log('Marketplace debug:', {
            selectedStrategy,
            marketplacesCount: marketplacesQuery.data?.length || 0,
            strategiesCount: strategiesQuery.data?.length || 0,
            currentMarketplace: currentMarketplace ? 'found' : 'not found',
            marketplacesData: marketplacesQuery.data?.map(m => ({
                strategy: m.strategy.toString(),
                id: m.marketplaceId
            }))
        })
    }, [selectedStrategy, marketplacesQuery.data, strategiesQuery.data, currentMarketplace])

    const handleCreateMarketplace = async () => {
        if (!selectedStrategy) return

        try {
            console.log('Creating marketplace for strategy:', selectedStrategy)
            await createMarketplaceMutation.mutateAsync({
                strategyId: selectedStrategy,
                tradingFeeBps: Number(createMarketplaceFee)
            })
            // Refresh data
            console.log('Marketplace created successfully, refreshing data...')
            await marketplacesQuery.refetch()
        } catch (error) {
            console.error('Error creating marketplace:', error)
            alert(`Error creating marketplace: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const handleRefreshData = async () => {
        console.log('Refreshing all marketplace data...')
        await Promise.all([
            strategiesQuery.refetch(),
            marketplacesQuery.refetch()
        ])
    }

    const handleCreateSellOrder = async () => {
        if (!sellAmount || !sellPrice || !currentMarketplace) return

        try {
            const yieldTokenAmount = Math.floor(Number(sellAmount) * LAMPORTS_PER_SOL)
            const pricePerToken = Math.floor(Number(sellPrice) * 1000000) // 6 decimals for price

            await placeOrderMutation.mutateAsync({
                marketplacePda: new PublicKey(currentMarketplace.strategy),
                orderType: 1, // Sell order
                yieldTokenAmount,
                pricePerToken
            })

            setSellAmount('')
            setSellPrice('')
            ordersQuery.refetch()
        } catch (error) {
            console.error('Error creating sell order:', error)
        }
    }

    const handleCreateBuyOrder = async () => {
        if (!buyAmount || !buyPrice || !currentMarketplace) return

        try {
            const yieldTokenAmount = Math.floor(Number(buyAmount) * LAMPORTS_PER_SOL)
            const pricePerToken = Math.floor(Number(buyPrice) * 1000000) // 6 decimals for price

            await placeOrderMutation.mutateAsync({
                marketplacePda: new PublicKey(currentMarketplace.strategy),
                orderType: 0, // Buy order
                yieldTokenAmount,
                pricePerToken
            })

            setBuyAmount('')
            setBuyPrice('')
            ordersQuery.refetch()
        } catch (error) {
            console.error('Error creating buy order:', error)
        }
    }

    const handleCancelOrder = async (orderId: number) => {
        if (!currentMarketplace) return

        try {
            await cancelOrderMutation.mutateAsync({
                orderId,
                marketplacePda: new PublicKey(currentMarketplace.strategy)
            })
            ordersQuery.refetch()
        } catch (error) {
            console.error('Error canceling order:', error)
        }
    }

    const formatPrice = (price: number) => {
        return (price / 1000000).toFixed(6)
    }

    const formatAmount = (amount: number) => {
        return (amount / LAMPORTS_PER_SOL).toFixed(6)
    }

    // Helper function to parse strategy data properly
    const parseStrategyData = (strategy: any) => {
        try {
            // If we have decoded data from Anchor, use it
            if (strategy.decodedData) {
                return {
                    name: strategy.decodedData.name || `Strategy ${strategy.strategyId}`,
                    apy: Number(strategy.decodedData.apy || 0),
                    totalDeposits: Number(strategy.decodedData.totalDeposits || 0),
                    isActive: strategy.decodedData.isActive || false
                }
            }

            // Otherwise, manual parsing if we have raw account data
            if (strategy.account?.data) {
                const data = strategy.account.data
                let offset = 8 // Skip discriminator

                // Skip admin (32), underlying_token (32), yield_token_mint (32)
                offset += 96

                // Parse name (4 bytes length + string data)
                const nameLength = data.readUInt32LE(offset)
                offset += 4
                const nameBytes = data.subarray(offset, offset + nameLength)
                const name = new TextDecoder().decode(nameBytes)
                offset += nameLength

                // Parse APY (8 bytes u64)
                const apyLow = data.readUInt32LE(offset)
                const apyHigh = data.readUInt32LE(offset + 4)
                const apy = apyHigh * 0x100000000 + apyLow
                offset += 8

                // Parse total_deposits (8 bytes u64)
                const totalDepositsLow = data.readUInt32LE(offset)
                const totalDepositsHigh = data.readUInt32LE(offset + 4)
                const totalDeposits = totalDepositsHigh * 0x100000000 + totalDepositsLow
                offset += 8

                // Parse is_active (1 byte bool)
                const isActive = data[offset] !== 0

                return {
                    name: name || `Strategy ${strategy.strategyId}`,
                    apy,
                    totalDeposits,
                    isActive
                }
            }

            // Fallback for incomplete data
            return {
                name: `Strategy ${strategy.strategyId}`,
                apy: 0,
                totalDeposits: 0,
                isActive: false
            }
        } catch (error) {
            console.warn('Error parsing strategy data:', error)
            return {
                name: `Strategy ${strategy.strategyId}`,
                apy: 0,
                totalDeposits: 0,
                isActive: false
            }
        }
    }

    // Fonction pour trouver et exécuter des trades automatiquement
    const findAndExecuteTrades = async () => {
        if (!ordersQuery.data || !currentMarketplace) return

        const buyOrders = ordersQuery.data.filter(order => order.orderType === 0) // Buy orders
        const sellOrders = ordersQuery.data.filter(order => order.orderType === 1) // Sell orders

        for (const buyOrder of buyOrders) {
            for (const sellOrder of sellOrders) {
                // Check if prices are compatible (buy price >= sell price)
                if (buyOrder.pricePerToken >= sellOrder.pricePerToken) {
                    const tradeAmount = Math.min(
                        buyOrder.yieldTokenAmount - buyOrder.filledAmount,
                        sellOrder.yieldTokenAmount - sellOrder.filledAmount
                    )

                    if (tradeAmount > 0) {
                        try {
                            // Get proper PDAs for the orders
                            const [buyOrderPda] = getPDAs.getOrderPda(buyOrder.user, buyOrder.orderId)
                            const [sellOrderPda] = getPDAs.getOrderPda(sellOrder.user, sellOrder.orderId)

                            await executeTradesMutation.mutateAsync({
                                buyOrderPda,
                                sellOrderPda,
                                tradeAmount,
                                marketplacePda: new PublicKey(currentMarketplace.strategy)
                            })
                            // Refresh orders after successful trade
                            ordersQuery.refetch()
                            return // Execute one trade at a time
                        } catch (error) {
                            console.error('Error executing auto-trade:', error)
                        }
                    }
                }
            }
        }
    }

    if (!wallet.connected) {
        return (
            <div className="space-y-8">
                <AppHero
                    title="Yield Token Marketplace"
                    subtitle="Trade your yield tokens with other users in our decentralized marketplace"
                />
                <Card>
                    <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                        <p className="text-muted-foreground mb-4">
                            Connect your wallet to access the marketplace and trade yield tokens
                        </p>
                        <Button disabled>Connect Wallet</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <AppHero
                title="Yield Token Marketplace"
                subtitle="Trade your yield tokens with other users in our decentralized marketplace"
            />

            {/* Debug/Refresh Button */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Strategies: {strategiesQuery.data?.length || 0} |
                                Marketplaces: {marketplacesQuery.data?.length || 0} |
                                Selected: {selectedStrategy || 'None'}
                            </p>
                        </div>
                        <Button onClick={handleRefreshData} variant="outline" size="sm">
                            Refresh Data
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Strategy Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Select Strategy</CardTitle>
                    <CardDescription>Choose a strategy to trade its yield tokens</CardDescription>
                </CardHeader>
                <CardContent>
                    {strategiesQuery.isLoading ? (
                        <p>Loading strategies...</p>
                    ) : strategiesQuery.data && strategiesQuery.data.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {strategiesQuery.data.map((strategy) => (
                                <Card
                                    key={strategy.strategyId}
                                    className={`cursor-pointer transition-colors ${selectedStrategy === strategy.strategyId
                                        ? 'ring-2 ring-primary'
                                        : 'hover:bg-muted/50'
                                        }`}
                                    onClick={() => setSelectedStrategy(strategy.strategyId)}
                                >
                                    <CardContent className="p-4">
                                        {(() => {
                                            const parsedData = parseStrategyData(strategy)
                                            return (
                                                <>
                                                    <h3 className="font-semibold">{parsedData.name}</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        APY: {(parsedData.apy / 100).toFixed(2)}%
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        TVL: {formatAmount(parsedData.totalDeposits)} tokens
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Status: <span className={parsedData.isActive ? 'text-green-600' : 'text-red-600'}>
                                                            {parsedData.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </p>
                                                </>
                                            )
                                        })()}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Alert>
                            <AlertDescription>
                                No strategies found. Create a strategy first to enable marketplace trading.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {selectedStrategy && (
                <>
                    {/* Marketplace Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Marketplace Status</CardTitle>
                            <CardDescription>Current marketplace information for selected strategy</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {marketplacesQuery.isLoading ? (
                                <p>Loading marketplace...</p>
                            ) : currentMarketplace ? (
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <Label>Trading Fee</Label>
                                        <p className="text-lg font-semibold">{(currentMarketplace.tradingFeeBps / 100).toFixed(2)}%</p>
                                    </div>
                                    <div>
                                        <Label>Total Volume</Label>
                                        <p className="text-lg font-semibold">{formatAmount(currentMarketplace.totalVolume)}</p>
                                    </div>
                                    <div>
                                        <Label>Total Trades</Label>
                                        <p className="text-lg font-semibold">{currentMarketplace.totalTrades}</p>
                                    </div>
                                    {currentMarketplace.bestBidPrice > 0 && (
                                        <div>
                                            <Label>Best Bid</Label>
                                            <p className="text-lg font-semibold text-green-600">
                                                {formatPrice(currentMarketplace.bestBidPrice)}
                                            </p>
                                        </div>
                                    )}
                                    {currentMarketplace.bestAskPrice > 0 && (
                                        <div>
                                            <Label>Best Ask</Label>
                                            <p className="text-lg font-semibold text-red-600">
                                                {formatPrice(currentMarketplace.bestAskPrice)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Alert>
                                        <AlertDescription>
                                            No marketplace exists for this strategy. Create one to enable trading.
                                        </AlertDescription>
                                    </Alert>
                                    <div className="flex gap-4 items-end">
                                        <div className="space-y-2">
                                            <Label htmlFor="marketplace-fee">Trading Fee (basis points)</Label>
                                            <Input
                                                id="marketplace-fee"
                                                type="number"
                                                placeholder="100"
                                                value={createMarketplaceFee}
                                                onChange={(e) => setCreateMarketplaceFee(e.target.value)}
                                                className="w-40"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                100 = 1%, max 1000 = 10%
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleCreateMarketplace}
                                            disabled={createMarketplaceMutation.isPending}
                                        >
                                            {createMarketplaceMutation.isPending ? 'Creating...' : 'Create Marketplace'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {currentMarketplace && (
                        <>
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
                                                step="0.000001"
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
                                                step="0.000001"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Total Value:</span>
                                                <span>{(Number(sellAmount || 0) * Number(sellPrice || 0)).toFixed(6)} tokens</span>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleCreateSellOrder}
                                            disabled={!sellAmount || !sellPrice || placeOrderMutation.isPending}
                                            className="w-full"
                                        >
                                            {placeOrderMutation.isPending ? 'Creating...' : 'Create Sell Order'}
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
                                                step="0.000001"
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
                                                step="0.000001"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Total Cost:</span>
                                                <span>{(Number(buyAmount || 0) * Number(buyPrice || 0)).toFixed(6)} tokens</span>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleCreateBuyOrder}
                                            disabled={!buyAmount || !buyPrice || placeOrderMutation.isPending}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            {placeOrderMutation.isPending ? 'Creating...' : 'Create Buy Order'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Order Book */}
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Order Book</CardTitle>
                                            <CardDescription>Current buy and sell orders in the marketplace</CardDescription>
                                        </div>
                                        <Button
                                            onClick={findAndExecuteTrades}
                                            disabled={executeTradesMutation.isPending || !ordersQuery.data || ordersQuery.data.length === 0}
                                            variant="outline"
                                            size="sm"
                                        >
                                            {executeTradesMutation.isPending ? 'Matching...' : 'Auto-Match Orders'}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {ordersQuery.isLoading ? (
                                        <p>Loading orders...</p>
                                    ) : ordersQuery.data && ordersQuery.data.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Price</TableHead>
                                                    <TableHead>Total</TableHead>
                                                    <TableHead>Filled</TableHead>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ordersQuery.data.map((order) => (
                                                    <TableRow key={`${order.user.toString()}-${order.orderId}`}>
                                                        <TableCell>
                                                            <span className={`capitalize px-2 py-1 rounded text-xs ${order.orderType === 1
                                                                ? 'bg-red-100 text-red-800'
                                                                : 'bg-green-100 text-green-800'
                                                                }`}>
                                                                {order.orderType === 1 ? 'Sell' : 'Buy'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>{formatAmount(order.yieldTokenAmount)}</TableCell>
                                                        <TableCell>{formatPrice(order.pricePerToken)}</TableCell>
                                                        <TableCell>{formatAmount(order.totalValue)}</TableCell>
                                                        <TableCell>
                                                            {((order.filledAmount / order.yieldTokenAmount) * 100).toFixed(1)}%
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">
                                                            {order.user.toString().slice(0, 8)}...
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.user.toString() === wallet.publicKey?.toString() ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => handleCancelOrder(order.orderId)}
                                                                    disabled={cancelOrderMutation.isPending}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="outline" disabled>
                                                                    {order.orderType === 1 ? 'Buy' : 'Sell'}
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground">No active orders</p>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                Be the first to create an order!
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    )
} 
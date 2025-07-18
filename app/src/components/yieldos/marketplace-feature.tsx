'use client'

import { AppHero } from '@/components/app-hero'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import React, { useState, useEffect, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useMarketplace, useYieldosProgram, MarketplaceData, TradeOrderData } from './yieldos-data-access'
import { PublicKey } from '@solana/web3.js'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

export function MarketplaceFeature() {
    const wallet = useWallet()
    const { connection } = useConnection()
    const { strategiesQuery } = useYieldosProgram()
    const { marketplacesQuery, getOrdersQuery, createMarketplaceMutation, placeOrderMutation, cancelOrderMutation, executeTradesMutation, getMarketplaceByStrategy, getPDAs } = useMarketplace()

    const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null)
    const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceData | null>(null)
    const [sellAmount, setSellAmount] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [buyAmount, setBuyAmount] = useState('')
    const [buyPrice, setBuyPrice] = useState('')
    const [createMarketplaceFee, setCreateMarketplaceFee] = useState('100') // 1% default

    // État pour le balance des yield tokens de l'utilisateur
    const [userYieldTokenBalance, setUserYieldTokenBalance] = useState<number>(0)
    const [loadingBalance, setLoadingBalance] = useState(false)

    // État pour le balance des underlying tokens de l'utilisateur (pour buy orders)
    const [userUnderlyingTokenBalance, setUserUnderlyingTokenBalance] = useState<number>(0)
    const [loadingUnderlyingBalance, setLoadingUnderlyingBalance] = useState(false)
    const [underlyingTokenInfo, setUnderlyingTokenInfo] = useState<{
        mint: string,
        symbol: string,
        decimals: number
    } | null>(null)

    // Fonction pour récupérer le balance des yield tokens
    const fetchUserYieldTokenBalance = async () => {
        if (!wallet.publicKey || !selectedStrategy) {
            setUserYieldTokenBalance(0)
            return
        }

        setLoadingBalance(true)
        try {

            // Calculer le PDA du yield token mint
            const [yieldTokenMintPda] = getPDAs.getYieldTokenMintPda(selectedStrategy)

            // Calculer l'adresse du token account de l'utilisateur
            const userYieldTokenAccount = await getAssociatedTokenAddress(yieldTokenMintPda, wallet.publicKey)

            // Récupérer le balance
            const tokenAccount = await connection.getTokenAccountBalance(userYieldTokenAccount)
            if (tokenAccount.value) {
                setUserYieldTokenBalance(Number(tokenAccount.value.amount) / LAMPORTS_PER_SOL) // Convert from lamports
            } else {
                setUserYieldTokenBalance(0)
            }
        } catch (error) {
            console.log('No yield token balance found:', error)
            setUserYieldTokenBalance(0)
        } finally {
            setLoadingBalance(false)
        }
    }

    // Fonction pour récupérer le balance des underlying tokens
    const fetchUserUnderlyingTokenBalance = async () => {
        if (!wallet.publicKey || !selectedStrategy) {
            setUserUnderlyingTokenBalance(0)
            return
        }

        setLoadingUnderlyingBalance(true)
        try {
            // Calculer le PDA de la stratégie pour récupérer l'underlying token
            const [strategyPda] = getPDAs.getStrategyPda(selectedStrategy)
            const strategyAccount = await connection.getAccountInfo(strategyPda)

            if (!strategyAccount) {
                setUserUnderlyingTokenBalance(0)
                return
            }

            // Récupérer l'underlying token depuis la stratégie
            let underlyingTokenMint: PublicKey
            try {
                const underlyingTokenBytes = strategyAccount.data.subarray(40, 72)
                underlyingTokenMint = new PublicKey(underlyingTokenBytes)
            } catch (parseError) {
                // Fallback vers WSOL
                underlyingTokenMint = new PublicKey('So11111111111111111111111111111111111111112')
            }

            // Récupérer les informations du token
            let tokenInfo = {
                mint: underlyingTokenMint.toString(),
                symbol: 'Unknown',
                decimals: 9
            }

            // Si c'est WSOL, on peut utiliser le balance SOL natif + WSOL
            if (underlyingTokenMint.toString() === 'So11111111111111111111111111111111111111112') {
                tokenInfo.symbol = 'SOL'
                tokenInfo.decimals = 9

                const solBalance = await connection.getBalance(wallet.publicKey)

                // Aussi récupérer le balance WSOL s'il existe
                try {
                    const userWsolAccount = await getAssociatedTokenAddress(underlyingTokenMint, wallet.publicKey)
                    const wsolAccount = await connection.getTokenAccountBalance(userWsolAccount)
                    const wsolBalance = wsolAccount.value ? Number(wsolAccount.value.amount) : 0

                    const totalBalance = (solBalance + wsolBalance) / LAMPORTS_PER_SOL
                    setUserUnderlyingTokenBalance(totalBalance)
                } catch (wsolError) {
                    setUserUnderlyingTokenBalance(solBalance / LAMPORTS_PER_SOL)
                }
            } else {
                console.log('❌ Strategy uses non-SOL token:', underlyingTokenMint.toString())
                console.log('❌ This strategy should be deleted or reconfigured to use SOL/WSOL')

                // Pour debug: afficher quand même le balance du token
                const mintStr = underlyingTokenMint.toString()
                if (mintStr.startsWith('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')) {
                    tokenInfo.symbol = 'USDC'
                    tokenInfo.decimals = 6
                } else if (mintStr.startsWith('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')) {
                    tokenInfo.symbol = 'USDT'
                    tokenInfo.decimals = 6
                } else {
                    tokenInfo.symbol = `Token (${mintStr.slice(0, 8)}...)`
                }

                try {
                    const userTokenAccount = await getAssociatedTokenAddress(underlyingTokenMint, wallet.publicKey)
                    const tokenAccount = await connection.getTokenAccountBalance(userTokenAccount)
                    if (tokenAccount.value) {
                        setUserUnderlyingTokenBalance(Number(tokenAccount.value.amount) / Math.pow(10, tokenInfo.decimals))
                    } else {
                        setUserUnderlyingTokenBalance(0)
                    }
                } catch (error) {
                    setUserUnderlyingTokenBalance(0)
                }
            }

            setUnderlyingTokenInfo(tokenInfo)
        } catch (error) {
            console.error('Error fetching underlying token balance:', error)
            setUserUnderlyingTokenBalance(0)
            setUnderlyingTokenInfo(null)
        } finally {
            setLoadingUnderlyingBalance(false)
        }
    }

    // Charger les balances quand la stratégie change
    useEffect(() => {
        // Réinitialiser les infos du token
        setUnderlyingTokenInfo(null)
        fetchUserYieldTokenBalance()
        fetchUserUnderlyingTokenBalance()
    }, [wallet.publicKey, selectedStrategy])

    // Get marketplace for selected strategy
    const currentMarketplace = useMemo(() => {
        if (!selectedStrategy || !marketplacesQuery.data || !strategiesQuery.data) {
            return null
        }

        // Find the strategy data to get its PDA
        const strategyData = strategiesQuery.data.find(s => s.strategyId === selectedStrategy)

        if (!strategyData) {
            return null
        }

        // Find marketplace that matches this strategy's PDA
        const foundMarketplace = marketplacesQuery.data.find(m =>
            m.strategy.toString() === strategyData.pubkey.toString()
        )

        return foundMarketplace || null
    }, [selectedStrategy, marketplacesQuery.data, strategiesQuery.data])

    // Fallback marketplace cache
    const [directMarketplaceCache, setDirectMarketplaceCache] = useState<{ [key: number]: MarketplaceData | null }>({})

    // Final marketplace (from global search or direct lookup)
    const finalMarketplace = currentMarketplace || (selectedStrategy ? directMarketplaceCache[selectedStrategy] : null)

    // Get orders for current marketplace
    const ordersQuery = getOrdersQuery(
        finalMarketplace?.strategy
            ? getPDAs.getMarketplacePda(new PublicKey(finalMarketplace.strategy))[0]
            : null
    )

    // Auto-select first strategy and marketplace
    useEffect(() => {
        if (strategiesQuery.data && strategiesQuery.data.length > 0 && !selectedStrategy) {
            console.log('Auto-selecting first strategy:', strategiesQuery.data[0].strategyId)
            setSelectedStrategy(strategiesQuery.data[0].strategyId)
        }
    }, [strategiesQuery.data, selectedStrategy])

    useEffect(() => {
        if (finalMarketplace && !selectedMarketplace) {
            console.log('Setting current marketplace:', finalMarketplace)
            setSelectedMarketplace(finalMarketplace)
        }
    }, [finalMarketplace, selectedMarketplace])

    // Supprimé les logs de debug qui causaient la boucle infinie

    // Effect for direct marketplace lookup fallback
    useEffect(() => {
        if (selectedStrategy && !currentMarketplace && !marketplacesQuery.isLoading && !directMarketplaceCache[selectedStrategy]) {
            const tryDirectLookup = async () => {
                try {
                    const directMarketplace = await getMarketplaceByStrategy(selectedStrategy)
                    setDirectMarketplaceCache(prev => ({
                        ...prev,
                        [selectedStrategy]: directMarketplace
                    }))
                } catch (error) {
                    // Silencieux pour éviter les logs en boucle
                    setDirectMarketplaceCache(prev => ({
                        ...prev,
                        [selectedStrategy]: null
                    }))
                }
            }

            tryDirectLookup()
        }
    }, [selectedStrategy, currentMarketplace, marketplacesQuery.isLoading, getMarketplaceByStrategy, directMarketplaceCache])

    const handleCreateMarketplace = async () => {
        if (!selectedStrategy) return

        try {
            await createMarketplaceMutation.mutateAsync({
                strategyId: selectedStrategy,
                tradingFeeBps: Number(createMarketplaceFee)
            })
            // Refresh data
            await marketplacesQuery.refetch()
        } catch (error) {
            console.error('Error creating marketplace:', error)
            alert(`Error creating marketplace: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const handleRefreshData = async () => {
        await Promise.all([
            strategiesQuery.refetch(),
            marketplacesQuery.refetch()
        ])
    }

    const handleDirectMarketplaceLookup = async () => {
        if (!selectedStrategy) return

        console.log(`Testing direct marketplace lookup for strategy ${selectedStrategy}...`)
        try {
            const directMarketplace = await getMarketplaceByStrategy(selectedStrategy)
            if (directMarketplace) {
                alert(`✅ Found marketplace directly! ID: ${directMarketplace.marketplaceId}, Fee: ${directMarketplace.tradingFeeBps}bps`)
            } else {
                alert('❌ No marketplace found via direct lookup')
            }
        } catch (error) {
            console.error('Direct lookup error:', error)
            alert(`Error in direct lookup: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const handleCreateSellOrder = async () => {
        if (!sellAmount || !sellPrice || !finalMarketplace || !selectedStrategy) return

        try {
            const yieldTokenAmount = Math.floor(Number(sellAmount) * LAMPORTS_PER_SOL)
            const pricePerToken = Math.floor(Number(sellPrice) * 1000000) // 6 decimals for price

            // Calculer le vrai PDA du marketplace
            const [marketplacePda] = getPDAs.getMarketplacePda(new PublicKey(finalMarketplace.strategy))

            await placeOrderMutation.mutateAsync({
                marketplacePda,
                strategyId: selectedStrategy,
                orderType: 1, // Sell order
                yieldTokenAmount,
                pricePerToken
            })

            setSellAmount('')
            setSellPrice('')
            ordersQuery.refetch()
            fetchUserYieldTokenBalance() // Refresh balance after sell order
        } catch (error) {
            console.error('Error creating sell order:', error)
        }
    }

    const handleCreateBuyOrder = async () => {
        if (!buyAmount || !buyPrice || !finalMarketplace || !selectedStrategy) return

        try {
            const yieldTokenAmount = Math.floor(Number(buyAmount) * LAMPORTS_PER_SOL)
            const pricePerToken = Math.floor(Number(buyPrice) * 1000000) // 6 decimals for price

            // Calculer le vrai PDA du marketplace
            const [marketplacePda] = getPDAs.getMarketplacePda(new PublicKey(finalMarketplace.strategy))

            await placeOrderMutation.mutateAsync({
                marketplacePda,
                strategyId: selectedStrategy,
                orderType: 0, // Buy order
                yieldTokenAmount,
                pricePerToken
            })

            setBuyAmount('')
            setBuyPrice('')
            ordersQuery.refetch()
            fetchUserUnderlyingTokenBalance() // Refresh balance after buy order
        } catch (error) {
            console.error('Error creating buy order:', error)
        }
    }

    const handleCancelOrder = async (orderId: number) => {
        if (!finalMarketplace || !selectedStrategy) return

        try {
            // Calculer le vrai PDA du marketplace
            const [marketplacePda] = getPDAs.getMarketplacePda(new PublicKey(finalMarketplace.strategy))

            await cancelOrderMutation.mutateAsync({
                orderId,
                marketplacePda,
                strategyId: selectedStrategy
            })
            ordersQuery.refetch()
            fetchUserYieldTokenBalance() // Refresh balance after cancel order
            fetchUserUnderlyingTokenBalance() // Refresh underlying balance too
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
        if (!ordersQuery.data || !finalMarketplace || !selectedStrategy) return

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

                            // Calculer le vrai PDA du marketplace
                            const [marketplacePda] = getPDAs.getMarketplacePda(new PublicKey(finalMarketplace.strategy))

                            await executeTradesMutation.mutateAsync({
                                buyOrderPda,
                                sellOrderPda,
                                tradeAmount,
                                marketplacePda,
                                strategyId: selectedStrategy
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
                        <div className="flex gap-2">
                            <Button onClick={handleRefreshData} variant="outline" size="sm">
                                Refresh Data
                            </Button>
                            {selectedStrategy && (
                                <Button onClick={handleDirectMarketplaceLookup} variant="outline" size="sm">
                                    Test Direct Lookup
                                </Button>
                            )}
                        </div>
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
                            ) : finalMarketplace ? (
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <Label>Trading Fee</Label>
                                        <p className="text-lg font-semibold">{(finalMarketplace.tradingFeeBps / 100).toFixed(2)}%</p>
                                    </div>
                                    <div>
                                        <Label>Total Volume</Label>
                                        <p className="text-lg font-semibold">{formatAmount(finalMarketplace.totalVolume)}</p>
                                    </div>
                                    <div>
                                        <Label>Total Trades</Label>
                                        <p className="text-lg font-semibold">{finalMarketplace.totalTrades}</p>
                                    </div>
                                    {finalMarketplace.bestBidPrice > 0 && (
                                        <div>
                                            <Label>Best Bid</Label>
                                            <p className="text-lg font-semibold text-green-600">
                                                {formatPrice(finalMarketplace.bestBidPrice)}
                                            </p>
                                        </div>
                                    )}
                                    {finalMarketplace.bestAskPrice > 0 && (
                                        <div>
                                            <Label>Best Ask</Label>
                                            <p className="text-lg font-semibold text-red-600">
                                                {formatPrice(finalMarketplace.bestAskPrice)}
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

                    {finalMarketplace && (
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
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="sell-amount">Amount (YLD tokens)</Label>
                                                <div className="text-sm text-gray-500">
                                                    {loadingBalance ? 'Loading...' : `Balance: ${userYieldTokenBalance.toFixed(6)}`}
                                                    {userYieldTokenBalance > 0 && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="ml-2 h-auto p-0 text-xs"
                                                            onClick={() => setSellAmount(userYieldTokenBalance.toString())}
                                                        >
                                                            Max
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <Input
                                                id="sell-amount"
                                                type="number"
                                                placeholder="0.0"
                                                value={sellAmount}
                                                onChange={(e) => setSellAmount(e.target.value)}
                                                step="0.000001"
                                                max={userYieldTokenBalance}
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
                                                <span>{(Number(sellAmount || 0) * Number(sellPrice || 0)).toFixed(underlyingTokenInfo?.decimals || 6)} {underlyingTokenInfo?.symbol || 'tokens'}</span>
                                            </div>
                                            {Number(sellAmount || 0) > userYieldTokenBalance && (
                                                <div className="text-xs text-red-500">
                                                    Insufficient balance. You need {Number(sellAmount || 0).toFixed(6)} YLD tokens but only have {userYieldTokenBalance.toFixed(6)} YLD tokens.
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleCreateSellOrder}
                                            disabled={
                                                !sellAmount ||
                                                !sellPrice ||
                                                placeOrderMutation.isPending ||
                                                Number(sellAmount || 0) > userYieldTokenBalance
                                            }
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
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="buy-amount">Amount (YLD tokens)</Label>
                                                <div className="text-sm text-gray-500">
                                                    {loadingUnderlyingBalance ? 'Loading...' : `Balance: ${userUnderlyingTokenBalance.toFixed(underlyingTokenInfo?.decimals || 6)} ${underlyingTokenInfo?.symbol || 'tokens'}`}
                                                    {userUnderlyingTokenBalance > 0 && buyPrice && Number(buyPrice) > 0 && (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="ml-2 h-auto p-0 text-xs"
                                                            onClick={() => {
                                                                const maxAmount = userUnderlyingTokenBalance / Number(buyPrice)
                                                                setBuyAmount(maxAmount.toFixed(6))
                                                            }}
                                                        >
                                                            Max
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
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
                                                <span>{(Number(buyAmount || 0) * Number(buyPrice || 0)).toFixed(underlyingTokenInfo?.decimals || 6)} {underlyingTokenInfo?.symbol || 'tokens'}</span>
                                            </div>
                                            {(Number(buyAmount || 0) * Number(buyPrice || 0)) > userUnderlyingTokenBalance && (
                                                <div className="text-xs text-red-500">
                                                    Insufficient balance. You need {(Number(buyAmount || 0) * Number(buyPrice || 0)).toFixed(underlyingTokenInfo?.decimals || 6)} {underlyingTokenInfo?.symbol || 'tokens'} but only have {userUnderlyingTokenBalance.toFixed(underlyingTokenInfo?.decimals || 6)} {underlyingTokenInfo?.symbol || 'tokens'}.
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleCreateBuyOrder}
                                            disabled={
                                                !buyAmount ||
                                                !buyPrice ||
                                                placeOrderMutation.isPending ||
                                                (Number(buyAmount || 0) * Number(buyPrice || 0)) > userUnderlyingTokenBalance
                                            }
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
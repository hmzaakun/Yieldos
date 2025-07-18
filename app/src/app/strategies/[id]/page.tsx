import { StrategyDetailFeature } from '@/components/yieldos/strategy-detail-feature'

interface StrategyDetailPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function StrategyDetailPage({ params }: StrategyDetailPageProps) {
    const resolvedParams = await params
    const strategyId = parseInt(resolvedParams.id)

    return <StrategyDetailFeature strategyId={strategyId} />
} 
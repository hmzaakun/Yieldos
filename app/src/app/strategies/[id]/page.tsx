import { StrategyDetailFeature } from '@/components/yieldos/strategy-detail-feature'

interface StrategyDetailPageProps {
    params: {
        id: string
    }
}

export default function StrategyDetailPage({ params }: StrategyDetailPageProps) {
    const strategyId = parseInt(params.id)

    return <StrategyDetailFeature strategyId={strategyId} />
} 
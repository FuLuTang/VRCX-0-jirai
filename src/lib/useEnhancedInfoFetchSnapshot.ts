import { useEffect, useState } from 'react';

import {
    getEnhancedInfoFetchSnapshot,
    subscribeEnhancedInfoFetch
} from '@/services/enhancedInfoFetchService';

export function useEnhancedInfoFetchSnapshot() {
    const [snapshot, setSnapshot] = useState(getEnhancedInfoFetchSnapshot);
    useEffect(() => {
        const unsubscribe = subscribeEnhancedInfoFetch(setSnapshot);
        // Catch changes between render and subscription.
        setSnapshot(getEnhancedInfoFetchSnapshot());
        return unsubscribe;
    }, []);
    return snapshot;
}

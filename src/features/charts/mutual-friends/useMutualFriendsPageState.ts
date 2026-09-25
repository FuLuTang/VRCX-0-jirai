import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commands } from '@/platform/tauri/bindings';
import mutualGraphPersistenceRepository from '@/repositories/mutualGraphPersistenceRepository';
import { openUserDialog } from '@/services/dialogService';
import { toast } from '@/services/toastService';
import { useModalStore } from '@/state/modalStore';
import { useMutualGraphRevisionStore } from '@/state/mutualGraphRevisionStore';

import { assignMutualFriendCommunities } from './mutualFriendsCommunities';
import {
    applyMutualFriendsViewFilters,
    countIsolatedMutualFriendNodes,
    countUnknownMutualFriendNodes,
    hideNonFriendNodes
} from './mutualFriendsFilters';
import {
    buildMutualFriendsBaseGraph,
    buildMutualFriendsCoverage
} from './mutualFriendsGraphData';
import {
    mutualFriendsCommunityPalette,
    mutualFriendsNeutralCommunityColor
} from './mutualFriendsPalette';
import { buildMutualFriendExcludePickerOptions } from './mutualFriendsPicker';
import {
    normalizeExcludedMutualFriendIds,
    normalizeMutualFriendId,
    readExcludedMutualFriendIds,
    writeExcludedMutualFriendIds
} from './mutualFriendsSettings';
import { useMutualFriendsGraphFetch } from './useMutualFriendsGraphFetch';
import { useMutualFriendsLayoutSettings } from './useMutualFriendsLayoutSettings';
import { useMutualFriendsRuntime } from './useMutualFriendsRuntime';
import { useMutualFriendsSigmaLifecycle } from './useMutualFriendsSigmaLifecycle';
import { useMutualFriendsSnapshot } from './useMutualFriendsSnapshot';
import { useMutualFriendsViewFilters } from './useMutualFriendsViewFilters';

export function useMutualFriendsPageState() {
    const { t } = useTranslation();
    const confirm = useModalStore((state) => state.confirm);
    const {
        currentUserId,
        friendsById,
        friendLabelsById,
        orderedFriendIds,
        resolvedTheme
    } = useMutualFriendsRuntime();
    const currentUserIdRef = useRef(currentUserId);
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const selectedNodeIdRef = useRef('');
    const [excludedFriendIds, setExcludedFriendIds] = useState(
        readExcludedMutualFriendIds
    );
    const [nodeRefreshId, setNodeRefreshId] = useState('');
    const [showNonFriends, setShowNonFriends] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const backfillRevision = useMutualGraphRevisionStore((state) =>
        state.ownerUserId === currentUserId ? state.revision : 0
    );
    const { layoutSettings, resetLayoutSettings, setLayoutSetting } =
        useMutualFriendsLayoutSettings();
    const {
        filters,
        crossCommunityOnly,
        setSearchQuery,
        setMinDegree,
        toggleFocusedCommunity,
        toggleCrossCommunityOnly,
        clearFilters
    } = useMutualFriendsViewFilters();

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    const snapshot = useMutualFriendsSnapshot({
        currentUserId,
        currentUserIdRef,
        reloadToken: reloadToken + backfillRevision
    });

    useEffect(() => {
        writeExcludedMutualFriendIds(excludedFriendIds);
    }, [excludedFriendIds]);

    const baseGraph = useMemo(
        () =>
            buildMutualFriendsBaseGraph(
                snapshot.snapshotData.snapshot,
                snapshot.snapshotData.meta,
                friendLabelsById,
                excludedFriendIds,
                snapshot.snapshotData.historicalLinks,
                snapshot.snapshotData.trackedUsers,
                snapshot.snapshotData.manualLinks
            ),
        [
            excludedFriendIds,
            friendLabelsById,
            snapshot.snapshotData.historicalLinks,
            snapshot.snapshotData.trackedUsers,
            snapshot.snapshotData.manualLinks,
            snapshot.snapshotData.meta,
            snapshot.snapshotData.snapshot
        ]
    );
    const visibleBaseGraph = useMemo(
        () =>
            hideNonFriendNodes(
                baseGraph,
                new Set(Object.keys(friendsById)),
                showNonFriends
            ),
        [baseGraph, friendsById, showNonFriends]
    );

    const communityPalette = useMemo(
        () => mutualFriendsCommunityPalette(resolvedTheme === 'dark'),
        [resolvedTheme]
    );
    const neutralCommunityColor = useMemo(
        () => mutualFriendsNeutralCommunityColor(resolvedTheme === 'dark'),
        [resolvedTheme]
    );

    const { communityIndexById, communities } = useMemo(
        () =>
            assignMutualFriendCommunities(
                visibleBaseGraph,
                communityPalette,
                neutralCommunityColor
            ),
        [visibleBaseGraph, communityPalette, neutralCommunityColor]
    );

    const namedCommunityIndexes = useMemo(
        () =>
            new Set(
                communities
                    .filter((community) => community.isNamed)
                    .map((community) => community.index)
            ),
        [communities]
    );

    const coverage = useMemo(
        () =>
            buildMutualFriendsCoverage(
                snapshot.snapshotData.meta,
                orderedFriendIds
            ),
        [orderedFriendIds, snapshot.snapshotData.meta]
    );

    const filteredGraph = useMemo(
        () =>
            applyMutualFriendsViewFilters(
                visibleBaseGraph,
                filters,
                communityIndexById
            ),
        [visibleBaseGraph, communityIndexById, filters]
    );

    const excludePickerOptions = useMemo(
        () =>
            buildMutualFriendExcludePickerOptions(
                snapshot.snapshotData.snapshot,
                friendsById,
                currentUserId,
                snapshot.snapshotData.trackedUsers,
                snapshot.snapshotData.manualLinks,
                snapshot.snapshotData.historicalLinks
            ),
        [
            currentUserId,
            friendsById,
            snapshot.snapshotData.historicalLinks,
            snapshot.snapshotData.manualLinks,
            snapshot.snapshotData.snapshot,
            snapshot.snapshotData.trackedUsers
        ]
    );

    const normalizedExcludedFriendIds = useMemo(
        () => normalizeExcludedMutualFriendIds(excludedFriendIds),
        [excludedFriendIds]
    );

    const selectedNode = useMemo(
        () =>
            visibleBaseGraph.nodes.find((node) => node.id === selectedNodeId) ??
            null,
        [visibleBaseGraph.nodes, selectedNodeId]
    );

    useEffect(() => {
        if (
            !selectedNodeIdRef.current ||
            filteredGraph.nodes.some(
                (node) => node.id === selectedNodeIdRef.current
            )
        ) {
            return;
        }
        selectedNodeIdRef.current = '';
        setSelectedNodeId('');
    }, [filteredGraph.nodes]);

    const openNode = useCallback(
        (nodeId: string) => {
            const node = baseGraph.nodes.find((item) => item.id === nodeId);
            openUserDialog({ userId: nodeId, title: node?.label });
        },
        [baseGraph.nodes]
    );

    const handleSelectNode = useCallback((nodeId: string) => {
        const nextValue = normalizeMutualFriendId(nodeId);
        selectedNodeIdRef.current = nextValue;
        setSelectedNodeId(nextValue);
    }, []);

    const sigma = useMutualFriendsSigmaLifecycle({
        graph: filteredGraph,
        layoutSettings,
        communityIndexById,
        namedCommunityIndexes,
        resolvedTheme,
        crossCommunityOnly,
        selectedNodeId,
        selectedNodeIdRef,
        onSelectNode: handleSelectNode,
        onOpenNode: openNode
    });

    const { fetchProgress, handleCancelFetch, handleFetchGraph } =
        useMutualFriendsGraphFetch({
            currentUserId,
            trackedUserIds: snapshot.snapshotData.trackedUsers.map(
                (user) => user.userId
            ),
            reloadSnapshot: snapshot.reloadSnapshot,
            setDetail: snapshot.setDetail
        });

    function toggleExcludedFriendId(friendId: string) {
        const normalizedId = normalizeMutualFriendId(friendId);
        if (!normalizedId) {
            return;
        }
        setExcludedFriendIds((current) => {
            const normalizedCurrent = normalizeExcludedMutualFriendIds(current);
            return normalizedCurrent.includes(normalizedId)
                ? normalizedCurrent.filter((id) => id !== normalizedId)
                : [...normalizedCurrent, normalizedId];
        });
    }

    async function setTrackedUser(
        userId: string,
        displayName: string,
        tracked: boolean
    ) {
        if (!currentUserId || !userId) {
            return;
        }
        try {
            await mutualGraphPersistenceRepository.setTrackedUser(
                currentUserId,
                userId,
                displayName,
                tracked
            );
            await snapshot.reloadSnapshot('', currentUserId);
        } catch (error) {
            toast.add({
                type: 'error',
                title:
                    error instanceof Error
                        ? error.message
                        : t(
                              'view.charts.toast.failed_to_save_mutual_graph_settings'
                          )
            });
        }
    }

    async function setManualLink(
        userIdA: string,
        userIdB: string,
        related: boolean
    ) {
        if (!currentUserId || !userIdA || !userIdB || userIdA === userIdB) {
            return;
        }
        try {
            await mutualGraphPersistenceRepository.setManualLink(
                currentUserId,
                userIdA,
                userIdB,
                related
            );
            await snapshot.reloadSnapshot('', currentUserId);
        } catch (error) {
            toast.add({
                type: 'error',
                title:
                    error instanceof Error
                        ? error.message
                        : t(
                              'view.charts.toast.failed_to_save_mutual_graph_settings'
                          )
            });
        }
    }

    async function handleRefreshSelectedNode() {
        if (!currentUserId || !selectedNode?.id || nodeRefreshId) {
            return;
        }
        const ownerUserId = currentUserId;

        if (!friendsById[selectedNode.id]) {
            const result = await confirm({
                title: t('view.charts.modal.refresh_non_friend_mutuals'),
                description: t(
                    'view.charts.modal.this_node_is_not_currently_in_the_friend_roster_continue_refreshing_its_mutual_friends_cache'
                ),
                confirmText: t('common.actions.refresh'),
                cancelText: t('common.actions.cancel')
            });
            if (!result.ok) {
                return;
            }
        }

        setNodeRefreshId(selectedNode.id);
        try {
            const result = await commands.appMutualGraphFriendRefresh({
                ownerUserId,
                friendId: selectedNode.id
            });
            if (currentUserIdRef.current !== ownerUserId) {
                return;
            }
            await snapshot.reloadSnapshot('', ownerUserId);
            if (result.status === 'optedOut') {
                toast.add({
                    type: 'warning',
                    title: t(
                        'view.charts.dynamic.could_not_load_mutuals_for_value',
                        {
                            value: selectedNode.label
                        }
                    )
                });
            } else {
                toast.add({
                    type: 'success',
                    title: t(
                        'view.charts.dynamic.refreshed_mutuals_for_value',
                        {
                            value: selectedNode.label
                        }
                    )
                });
            }
        } catch (error) {
            toast.add({
                type: 'error',
                title:
                    error instanceof Error
                        ? error.message
                        : t(
                              'view.charts.toast.failed_to_refresh_selected_mutuals'
                          )
            });
        } finally {
            setNodeRefreshId('');
        }
    }

    function handleResetLayoutAndHidden() {
        resetLayoutSettings();
        setExcludedFriendIds([]);
        clearFilters();
    }

    return {
        actions: {
            cancelFetch: handleCancelFetch,
            clearFilters,
            fetchGraph: handleFetchGraph,
            openNode,
            refreshPage: () => setReloadToken((value) => value + 1),
            refreshSelectedNode: handleRefreshSelectedNode,
            resetLayoutAndHidden: handleResetLayoutAndHidden,
            clearSelection: () => handleSelectNode(''),
            setMinDegree,
            setSearchQuery,
            setManualLink,
            setTrackedUser,
            toggleNonFriends: () => setShowNonFriends((value) => !value),
            toggleCrossCommunityOnly,
            toggleExcludedFriendId,
            toggleFocusedCommunity
        },
        exclusions: {
            excludePickerOptions,
            excludedFriendIds: normalizedExcludedFriendIds,
            setExcludedFriendIds: (next: string[]) =>
                setExcludedFriendIds(normalizeExcludedMutualFriendIds(next))
        },
        fetch: {
            fetchProgress
        },
        graph: {
            baseNodeCount: visibleBaseGraph.nodes.length,
            communities,
            communityIndexById,
            coverage,
            currentUserId,
            showNonFriends,
            resolvedTheme,
            trackedUsers: snapshot.snapshotData.trackedUsers,
            manualLinks: snapshot.snapshotData.manualLinks,
            detail: snapshot.detail,
            edgeCount: filteredGraph.links.length,
            friendCount: orderedFriendIds.length,
            isolatedCounts: countIsolatedMutualFriendNodes(visibleBaseGraph),
            unknownCount: countUnknownMutualFriendNodes(visibleBaseGraph),
            isLayoutRunning: sigma.isLayoutRunning,
            nodeCount: filteredGraph.nodes.length,
            setGraphElementRef: sigma.setGraphElementRef,
            status: snapshot.status
        },
        layout: {
            layoutSettings,
            setLayoutSetting
        },
        selection: {
            communityIndex: selectedNode
                ? (communityIndexById.get(selectedNode.id) ?? null)
                : null,
            isRefreshing: Boolean(
                selectedNode && nodeRefreshId === selectedNode.id
            ),
            node: selectedNode,
            isCurrentFriend: selectedNode
                ? Boolean(friendsById[selectedNode.id])
                : false,
            user: selectedNode ? (friendsById[selectedNode.id] ?? null) : null
        },
        view: {
            crossCommunityOnly,
            filters
        }
    };
}

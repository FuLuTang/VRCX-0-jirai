import { PageScaffold } from '@/components/layout/PageScaffold';

import { MutualFriendsHud } from './components/mutual-friends/MutualFriendsHud';
import { MutualFriendsLegend } from './components/mutual-friends/MutualFriendsLegend';
import { MutualFriendsManagementSheets } from './components/mutual-friends/MutualFriendsManagementSheets';
import { MutualFriendsNodeCard } from './components/mutual-friends/MutualFriendsNodeCard';
import { MutualFriendsSettingsSheet } from './components/mutual-friends/MutualFriendsSettingsSheet';
import {
    MutualFriendsLayoutBadge,
    MutualFriendsStageOverlay
} from './components/mutual-friends/MutualFriendsStageOverlay';
import { useMutualFriendsPageState } from './mutual-friends/useMutualFriendsPageState';

export function MutualFriendsPage() {
    const { actions, exclusions, fetch, graph, layout, selection, view } =
        useMutualFriendsPageState();

    const hasActiveFilters = Boolean(
        view.filters.searchQuery ||
        view.filters.minDegree > 0 ||
        view.filters.focusedCommunity !== null
    );
    const selectedNode = selection.node;
    const selectedCommunity =
        selection.communityIndex === null
            ? null
            : (graph.communities.find(
                  (community) => community.index === selection.communityIndex
              ) ?? null);

    return (
        <PageScaffold id="chart" className="p-0">
            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div
                    ref={graph.setGraphElementRef}
                    className="absolute inset-0"
                />

                <MutualFriendsHud
                    baseNodeCount={graph.baseNodeCount}
                    canFetch={Boolean(graph.currentUserId)}
                    fetchProgress={fetch.fetchProgress}
                    isReloading={
                        graph.status === 'running' && graph.baseNodeCount > 0
                    }
                    onCancelFetch={actions.cancelFetch}
                    onFetchGraph={actions.fetchGraph}
                    managementSlots={
                        <MutualFriendsManagementSheets
                            manualLinks={graph.manualLinks}
                            onSetManualLink={actions.setManualLink}
                            onSetTrackedUser={actions.setTrackedUser}
                            options={exclusions.excludePickerOptions}
                            trackedUsers={graph.trackedUsers}
                        />
                    }
                    onToggleNonFriends={actions.toggleNonFriends}
                    onRefreshPage={actions.refreshPage}
                    onSearchQueryChange={actions.setSearchQuery}
                    showNonFriends={graph.showNonFriends}
                    searchQuery={view.filters.searchQuery}
                    settingsSlot={
                        <MutualFriendsSettingsSheet
                            edgeCount={graph.edgeCount}
                            excludePickerOptions={
                                exclusions.excludePickerOptions
                            }
                            excludedFriendIds={exclusions.excludedFriendIds}
                            layoutSettings={layout.layoutSettings}
                            nodeCount={graph.nodeCount}
                            onExcludedFriendIdsChange={
                                exclusions.setExcludedFriendIds
                            }
                            onResetLayoutAndHidden={
                                actions.resetLayoutAndHidden
                            }
                            setLayoutSetting={layout.setLayoutSetting}
                        />
                    }
                />

                {graph.isLayoutRunning && graph.nodeCount ? (
                    <MutualFriendsLayoutBadge />
                ) : null}

                {graph.baseNodeCount > 0 && graph.nodeCount > 0 ? (
                    <MutualFriendsLegend
                        communities={graph.communities}
                        coverage={graph.coverage}
                        crossCommunityOnly={view.crossCommunityOnly}
                        focusedCommunity={view.filters.focusedCommunity}
                        isolatedCounts={graph.isolatedCounts}
                        isDarkMode={graph.resolvedTheme === 'dark'}
                        minDegree={view.filters.minDegree}
                        onMinDegreeChange={actions.setMinDegree}
                        onToggleCrossCommunityOnly={
                            actions.toggleCrossCommunityOnly
                        }
                        onToggleFocusedCommunity={
                            actions.toggleFocusedCommunity
                        }
                        unknownCount={graph.unknownCount}
                    />
                ) : null}

                {selectedNode ? (
                    <MutualFriendsNodeCard
                        community={selectedCommunity}
                        isCurrentFriend={selection.isCurrentFriend}
                        isRefreshing={selection.isRefreshing}
                        isTracked={graph.trackedUsers.some(
                            (user) => user.userId === selectedNode.id
                        )}
                        node={selectedNode}
                        onClose={actions.clearSelection}
                        onFocusCommunity={() => {
                            if (selection.communityIndex !== null) {
                                actions.toggleFocusedCommunity(
                                    selection.communityIndex
                                );
                            }
                        }}
                        onHide={() =>
                            actions.toggleExcludedFriendId(selectedNode.id)
                        }
                        onOpenProfile={() => actions.openNode(selectedNode.id)}
                        onRefresh={actions.refreshSelectedNode}
                        onToggleTracked={() =>
                            actions.setTrackedUser(
                                selectedNode.id,
                                selectedNode.label,
                                !graph.trackedUsers.some(
                                    (user) => user.userId === selectedNode.id
                                )
                            )
                        }
                        user={selection.user}
                    />
                ) : null}

                <MutualFriendsStageOverlay
                    baseNodeCount={graph.baseNodeCount}
                    detail={graph.detail}
                    hasActiveFilters={hasActiveFilters}
                    nodeCount={graph.nodeCount}
                    onLoadConnections={actions.fetchGraph}
                    onClearFilters={actions.clearFilters}
                    status={graph.status}
                />
            </div>
        </PageScaffold>
    );
}

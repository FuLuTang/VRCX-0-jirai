import { isRealInstance } from '@/shared/utils/instance';
import { normalizeLocationValue, parseLocation } from '@/shared/utils/location';

export type HistoryDiffLine = {
    type: 'equal' | 'add' | 'remove';
    text: string;
};

function normalizeHistoryText(value: unknown): string {
    return typeof value === 'string' ? value : String(value ?? '');
}

export function getHistoryValue(row: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = row?.[key];
        if (value != null && value !== '') {
            return value;
        }
    }
    return '';
}

export function getHistoryDateMs(row: Record<string, unknown>) {
    const createdAt = normalizeHistoryText(
        getHistoryValue(row, ['createdAt', 'created_at'])
    );
    const timestamp = Date.parse(createdAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getHistoryLocation(row: Record<string, unknown>) {
    return normalizeLocationValue(
        getHistoryValue(row, ['location', 'worldName', 'world_name'])
    );
}

export function isConcreteHistoryLocation(location: unknown) {
    const normalized = normalizeLocationValue(location);
    if (!normalized || !isRealInstance(normalized)) {
        return false;
    }
    const parsed = parseLocation(normalized);
    return Boolean(parsed.worldId && parsed.instanceId);
}

export function getHistoryDurationMs(row: Record<string, unknown>) {
    const duration = Number(getHistoryValue(row, ['time'])) || 0;
    return duration > 0 ? duration : 0;
}

export function formatDurationMs(durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return '0s';
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [] as string[];
    if (hours) {
        parts.push(`${hours}h`);
    }
    if (minutes) {
        parts.push(`${minutes}m`);
    }
    if (!parts.length || seconds) {
        parts.push(`${seconds}s`);
    }
    return parts.join(' ');
}

function buildLcsTable(left: string[], right: string[]) {
    const rows = left.length;
    const cols = right.length;
    const table = Array.from({ length: rows + 1 }, () =>
        Array.from({ length: cols + 1 }, () => 0)
    );

    for (let row = rows - 1; row >= 0; row -= 1) {
        for (let col = cols - 1; col >= 0; col -= 1) {
            table[row][col] =
                left[row] === right[col]
                    ? table[row + 1][col + 1] + 1
                    : Math.max(table[row + 1][col], table[row][col + 1]);
        }
    }

    return table;
}

export function buildLineDiff(previousText: unknown, currentText: unknown) {
    const left = normalizeHistoryText(previousText).split(/\r?\n/);
    const right = normalizeHistoryText(currentText).split(/\r?\n/);
    if (left.length === 1 && right.length === 1 && left[0] === right[0]) {
        return [{ type: 'equal', text: left[0] }] as HistoryDiffLine[];
    }

    const table = buildLcsTable(left, right);
    const lines: HistoryDiffLine[] = [];
    let row = 0;
    let col = 0;

    while (row < left.length && col < right.length) {
        if (left[row] === right[col]) {
            lines.push({ type: 'equal', text: left[row] });
            row += 1;
            col += 1;
            continue;
        }

        if (table[row + 1][col] >= table[row][col + 1]) {
            lines.push({ type: 'remove', text: left[row] });
            row += 1;
        } else {
            lines.push({ type: 'add', text: right[col] });
            col += 1;
        }
    }

    while (row < left.length) {
        lines.push({ type: 'remove', text: left[row] });
        row += 1;
    }

    while (col < right.length) {
        lines.push({ type: 'add', text: right[col] });
        col += 1;
    }

    return lines;
}

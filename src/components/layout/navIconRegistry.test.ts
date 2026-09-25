import {
    ArrowLeftRightIcon,
    DatabaseBackupIcon,
    TrendingUpIcon
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { toolDefinitionMap } from '@/shared/constants/tools';

import { getNavIconComponent } from './navIconRegistry';

describe('navigation icon registry', () => {
    it('resolves the relationship chart icons instead of falling back to Circle', () => {
        expect(getNavIconComponent('lucide:ArrowLeftRight')).toBe(
            ArrowLeftRightIcon
        );
        expect(getNavIconComponent('lucide:TrendingUp')).toBe(TrendingUpIcon);
    });

    it('resolves the profile backup tool icon', () => {
        const tool = toolDefinitionMap.get('profile-backup');

        expect(getNavIconComponent(tool?.navIcon)).toBe(DatabaseBackupIcon);
    });
});

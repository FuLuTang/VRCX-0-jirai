import {
    ArrowLeftRightIcon,
    DatabaseBackupIcon,
    TrendingUpIcon
} from 'lucide-react';
import { CircleIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_NAV_ICON_KEY,
    NAV_ICON_OPTIONS
} from '@/shared/constants/navIcons';
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

    it.each(
        NAV_ICON_OPTIONS.filter((option) => option.key !== DEFAULT_NAV_ICON_KEY)
    )('resolves the selectable $key icon to its own component', ({ key }) => {
        expect(getNavIconComponent(key)).not.toBe(CircleIcon);
    });

    it.each([...toolDefinitionMap.values()])(
        'resolves the $key tool icon to its own component',
        ({ navIcon }) => {
            expect(getNavIconComponent(navIcon)).not.toBe(CircleIcon);
        }
    );
});

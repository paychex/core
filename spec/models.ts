import * as expect from 'expect';
import { spy } from './index';
import { collection } from '../models/index';
import {
    withOrdering,
    withFiltering,
    withSelection,
    withGrouping,
    withPaging,
    withActive,
    withUnique,
    withUpdating,
} from '../models/utils';

import type { ModelCollection } from '../models';
import type { ActiveModelCollection, FilteredModelCollection, GroupedModelCollection, OrderedModelCollection, PagedModelCollection, SelectionModelCollection, UniqueModelCollection, UpdatingModelCollection } from '../models/utils';

describe('models', () => {

    let list: ModelCollection;
    beforeEach(() => list = collection());

    describe('collection', () => {

        it('has expected methods', () => {
            ['items', 'add', 'remove', 'clear', 'on', 'one', 'fire']
                .forEach((method: 'items'|'add'|'remove'|'clear'|'on'|'one'|'fire') =>
                    expect(list[method]).toBeInstanceOf(Function));
        });

        it('adds items', () => {
            list.add(1, 2, 3);
            expect(list.items()).toEqual([1, 2, 3]);
        });

        it('add fires items-add', () => {
            const handler = spy();
            list.on('items-add', handler);
            list.add(1, 2, 3);
            expect(handler.context).toBe(list);
            expect(handler.args[0]).toEqual([1, 2, 3]);
        });

        it('add nothing does not fire items-add', () => {
            const handler = spy();
            list.on('items-add', handler);
            list.add();
            expect(handler.called).toBe(false);
        });

        it('adds factory arguments', () => {
            list = collection(1, 2, 3);
            expect(list.items()).toEqual([1, 2, 3]);
        });

        it('is iterable', () => {
            list.add(1, 2, 3);
            expect(Array.from(list)).toEqual([1, 2, 3]);
        });

        it('items returns shallow copy', () => {
            list.add(1, 2, 3);
            const items1 = list.items();
            const items2 = list.items();
            expect(items1).toEqual(items2);
            expect(items1).not.toBe(items2);
        });

        it('removes specified items', () => {
            list.add(1, 2, 3);
            list.remove(2, 3);
            expect(list.items()).toEqual([1]);
        });

        it('remove fires items-remove', () => {
            const handler = spy();
            list.on('items-remove', handler);
            list.add(1, 2, 3);
            list.remove(2, 3);
            expect(handler.context).toBe(list);
            expect(handler.args[0]).toEqual([2, 3]);
        });

        it('remove nothing does not fire items-remove', () => {
            const handler = spy();
            list.on('items-remove', handler);
            list.remove();
            expect(handler.called).toBe(false);
        });

        it('clears entire collection', () => {
            list.add(1, 2, 3);
            list.clear();
            expect(list.items()).toEqual([]);
        });

        it('clear fires items-remove', () => {
            const handler = spy();
            list.on('items-remove', handler);
            list.add(1, 2, 3);
            list.clear();
            expect(handler.context).toBe(list);
            expect(handler.args[0]).toEqual([1, 2, 3]);
        });

        it('clear nothing does not fire items-remove', () => {
            const handler = spy();
            list.on('items-remove', handler);
            list.clear();
            expect(handler.called).toBe(false);
        });

    });

    describe('utils', () => {

        describe('withOrdering', () => {

            let outer: OrderedModelCollection;
            beforeEach(() => outer = withOrdering(list));

            it('has expected methods', () => {
                ['items', 'orderBy'].forEach((method: 'items'|'orderBy') => {
                    expect(outer[method]).toBeInstanceOf(Function);
                });
            });

            it('sorts underlying list', () => {
                outer.add(3, 1, 2);
                expect(outer.items()).toEqual([1, 2, 3]);
            });

            it('accepts custom orderer (factory)', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'c' };
                outer = withOrdering(outer, ['key'], ['desc']);
                outer.add(a, c, b);
                expect(outer.items()).toEqual([c, b, a]);
            });

            it('updates custom orderer (method)', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'c' };
                outer.orderBy(['key'], ['desc']);
                outer.add(a, c, b);
                expect(outer.items()).toEqual([c, b, a]);
            });

            it('handles mutations', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'c' };
                outer = withOrdering(outer, ['key'], ['desc']);
                outer.add(a, c, b);
                expect(outer.items()).toEqual([c, b, a]);
                a.key = 'd';
                expect(outer.items()).toEqual([a, c, b]);
            });

            it('fires order-change', () => {
                const handler = spy();
                outer.on('order-change', handler);
                outer.orderBy(['key']);
                expect(handler.called).toBe(true);
            });

        });

        describe('withFiltering', () => {

            let outer: FilteredModelCollection;
            beforeEach(() => outer = withFiltering(list));

            it('has expected methods', () => {
                ['items', 'filterBy'].forEach((method: 'items'|'filterBy') =>
                    expect(outer[method]).toBeInstanceOf(Function));
            });

            it('filters underlying list', () => {
                outer.add(0, 1, 2);
                expect(outer.items()).toEqual([1, 2]);
            });

            it('accepts custom filter (factory)', () => {
                const isOdd = (num: number) => num % 2;
                outer = withFiltering(outer, isOdd);
                outer.add(1, 2, 3);
                expect(outer.items()).toEqual([1, 3]);
            });

            it('accepts custom filter (method)', () => {
                const isOdd = (num: number) => num % 2;
                outer.filterBy(isOdd);
                outer.add(1, 2, 3);
                expect(outer.items()).toEqual([1, 3]);
            });

            it('resets filtering', () => {
                const isOdd = (num: number) => num % 2;
                outer.filterBy(isOdd);
                outer.add(1, 2, 3);
                expect(outer.items()).toEqual([1, 3]);
                outer.filterBy();
                expect(outer.items()).toEqual([1, 2, 3]);
            });

            it('handles mutations', () => {
                const isOdd = ({ num }: any) => num % 2;
                const a = { num: 1 };
                const b = { num: 2 };
                const c = { num: 3 };
                outer.filterBy(isOdd);
                outer.add(a, b, c);
                expect(outer.items()).toEqual([a, c]);
                b.num = 5;
                expect(outer.items()).toEqual([a, b, c]);
            });

            it('fires filter-change', () => {
                const handler = spy();
                outer.on('filter-change', handler);
                outer.filterBy(['key']);
                expect(handler.called).toBe(true);
            });

        });

        describe('withGrouping', () => {

            let outer: GroupedModelCollection;
            beforeEach(() => outer = withGrouping(list));

            it('has expected methods', () => {
                ['groups', 'groupBy'].forEach((method: 'groups'|'groupBy') =>
                    expect(outer[method]).toBeInstanceOf(Function));
            });

            it('returns defaults groups', () => {
                outer.add(1, 2, 3);
                expect(outer.groups()).toMatchObject({ 1: [1], 2: [2], 3: [3] });
            });

            it('accepts custom grouper (factory)', () => {
                const isOdd = (num: number) => num % 2;
                outer = withGrouping(outer, isOdd);
                outer.add(1, 2, 3, 4, 5);
                expect(outer.groups()).toMatchObject({ 0: [2, 4], 1: [1, 3, 5] });
            });

            it('accepts custom grouper (method)', () => {
                const isOdd = (num: number) => num % 2;
                outer.groupBy(isOdd);
                outer.add(1, 2, 3, 4, 5);
                expect(outer.groups()).toMatchObject({ 0: [2, 4], 1: [1, 3, 5] });
            });

            it('fires group-change', () => {
                const handler = spy();
                outer.on('group-change', handler);
                outer.groupBy(['key']);
                expect(handler.called).toBe(true);
            });

            it('respects filter', () => {
                const isOdd = ({ num }: any) => num % 2;
                const a = { key: 'a', num: 1 };
                const b = { key: 'b', num: 2 };
                const c = { key: 'a', num: 3 };
                const d = { key: 'b', num: 5 };
                const e = { key: 'a', num: 4 };
                outer = withGrouping(withFiltering(collection(), isOdd), 'key');
                outer.add(a, b, c, d, e);
                expect(outer.groups()).toMatchObject({
                    a: [a, c],
                    b: [d]
                });
            });

            it('respects ordering', () => {
                const a = { key: 'a', num: 4 };
                const b = { key: 'b', num: 2 };
                const c = { key: 'a', num: 1 };
                const d = { key: 'b', num: 5 };
                const e = { key: 'a', num: 3 };
                outer = withGrouping(withOrdering(collection(), ['num']), 'key');
                outer.add(a, b, c, d, e);
                expect(outer.groups()).toMatchObject({
                    a: [c, e, a],
                    b: [b, d]
                });
            });

            it('handles mutations', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'a' };
                const d = { key: 'b' };
                const e = { key: 'a' };
                outer = withGrouping(outer, 'key');
                outer.add(a, b, c, d, e);
                expect(outer.groups()).toMatchObject({
                    a: [a, c, e],
                    b: [b, d]
                });
                b.key = 'a';
                expect(outer.groups()).toMatchObject({
                    a: [a, c, c, e],
                    b: [d]
                });
            });

        });

        describe('withActive', () => {

            let outer: ActiveModelCollection;
            beforeEach(() => outer = withActive(list));

            it('has expected members', () => {
                ['next', 'prev', 'active'].forEach((method: 'next'|'prev'|'active') =>
                    expect(outer[method]).toBeInstanceOf(Function));
                ['atEnd', 'atStart'].forEach((member: 'atEnd'|'atStart') =>
                    expect(typeof outer[member]).toBe('boolean'));
            });

            it('default active is null', () => {
                expect(outer.active()).toBe(null);
            });

            it('default atStart is true', () => {
                expect(outer.atStart).toBe(true);
            });

            it('default atEnd is true', () => {
                expect(outer.atEnd).toBe(true);
            });

            it('atStart and atEnd are readonly', () => {
                const atEnd = Object.getOwnPropertyDescriptor(outer, 'atEnd');
                const atStart = Object.getOwnPropertyDescriptor(outer, 'atStart');
                expect(atEnd.set).not.toBeDefined();
                expect(atStart.set).not.toBeDefined();
            });

            it('initializes active from factory items', () => {
                outer = withActive(collection(1, 2, 3));
                expect(outer.active()).toBe(1);
            });

            it('initializes active when items added', () => {
                expect(outer.active()).toBe(null);
                outer.add(1, 2, 3);
                expect(outer.active()).toBe(1);
            });

            it('sets next active when non-last active removed', () => {
                outer.add(1, 2, 3);
                expect(outer.active()).toBe(1);
                outer.remove(1);
                expect(outer.active()).toBe(2);
            });

            it('resets active on clear', () => {
                outer.add(1, 2, 3);
                expect(outer.active()).toBe(1);
                expect(outer.atStart).toBe(true);
                expect(outer.atEnd).toBe(false);
                outer.clear();
                expect(outer.active()).toBe(null);
                expect(outer.atStart).toBe(true);
                expect(outer.atEnd).toBe(true);
            });

            it('sets previous active when last active removed', () => {
                outer.add(1, 2, 3);
                outer.active(3);
                expect(outer.active()).toBe(3);
                outer.remove(3);
                expect(outer.active()).toBe(2);
                outer.remove(2);
                expect(outer.active()).toBe(1);
                outer.remove(1);
                expect(outer.active()).toBe(null);
            });

            it('active ignores item not in list', () => {
                expect(outer.active(1)).toBe(null);
                outer.add(1, 2, 3);
                expect(outer.active(4)).toBe(1);
            });

            it('returns set active item', () => {
                outer.add(1, 2, 3);
                expect(outer.active(2)).toBe(2);
            });

            it('returns active item', () => {
                outer.add(1, 2, 3);
                expect(outer.active()).toBe(1);
            });

            it('fires active-change', () => {
                const handler = spy();
                outer.on('active-change', handler);
                outer.add(1, 2, 3);
                expect(handler.args).toEqual([1, null]);
                outer.active(2);
                expect(handler.args).toEqual([2, 1]);
            });

            it('updates atStart and atEnd', () => {
                expect(outer.atEnd).toBe(true);
                expect(outer.atStart).toBe(true);
                outer.add(1, 2, 3);
                expect(outer.atEnd).toBe(false);
                expect(outer.atStart).toBe(true);
                outer.active(2);
                expect(outer.atEnd).toBe(false);
                expect(outer.atStart).toBe(false);
                outer.active(3);
                expect(outer.atEnd).toBe(true);
                expect(outer.atStart).toBe(false);
            });

            it('ignores filtered', () => {
                const isOdd = (num: number) => num % 2;
                outer = withActive(withFiltering(collection(), isOdd));
                outer.add(1, 2, 3, 4, 5);
                expect(outer.items()).toEqual([1, 3, 5]);
                expect(outer.active()).toEqual(1);
                expect(outer.active(2)).toEqual(1);
                expect(outer.active(3)).toEqual(3);
            });

            it('works with ordered grouping', () => {
                const a = { name: 'a', key: 'group 2' };
                const b = { name: 'b', key: 'group 1' };
                const c = { name: 'c', key: 'group 2' };
                outer = withActive(withGrouping(withOrdering(collection(), ['key']), 'key'));
                outer.add(a, b, c);
                expect(outer.active()).toBe(b);
                expect(outer.next()).toBe(a);
                expect(outer.next()).toBe(c);
            });

            it('updates active when filtered out', () => {
                outer = withActive(withFiltering(collection()));
                outer.add(1, 2, 3, 4, 5);
                expect(outer.items()).toEqual([1, 2, 3, 4, 5]);
                expect(outer.active(2)).toBe(2);
                (outer as any).filterBy((num: number) => num % 2);
                expect(outer.items()).toEqual([1, 3, 5]);
                expect(outer.active()).toBe(3);
            });

            it('does not update active if in filter', () => {
                outer = withActive(withFiltering(collection()));
                outer.add(1, 2, 3);
                expect(outer.active()).toBe(1);
                (outer as any).filterBy((num: number) => num % 2);
                expect(outer.active()).toBe(1);
            });

            describe('prev', () => {

                it('updates active', () => {
                    outer.add(1, 2, 3);
                    outer.active(3);
                    outer.prev();
                    expect(outer.active()).toBe(2);
                    outer.prev();
                    expect(outer.active()).toBe(1);
                });

                it('does not wrap', () => {
                    outer.add(1, 2);
                    outer.active(2);
                    outer.prev(); // 1
                    outer.prev(); // null
                    outer.prev(); // null
                    expect(outer.active()).toBe(1);
                });

                it('will wrap', () => {
                    outer.add(1, 2);
                    outer.active(2);
                    outer.prev(); // 1
                    expect(outer.active()).toBe(1);
                    outer.prev(true);
                    expect(outer.active()).toBe(2);
                });

                it('returns null if at start', () => {
                    outer.add(1, 2);
                    outer.active(2);
                    expect(outer.prev()).toBe(1);
                    expect(outer.prev()).toBe(null);
                    expect(outer.prev()).toBe(null);
                });

                it('returns last item if wrapped at start', () => {
                    outer.add(1, 2);
                    outer.active(2);
                    expect(outer.prev()).toBe(1);
                    expect(outer.prev(true)).toBe(2);
                });

            });

            describe('next', () => {

                it('updates active', () => {
                    outer.add(1, 2, 3);
                    expect(outer.active()).toBe(1);
                    outer.next();
                    expect(outer.active()).toBe(2);
                    outer.next();
                    expect(outer.active()).toBe(3);
                });

                it('does not wrap', () => {
                    outer.add(1, 2);
                    outer.next(); // 2
                    outer.next(); // null
                    outer.next(); // null
                    expect(outer.active()).toBe(2);
                });

                it('will wrap', () => {
                    outer.add(1, 2);
                    outer.next(); // 2
                    outer.next(); // null
                    expect(outer.active()).toBe(2);
                    outer.next(true); // 1
                    expect(outer.active()).toBe(1);
                });

                it('returns null if at end', () => {
                    outer.add(1, 2);
                    expect(outer.next()).toBe(2);
                    expect(outer.next()).toBe(null);
                    expect(outer.next()).toBe(null);
                });

                it('returns first item if wrapped at end', () => {
                    outer.add(1, 2);
                    expect(outer.next()).toBe(2);
                    expect(outer.next(true)).toBe(1);
                });

            });

        });

        describe('withSelection', () => {

            let outer: SelectionModelCollection;
            beforeEach(() => outer = withSelection(list));

            it('has expected methods', () => {
                ['toggle', 'selected'].forEach((method: 'toggle'|'selected') =>
                    expect(outer[method]).toBeInstanceOf(Function));
            });

            it('selected returns selected', () => {
                outer.add(1, 2, 3);
                expect(outer.selected()).toEqual([]);
                expect(outer.selected(1)).toEqual([1]);
                expect(outer.selected()).toEqual([1]);
            });

            it('selected assigns selected', () => {
                outer.add(1, 2, 3);
                outer.selected(2, 3);
                expect(outer.selected()).toEqual([2, 3]);
            });

            it('selected ignores items not in list', () => {
                outer.add(1, 2, 3);
                outer.selected(2, 4);
                expect(outer.selected()).toEqual([2]);
            });

            it('empty toggle de/selects all', () => {
                outer.add(1, 2, 3);
                expect(outer.selected()).toEqual([]);
                expect(outer.toggle()).toEqual([1, 2, 3]);
                expect(outer.toggle()).toEqual([]);
                expect(outer.toggle()).toEqual([1, 2, 3]);
            });

            it('partial empty toggle selects all', () => {
                outer.add(1, 2, 3);
                expect(outer.selected(2)).toEqual([2]);
                expect(outer.toggle()).toEqual([1, 2, 3]);
                expect(outer.toggle()).toEqual([]);
                expect(outer.toggle()).toEqual([1, 2, 3]);
            });

            it('toggle is differential', () => {
                outer.add(1, 2, 3);
                expect(outer.selected()).toEqual([]);
                expect(outer.toggle(2)).toEqual([2]);
                expect(outer.toggle(3)).toEqual([2, 3]);
                expect(outer.toggle(1, 3)).toEqual([1, 2]);
            });

            it('toggle adds previously unselected', () => {
                outer.add(1, 2, 3);
                outer.toggle(2);
                expect(outer.selected()).toEqual([2]);
            });

            it('toggles removes previously selected', () => {
                outer.add(1, 2, 3);
                expect(outer.selected(2)).toEqual([2]);
                expect(outer.toggle(2, 3)).toEqual([3]);
            });

            it('fires selection-change event', () => {
                const handler = spy();
                outer.on('selection-change', handler);
                outer.add(1, 2, 3);
                outer.selected(2, 3);
                expect(handler.args).toEqual([[2, 3], []]);
            });

            it('updates selection when selected item removed', () => {
                outer.add(1, 2, 3);
                outer.selected(2);
                outer.remove(3);
                expect(outer.selected()).toEqual([2]);
                outer.remove(2);
                expect(outer.selected()).toEqual([]);
            });

            it('ignores filtered', () => {
                const isOdd = (num: number) => num % 2;
                outer = withSelection(withFiltering(collection(), isOdd));
                outer.add(1, 2, 3, 4, 5);
                expect(outer.items()).toEqual([1, 3, 5]);
                expect(outer.selected(1, 2, 3)).toEqual([1, 3]);
            });

            it('updates selection when filter changes', () => {
                const isOdd = (num: number) => num % 2;
                outer = withSelection(withFiltering(collection()));
                outer.add(1, 2, 3, 4, 5);
                expect(outer.selected(1, 2, 3)).toEqual([1, 2, 3]);
                (outer as any).filterBy(isOdd);
                expect(outer.selected()).toEqual([1, 3]);
            });

        });

        describe('withPaging', () => {

            let outer: PagedModelCollection;
            beforeEach(() => outer = withPaging(list));

            it('has expected members', () => {
                ['pageSize', 'nextPage', 'prevPage', 'pageIndex'].forEach(
                    (method: 'pageSize'|'nextPage'|'prevPage'|'pageIndex') =>
                        expect(outer[method]).toBeInstanceOf(Function));
                ['pageCount'].forEach((member: 'pageCount') =>
                    expect(typeof outer[member]).toBe('number'));
            });

            it('page defaults to first page', () => {
                expect(outer.pageIndex()).toBe(0);
            });

            it('respects page size from factory', () => {
                expect(outer.pageSize()).toBe(50);
            });

            it('respects page size from method', () => {
                expect(outer.pageSize()).not.toBe(10);
                expect(outer.pageSize(10)).toBe(10);
                expect(outer.pageSize()).toBe(10);
            });

            it('items returns current page items', () => {
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                expect(outer.pageIndex()).toBe(0);
                expect(outer.items()).toEqual([1, 2]);
            });

            it('correctly initializes', () => {
                outer = withPaging(collection(1, 2, 3, 4, 5), 2);
                expect(outer.pageIndex()).toBe(0);
                expect(outer.items()).toEqual([1, 2]);
            });

            it('nextPage shows next page', () => {
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                expect(outer.pageIndex()).toBe(0);
                expect(outer.items()).toEqual([1, 2]);
                expect(outer.nextPage()).toBe(1);
                expect(outer.items()).toEqual([3, 4]);
                expect(outer.nextPage()).toBe(2);
                expect(outer.items()).toEqual([5]);
            });

            it('prevPage shows prevPage', () => {
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                outer.pageIndex(outer.pageCount);
                expect(outer.pageIndex()).toBe(2);
                expect(outer.items()).toEqual([5]);
                expect(outer.prevPage()).toBe(1);
                expect(outer.items()).toEqual([3, 4]);
                expect(outer.prevPage()).toBe(0);
                expect(outer.items()).toEqual([1, 2]);
            });

            it('prevPage stops at first page', () => {
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                outer.pageIndex(outer.pageCount);
                expect(outer.prevPage()).toBe(1);
                expect(outer.prevPage()).toBe(0);
                expect(outer.prevPage()).toBe(0);
                expect(outer.prevPage()).toBe(0);
            });

            it('nextPage stops at last page', () => {
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                expect(outer.nextPage()).toBe(1);
                expect(outer.nextPage()).toBe(2);
                expect(outer.nextPage()).toBe(2);
            });

            it('pageIndex fires page-change event', () => {
                const handler = spy();
                outer.on('page-change', handler);
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                expect(handler.called).toBe(false);
                outer.pageIndex(1);
                expect(handler.called).toBe(true);
                expect(handler.args).toEqual([1]);
            });

            it('nextPage fires page-change event', () => {
                const handler = spy();
                outer.on('page-change', handler);
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                expect(handler.called).toBe(false);
                outer.nextPage();
                expect(handler.called).toBe(true);
                expect(handler.args).toEqual([1]);
            });

            it('prevPage fires page-change event', () => {
                const handler = spy();
                outer.pageSize(2);
                outer.add(1, 2, 3, 4, 5);
                outer.pageIndex(2);
                outer.on('page-change', handler);
                expect(handler.called).toBe(false);
                outer.prevPage();
                expect(handler.called).toBe(true);
                expect(handler.args).toEqual([1]);
            });

            it('sets page within bounds on filter-change', () => {
                const isOdd = (num: number) => num % 2;
                outer = withPaging(withFiltering(collection(1, 2, 3, 4, 5)), 2);
                expect(outer.nextPage()).toBe(1);
                expect(outer.nextPage()).toBe(2);
                (outer as any).filterBy(isOdd);
                expect(outer.pageIndex()).toBe(1);
            });

            it('sets page within bounds on items-remove', () => {
                outer = withPaging(collection(1, 2, 3, 4, 5), 2);
                expect(outer.nextPage()).toBe(1);
                expect(outer.nextPage()).toBe(2);
                outer.remove(5);
                expect(outer.pageCount).toBe(2);
                expect(outer.pageIndex()).toBe(1);
                expect(outer.prevPage()).toBe(0);
                outer.remove(1);
                expect(outer.items()).toEqual([2, 3]);
                expect(outer.pageCount).toBe(2);
                outer.remove(3);
                expect(outer.pageIndex()).toBe(0);
                expect(outer.items()).toEqual([2, 4]);
                expect(outer.pageCount).toBe(1);
            });

            it('only returns groups on current page', () => {
                const a = { group: 'a', value: 1 };
                const b = { group: 'b', value: 2 };
                const c = { group: 'a', value: 3 };
                const d = { group: 'b', value: 4 };
                const isGroup = (name: string) => (item: any) => item.group === name;
                outer = withGrouping(withPaging(withOrdering(collection(c, b, a, d), ['group', 'value']), 2), 'group');
                expect(outer.items().every(isGroup('a'))).toBe(true);
                expect(outer.nextPage()).toBe(1);
                expect(outer.items().every(isGroup('b'))).toBe(true);
            });

            it('respects ordering between pages', () => {
                outer = withPaging(withOrdering(collection(3, 1, 5, 4, 2)), 2);
                expect(outer.items()).toEqual([1, 2]);
                expect(outer.nextPage()).toBe(1);
                expect(outer.items()).toEqual([3, 4]);
                (outer as any).orderBy([], ['desc']);
                expect(outer.items()).toEqual([3, 2]);
                outer.add(3.5);
                expect(outer.items()).toEqual([3.5, 3]);
            });

            it('active-change updates page', () => {
                outer = withPaging(withActive(collection(1, 2, 3, 4, 5)), 2);
                expect((outer as any).active()).toBe(1);
                expect((outer as any).next()).toBe(2);
                expect(outer.pageIndex()).toBe(0);
                expect((outer as any).next()).toBe(3);
                expect(outer.pageIndex()).toBe(1);
                outer.remove(2, 3);
                expect((outer as any).active()).toBe(5);
                expect(outer.pageIndex()).toBe(1);
            });

        });

        describe('withUnique', () => {

            let outer: UniqueModelCollection;
            beforeEach(() => outer = withUnique(list));

            it('uses identity as default', () => {
                outer.add(1, 2, 3, 2, 1);
                expect(outer.items()).toEqual([1, 2, 3]);
            });

            it('accepts factory selector', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'a' };
                outer = withUnique(collection(), 'key');
                outer.add(a, b, c);
                expect(outer.items()).toEqual([a, b]);
            });

            it('works with previous list items', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'a' };
                outer = withUnique(collection(a, b, c), 'key');
                expect(outer.items()).toEqual([a, b]);
            });

            it('accepts method selector', () => {
                const a = { key: 'a' };
                const b = { key: 'b' };
                const c = { key: 'a' };
                outer.add(a, b, c);
                expect(outer.items()).toEqual([a, b, c]);
                outer.uniqueBy('key');
                expect(outer.items()).toEqual([a, b]);
            });

        });

        describe('withUpdating', () => {

            let a: any,
                b: any,
                c: any,
                outer: UpdatingModelCollection;

            beforeEach(() => {
                outer = withUpdating(list, 'key');
                a = { key: 123, value: 'a' };
                b = { key: 456, value: 'b' };
                c = { key: 789, value: 'c' };
            });

            it('adds expected methods', () => {
                ['upsert', 'merge', 'uniqueBy'].forEach(
                    (method: 'upsert'|'merge'|'uniqueBy') =>
                        expect(outer[method]).toBeInstanceOf(Function));
            });

            it('uses identity if no selector given', () => {
                outer = withUpdating(collection());
                outer.add(1, 2, 3);
                outer.merge(2, 3);
                expect(outer.items()).toEqual([2, 3]);
            });

            describe('merge', () => {

                it('delegates to upsert', () => {
                    outer.merge(b, c);
                    expect(outer.items()).toEqual([b, c]);
                });

                it('removes old items', () => {
                    outer.add(a);
                    outer.merge(b, c);
                    expect(outer.items()).toEqual([b, c]);
                });

                it('fires items-remove', () => {
                    const handler = spy();
                    outer.on('items-remove', handler);
                    outer.add(a);
                    outer.merge(b, c);
                    expect(handler.called).toBe(true);
                    expect(handler.args[0]).toEqual([a]);
                });

            });

            describe('upsert', () => {

                it('adds new items', () => {
                    outer.add(a);
                    outer.upsert(b, c);
                    expect(outer.items()).toEqual([a, b, c]);
                });

                it('fires items-add', () => {
                    const handler = spy();
                    outer.on('items-add', handler);
                    outer.add(a);
                    outer.upsert(b, c);
                    expect(handler.called).toBe(true);
                    expect(handler.args[0]).toEqual([b, c]);
                });

                it('updates existing items', () => {
                    const clone = { ...a, value: 'a1' };
                    outer.add(a, b, c);
                    outer.upsert(clone);
                    expect(outer.items()).toEqual([b, c, clone]);
                });

                it('fires items-update', () => {
                    const handler = spy();
                    const clone = { ...a, value: 'a1' };
                    outer.on('items-update', handler);
                    outer.add(a, b, c);
                    outer.upsert(clone);
                    expect(handler.called).toBe(true);
                    expect(handler.args[0]).toEqual([clone]);
                });

                it('does not fire items-add for updates', () => {
                    const handler = spy();
                    const clone = { ...a, value: 'a1' };
                    outer.add(a, b, c);
                    outer.on('items-add', handler);
                    outer.upsert(clone);
                    expect(handler.called).toBe(false);
                });

                it('does not fire items-remove for updates', () => {
                    const handler = spy();
                    const clone = { ...a, value: 'a1' };
                    outer.add(a, b, c);
                    outer.on('items-remove', handler);
                    outer.upsert(clone);
                    expect(handler.called).toBe(false);
                });

            });


        });

    });

});
import expect from 'expect';
import { spy } from './utils';
import {
    modelList,
    withOrdering,
    withFiltering,
    withSelection,
    withGrouping,
    withPaging,
    withActive,
} from '../models';

describe('modelList', () => {

    let list;

    beforeEach(() => list = modelList());

    it('has expected methods', () => {
        ['items', 'add', 'remove', 'clear', 'on', 'one', 'fire']
            .forEach(method => expect(typeof list[method]).toBe('function'));
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

    it('adds factory arguments', () => {
        list = modelList(1, 2, 3);
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

    describe('withOrdering', () => {

        beforeEach(() => list = withOrdering(list));

        it('has expected methods', () => {
            ['items', 'orderBy'].forEach(method => {
                expect(typeof list[method]).toBe('function');
            });
        });

        it('sorts underlying list', () => {
            list.add(3, 1, 2);
            expect(list.items()).toEqual([1, 2, 3]);
        });

        it('accepts custom orderer (factory)', () => {
            const a = { key: 'a' };
            const b = { key: 'b' };
            const c = { key: 'c' };
            list = withOrdering(list, ['key'], ['desc']);
            list.add(a, c, b);
            expect(list.items()).toEqual([c, b, a]);
        });

        it('updates custom orderer (method)', () => {
            const a = { key: 'a' };
            const b = { key: 'b' };
            const c = { key: 'c' };
            list.orderBy(['key'], ['desc']);
            list.add(a, c, b);
            expect(list.items()).toEqual([c, b, a]);
        });

        it('handles mutations', () => {
            const a = { key: 'a' };
            const b = { key: 'b' };
            const c = { key: 'c' };
            list = withOrdering(list, ['key'], ['desc']);
            list.add(a, c, b);
            expect(list.items()).toEqual([c, b, a]);
            a.key = 'd';
            expect(list.items()).toEqual([a, c, b]);
        });

        it('fires order-change', () => {
            const handler = spy();
            list.on('order-change', handler);
            list.orderBy(['key']);
            expect(handler.called).toBe(true);
        });

    });

    describe('withFiltering', () => {

        beforeEach(() => list = withFiltering(list));

        it('has expected methods', () => {
            ['items', 'filterBy'].forEach(method =>
                expect(typeof list[method]).toBe('function'));
        });

        it('filters underlying list', () => {
            list.add(0, 1, 2);
            expect(list.items()).toEqual([1, 2]);
        });

        it('accepts custom filter (factory)', () => {
            const isOdd = num => num % 2;
            list = withFiltering(list, isOdd);
            list.add(1, 2, 3);
            expect(list.items()).toEqual([1, 3]);
        });

        it('accepts custom filter (method)', () => {
            const isOdd = num => num % 2;
            list.filterBy(isOdd);
            list.add(1, 2, 3);
            expect(list.items()).toEqual([1, 3]);
        });

        it('resets filtering', () => {
            const isOdd = num => num % 2;
            list.filterBy(isOdd);
            list.add(1, 2, 3);
            expect(list.items()).toEqual([1, 3]);
            list.filterBy();
            expect(list.items()).toEqual([1, 2, 3]);
        });

        it('handles mutations', () => {
            const isOdd = ({num}) => num % 2;
            const a = { num: 1 };
            const b = { num: 2 };
            const c = { num: 3 };
            list.filterBy(isOdd);
            list.add(a, b, c);
            expect(list.items()).toEqual([a, c]);
            b.num = 5;
            expect(list.items()).toEqual([a, b, c]);
        });

        it('fires filter-change', () => {
            const handler = spy();
            list.on('filter-change', handler);
            list.filterBy(['key']);
            expect(handler.called).toBe(true);
        });

    });

    describe('withGrouping', () => {

        beforeEach(() => list = withGrouping(list));

        it('has expected methods', () => {
            ['groups', 'groupBy'].forEach(method =>
                expect(typeof list[method]).toBe('function'));
        });

        it('returns defaults groups', () => {
            list.add(1, 2, 3);
            expect(list.groups()).toMatchObject({ 1: [1], 2: [2], 3: [3] });
        });

        it('accepts custom grouper (factory)', () => {
            const isOdd = num => num % 2;
            list = withGrouping(list, isOdd);
            list.add(1, 2, 3, 4, 5);
            expect(list.groups()).toMatchObject({ 0: [2, 4], 1: [1, 3, 5] });
        });

        it('accepts custom grouper (method)', () => {
            const isOdd = num => num % 2;
            list.groupBy(isOdd);
            list.add(1, 2, 3, 4, 5);
            expect(list.groups()).toMatchObject({ 0: [2, 4], 1: [1, 3, 5] });
        });

        it('fires group-change', () => {
            const handler = spy();
            list.on('group-change', handler);
            list.groupBy(['key']);
            expect(handler.called).toBe(true);
        });

        it('respects filter', () => {
            const isOdd = ({ num }) => num % 2;
            const a = { key: 'a', num: 1 };
            const b = { key: 'b', num: 2 };
            const c = { key: 'a', num: 3 };
            const d = { key: 'b', num: 5 };
            const e = { key: 'a', num: 4 };
            list = withGrouping(withFiltering(modelList(), isOdd), 'key');
            list.add(a, b, c, d, e);
            expect(list.groups()).toMatchObject({
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
            list = withGrouping(withOrdering(modelList(), ['num']), 'key');
            list.add(a, b, c, d, e);
            expect(list.groups()).toMatchObject({
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
            list = withGrouping(list, 'key');
            list.add(a, b, c, d, e);
            expect(list.groups()).toMatchObject({
                a: [a, c, e],
                b: [b, d]
            });
            b.key = 'a';
            expect(list.groups()).toMatchObject({
                a: [a, c, c, e],
                b: [d]
            });
        });

    });

    describe('withActive', () => {

        beforeEach(() => list = withActive(list));

        it('has expected members', () => {
            ['next', 'prev', 'active'].forEach(method =>
                expect(typeof list[method]).toBe('function'));
            ['atEnd', 'atStart'].forEach(member =>
                expect(typeof list[member]).toBe('boolean'));
        });

        it('default active is null', () => {
            expect(list.active()).toBe(null);
        });

        it('default atStart is true', () => {
            expect(list.atStart).toBe(true);
        });

        it('default atEnd is true', () => {
            expect(list.atEnd).toBe(true);
        });

        it('atStart and atEnd are readonly', () => {
            const atEnd = Object.getOwnPropertyDescriptor(list, 'atEnd');
            const atStart = Object.getOwnPropertyDescriptor(list, 'atStart');
            expect(atEnd.set).not.toBeDefined();
            expect(atStart.set).not.toBeDefined();
        });

        it('initializes active from factory items', () => {
            list = withActive(modelList(1, 2, 3));
            expect(list.active()).toBe(1);
        });

        it('initializes active when items added', () => {
            expect(list.active()).toBe(null);
            list.add(1, 2, 3);
            expect(list.active()).toBe(1);
        });

        it('sets next active when non-last active removed', () => {
            list.add(1, 2, 3);
            expect(list.active()).toBe(1);
            list.remove(1);
            expect(list.active()).toBe(2);
        });

        it('resets active on clear', () => {
            list.add(1, 2, 3);
            expect(list.active()).toBe(1);
            expect(list.atStart).toBe(true);
            expect(list.atEnd).toBe(false);
            list.clear();
            expect(list.active()).toBe(null);
            expect(list.atStart).toBe(true);
            expect(list.atEnd).toBe(true);
        });

        it('sets previous active when last active removed', () => {
            list.add(1, 2, 3);
            list.active(3);
            expect(list.active()).toBe(3);
            list.remove(3);
            expect(list.active()).toBe(2);
            list.remove(2);
            expect(list.active()).toBe(1);
            list.remove(1);
            expect(list.active()).toBe(null);
        });

        it('active ignores item not in list', () => {
            expect(list.active(1)).toBe(null);
            list.add(1, 2, 3);
            expect(list.active(4)).toBe(1);
        });

        it('returns set active item', () => {
            list.add(1, 2, 3);
            expect(list.active(2)).toBe(2);
        });

        it('returns active item', () => {
            list.add(1, 2, 3);
            expect(list.active()).toBe(1);
        });

        it('fires active-change', () => {
            const handler = spy();
            list.on('active-change', handler);
            list.add(1, 2, 3);
            expect(handler.args).toEqual([1, null]);
            list.active(2);
            expect(handler.args).toEqual([2, 1]);
        });

        it('updates atStart and atEnd', () => {
            expect(list.atEnd).toBe(true);
            expect(list.atStart).toBe(true);
            list.add(1, 2, 3);
            expect(list.atEnd).toBe(false);
            expect(list.atStart).toBe(true);
            list.active(2);
            expect(list.atEnd).toBe(false);
            expect(list.atStart).toBe(false);
            list.active(3);
            expect(list.atEnd).toBe(true);
            expect(list.atStart).toBe(false);
        });

        it('ignores filtered', () => {
            const isOdd = num => num % 2;
            list = withActive(withFiltering(modelList(), isOdd));
            list.add(1, 2, 3, 4, 5);
            expect(list.items()).toEqual([1, 3, 5]);
            expect(list.active()).toEqual(1);
            expect(list.active(2)).toEqual(1);
            expect(list.active(3)).toEqual(3);
        });

        it('works with ordered grouping', () => {
            const a = { name: 'a', key: 'group 2' };
            const b = { name: 'b', key: 'group 1' };
            const c = { name: 'c', key: 'group 2' };
            list = withOrdering(modelList(), ['key']);
            list = withGrouping(list, 'key');
            list = withActive(list);
            list.add(a, b, c);
            expect(list.active()).toBe(b);
            expect(list.next()).toBe(a);
            expect(list.next()).toBe(c);
        });

        it('updates active when filtered out', () => {
            list = withActive(withFiltering(modelList()));
            list.add(1, 2, 3, 4, 5);
            expect(list.items()).toEqual([1, 2, 3, 4, 5]);
            expect(list.active(2)).toBe(2);
            list.filterBy(num => num % 2);
            expect(list.items()).toEqual([1, 3, 5]);
            expect(list.active()).toBe(3);
        });

        it('does not update active if in filter', () => {
            list = withActive(withFiltering(modelList()));
            list.add(1, 2, 3);
            expect(list.active()).toBe(1);
            list.filterBy(num => num % 2);
            expect(list.active()).toBe(1);
        });

        describe('prev', () => {

            it('updates active', () => {
                list.add(1, 2, 3);
                list.active(3);
                list.prev();
                expect(list.active()).toBe(2);
                list.prev();
                expect(list.active()).toBe(1);
            });

            it('does not wrap', () => {
                list.add(1, 2);
                list.active(2);
                list.prev(); // 1
                list.prev(); // null
                list.prev(); // null
                expect(list.active()).toBe(1);
            });

            it('will wrap', () => {
                list.add(1, 2);
                list.active(2);
                list.prev(); // 1
                expect(list.active()).toBe(1);
                list.prev(true);
                expect(list.active()).toBe(2);
            });

            it('returns null if at start', () => {
                list.add(1, 2);
                list.active(2);
                expect(list.prev()).toBe(1);
                expect(list.prev()).toBe(null);
                expect(list.prev()).toBe(null);
            });

            it('returns last item if wrapped at start', () => {
                list.add(1, 2);
                list.active(2);
                expect(list.prev()).toBe(1);
                expect(list.prev(true)).toBe(2);
            });

        });

        describe('next', () => {

            it('updates active', () => {
                list.add(1, 2, 3);
                expect(list.active()).toBe(1);
                list.next();
                expect(list.active()).toBe(2);
                list.next();
                expect(list.active()).toBe(3);
            });

            it('does not wrap', () => {
                list.add(1, 2);
                list.next(); // 2
                list.next(); // null
                list.next(); // null
                expect(list.active()).toBe(2);
            });

            it('will wrap', () => {
                list.add(1, 2);
                list.next(); // 2
                list.next(); // null
                expect(list.active()).toBe(2);
                list.next(true); // 1
                expect(list.active()).toBe(1);
            });

            it('returns null if at end', () => {
                list.add(1, 2);
                expect(list.next()).toBe(2);
                expect(list.next()).toBe(null);
                expect(list.next()).toBe(null);
            });

            it('returns first item if wrapped at end', () => {
                list.add(1, 2);
                expect(list.next()).toBe(2);
                expect(list.next(true)).toBe(1);
            });

        });

    });

    describe('withSelection', () => {

        beforeEach(() => list = withSelection(list));

        it('has expected methods', () => {
            ['toggle', 'selected'].forEach(method =>
                expect(typeof list[method]).toBe('function'));
        });

        it('selected returns selected', () => {
            list.add(1, 2, 3);
            expect(list.selected()).toEqual([]);
            expect(list.selected(1)).toEqual([1]);
            expect(list.selected()).toEqual([1]);
        });

        it('selected assigns selected', () => {
            list.add(1, 2, 3);
            list.selected(2, 3);
            expect(list.selected()).toEqual([2, 3]);
        });

        it('selected ignores items not in list', () => {
            list.add(1, 2, 3);
            list.selected(2, 4);
            expect(list.selected()).toEqual([2]);
        });

        it('empty toggle de/selects all', () => {
            list.add(1, 2, 3);
            expect(list.selected()).toEqual([]);
            expect(list.toggle()).toEqual([1, 2, 3]);
            expect(list.toggle()).toEqual([]);
            expect(list.toggle()).toEqual([1, 2, 3]);
        });

        it('partial empty toggle selects all', () => {
            list.add(1, 2, 3);
            expect(list.selected(2)).toEqual([2]);
            expect(list.toggle()).toEqual([1, 2, 3]);
            expect(list.toggle()).toEqual([]);
            expect(list.toggle()).toEqual([1, 2, 3]);
        });

        it('toggle is differential', () => {
            list.add(1, 2, 3);
            expect(list.selected()).toEqual([]);
            expect(list.toggle(2)).toEqual([2]);
            expect(list.toggle(3)).toEqual([2, 3]);
            expect(list.toggle(1, 3)).toEqual([1, 2]);
        });

        it('toggle adds previously unselected', () => {
            list.add(1, 2, 3);
            list.toggle(2);
            expect(list.selected()).toEqual([2]);
        });

        it('toggles removes previously selected', () => {
            list.add(1, 2, 3);
            expect(list.selected(2)).toEqual([2]);
            expect(list.toggle(2, 3)).toEqual([3]);
        });

        it('fires selection-change event', () => {
            const handler = spy();
            list.on('selection-change', handler);
            list.add(1, 2, 3);
            list.selected(2, 3);
            expect(handler.args).toEqual([[2, 3], []]);
        });

        it('updates selection when selected item removed', () => {
            list.add(1, 2, 3);
            list.selected(2);
            list.remove(3);
            expect(list.selected()).toEqual([2]);
            list.remove(2);
            expect(list.selected()).toEqual([]);
        });

        it('ignores filtered', () => {
            const isOdd = num => num % 2;
            list = withSelection(withFiltering(modelList(), isOdd));
            list.add(1, 2, 3, 4, 5);
            expect(list.items()).toEqual([1, 3, 5]);
            expect(list.selected(1, 2, 3)).toEqual([1, 3]);
        });

        it('updates selection when filter changes', () => {
            const isOdd = num => num % 2;
            list = withSelection(withFiltering(modelList()));
            list.add(1, 2, 3, 4, 5);
            expect(list.selected(1, 2, 3)).toEqual([1, 2, 3]);
            list.filterBy(isOdd);
            expect(list.selected()).toEqual([1, 3]);
        });

    });

    describe('withPaging', () => {

        beforeEach(() => list = withPaging(list));

        it('has expected members', () => {
            ['pageSize', 'nextPage', 'prevPage', 'pageIndex'].forEach(method =>
                expect(typeof list[method]).toBe('function'));
            ['pageCount'].forEach(member =>
                expect(typeof list[member]).toBe('number'));
        });

        it('page defaults to first page', () => {
            expect(list.pageIndex()).toBe(0);
        });

        it('respects page size from factory', () => {
            expect(list.pageSize()).toBe(50);
        });

        it('respects page size from method', () => {
            expect(list.pageSize()).not.toBe(10);
            expect(list.pageSize(10)).toBe(10);
            expect(list.pageSize()).toBe(10);
        });

        it('items returns current page items', () => {
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            expect(list.pageIndex()).toBe(0);
            expect(list.items()).toEqual([1, 2]);
        });

        it('correctly initializes', () => {
            list = withPaging(modelList(1, 2, 3, 4, 5), 2);
            expect(list.pageIndex()).toBe(0);
            expect(list.items()).toEqual([1, 2]);
        });

        it('nextPage shows next page', () => {
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            expect(list.pageIndex()).toBe(0);
            expect(list.items()).toEqual([1, 2]);
            expect(list.nextPage()).toBe(1);
            expect(list.items()).toEqual([3, 4]);
            expect(list.nextPage()).toBe(2);
            expect(list.items()).toEqual([5]);
        });

        it('prevPage shows prevPage', () => {
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            list.pageIndex(list.pageCount);
            expect(list.pageIndex()).toBe(2);
            expect(list.items()).toEqual([5]);
            expect(list.prevPage()).toBe(1);
            expect(list.items()).toEqual([3, 4]);
            expect(list.prevPage()).toBe(0);
            expect(list.items()).toEqual([1, 2]);
        });

        it('prevPage stops at first page', () => {
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            list.pageIndex(list.pageCount);
            expect(list.prevPage()).toBe(1);
            expect(list.prevPage()).toBe(0);
            expect(list.prevPage()).toBe(0);
            expect(list.prevPage()).toBe(0);
        });

        it('nextPage stops at last page', () => {
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            expect(list.nextPage()).toBe(1);
            expect(list.nextPage()).toBe(2);
            expect(list.nextPage()).toBe(2);
        });

        it('pageIndex fires page-change event', () => {
            const handler = spy();
            list.on('page-change', handler);
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            expect(handler.called).toBe(false);
            list.pageIndex(1);
            expect(handler.called).toBe(true);
            expect(handler.args).toEqual([1]);
        });

        it('nextPage fires page-change event', () => {
            const handler = spy();
            list.on('page-change', handler);
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            expect(handler.called).toBe(false);
            list.nextPage();
            expect(handler.called).toBe(true);
            expect(handler.args).toEqual([1]);
        });

        it('prevPage fires page-change event', () => {
            const handler = spy();
            list.pageSize(2);
            list.add(1, 2, 3, 4, 5);
            list.pageIndex(2);
            list.on('page-change', handler);
            expect(handler.called).toBe(false);
            list.prevPage();
            expect(handler.called).toBe(true);
            expect(handler.args).toEqual([1]);
        });

        it('sets page within bounds on filter-change', () => {
            const isOdd = num => num % 2;
            list = withPaging(withFiltering(modelList(1, 2, 3, 4, 5)), 2);
            expect(list.nextPage()).toBe(1);
            expect(list.nextPage()).toBe(2);
            list.filterBy(isOdd);
            expect(list.pageIndex()).toBe(1);
        });

        it('sets page within bounds on items-remove', () => {
            list = withPaging(modelList(1, 2, 3, 4, 5), 2);
            expect(list.nextPage()).toBe(1);
            expect(list.nextPage()).toBe(2);
            list.remove(5);
            expect(list.pageCount).toBe(2);
            expect(list.pageIndex()).toBe(1);
            expect(list.prevPage()).toBe(0);
            list.remove(1);
            expect(list.items()).toEqual([2, 3]);
            expect(list.pageCount).toBe(2);
            list.remove(3);
            expect(list.pageIndex()).toBe(0);
            expect(list.items()).toEqual([2, 4]);
            expect(list.pageCount).toBe(1);
        });

        it('only returns groups on current page', () => {
            const a = { group: 'a', value: 1 };
            const b = { group: 'b', value: 2 };
            const c = { group: 'a', value: 3 };
            const d = { group: 'b', value: 4 };
            const isGroup = name => item => item.group === name;
            list = modelList(c, b, a, d);
            list = withOrdering(list, ['group', 'value']);
            list = withPaging(list, 2);
            list = withGrouping(list, 'group');
            expect(list.items().every(isGroup('a'))).toBe(true);
            expect(list.nextPage()).toBe(1);
            expect(list.items().every(isGroup('b'))).toBe(true);
        });

        it('respects ordering between pages', () => {
            list = modelList(3, 1, 5, 4, 2);
            list = withOrdering(list);
            list = withPaging(list, 2);
            expect(list.items()).toEqual([1, 2]);
            expect(list.nextPage()).toBe(1);
            expect(list.items()).toEqual([3, 4]);
            list.orderBy([], ['desc']);
            expect(list.items()).toEqual([3, 2]);
            list.add(3.5);
            expect(list.items()).toEqual([3.5, 3]);
        });

        it('active-change updates page', () => {
            list = modelList(1, 2, 3, 4, 5);
            list = withActive(list);
            list = withPaging(list, 2);
            expect(list.active()).toBe(1);
            expect(list.next()).toBe(2);
            expect(list.pageIndex()).toBe(0);
            expect(list.next()).toBe(3);
            expect(list.pageIndex()).toBe(1);
            list.remove(2, 3);
            expect(list.active()).toBe(5);
            expect(list.pageIndex()).toBe(1);
        });

    });

});
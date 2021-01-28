import { EventBus } from './index.js';

/**
 * @class
 * @global
 * @hideconstructor
 * @extends EventBus
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { createRequest, fetch } from '~/path/to/data';
 *
 * import { loadClientData } from '../data';
 *
 * export async function createClientDataModel(client) {
 *   const request = createRequest(loadClientData, { client });
 *   const response = await fetch(request);
 *   return modelList(...response.data); // spread values
 * }
 */
export class ModelList extends EventBus {

    /**
    * Adds items to the ModelList.
    *
    * @method ModelList#add
    * @param {...any} [items] The items to add to the ModelList.
    * @fires ModelList~items-add
    * @example
    * import { modelList } from '@paychex/core/models';
    *
    * const list = modelList(1, 2, 3);
    * list.add(4, 5, 6);
    * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
    */
    add() { }

    /**
     * Removes items from the ModelList.
     *
     * @method ModelList#remove
     * @param {...any} [items] The items to remove from the ModelList.
     * @fires ModelList~items-remove
     * @example
     * import { modelList } from '@paychex/core/models';
     *
     * const list = modelList(1, 2, 3);
     * list.add(4, 5, 6);
     * list.remove(5, 1);
     * console.log(list.items()); // [2, 3, 4, 6]
     */
    remove() { }

    /**
     * Removes all items from the ModelList.
     *
     * @method ModelList#clear
     * @fires ModelList~items-remove
     * @example
     * import { modelList } from '@paychex/core/models';
     *
     * const list = modelList(1, 2, 3);
     * list.add(4, 5, 6);
     * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
     * list.clear();
     * console.log(list.items()); // []
     */
    clear() { }

    /**
     * The set of items in the ModelList.
     *
     * **NOTE:** Returns a shallow copy of the underlying collection. That
     * means the array returned can be mutated without affecting the real
     * ModelList, but all the items in the array are the same by reference,
     * so mutating an object in the collection will also mutate the object
     * stored in the ModelList.
     *
     * @method ModelList#items
     * @example
     * import { modelList, withOrdering } from '@paychex/core/models';
     *
     * let list = modelList(1, 2, 3);
     * list.add(4, 5, 6);
     * console.log(list.items()); // [1, 2, 3, 4, 5, 6]
     * list = withOrdering(list, [], ['desc']);
     * console.log(list.items()); // [6, 5, 4, 3, 2, 1]
     */
    items() { }

}

/**
 * Adds "active item" tracking and navigation to an existing {@link ModelList} instance.
 *
 * **Note on Grouping**: If you want to navigate through a grouped list, you may want
 * to ensure an order has been applied beforehand. Use {@link module:models.withOrdering withOrdering}
 * and ensure your array of iteratees starts with your group selector. This ensures that
 * navigating through the list correctly moves between groups.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 * @listens ModelList~event:items-add
 * @listens ModelList~event:items-remove
 * @listens FilteredModelList~event:filter-change
 * @listens ActiveModelList~event:active-change
 */
export class ActiveModelList extends ModelList {

    /**
    * Gets or sets the current active item in the list.
    * **NOTE:** Only currently available items can be activated. For example, if you
    * are using {@link module:models.withFiltering withFiltering} then items which
    * have been filtered out can not be activated.
    *
    * @method ActiveModelList#active
    * @param {any} [item] The item to activate. Must be present in the current list.
    * To retrieve the currently active item, do not pass any arguments.
    * @returns {any} The currently active item.
    * @fires ActiveModelList~active-change
    * @example
    * import { modelList, withActive } from '@paychex/core/models';
    *
    * const list = withActive(modelList(1, 2, 3));
    *
    * console.log(list.active());  // 1
    * console.log(list.active(2)); // 2
    * console.log(list.active(5)); // 2
    */
    active() { }

    /**
     * @method ActiveModelList#next
     * @param {boolean} [wrap=false] Whether to wrap back to the start of the
     * list if the currently active item is the last item.
    * @returns {any} The newly activated item, or `null` if at end of list
    * and `wrap` is not truthy.
    * @example
    * import { modelList, withActive } from '@paychex/core/models';
    *
    * const list = withActive(modelList(1, 2, 3));
    * list.active(2);
    * list.next(); // 3
    * list.next(); // null (at end of list)
    * list.next(true); // 1 (wraps to start)
    */
    next() { }

    /**
     * @method ActiveModelList#prev
     * @param {boolean} [wrap=false] Whether to wrap back to the end of the
     * list if the currently active item is the first item.
     * @returns {any} The newly activated item, or `null` if at start of list
     * and `wrap` is not truthy.
     * @example
     * import { modelList, withActive } from '@paychex/core/models';
     *
     * const list = withActive(modelList(1, 2, 3));
     * list.active(2);
     * list.prev(); // 1
     * list.prev(); // null (at start of list)
     * list.prev(true); // 3 (wraps to end)
     */
    prev() { }

    /**
     * Returns `true` if the currently active item is the last item in the list.
     *
     * @member ActiveModelList#atEnd
     * @type {boolean}
     * @readonly
     * @example
     * import { modelList, withActive } from '@paychex/core/models';
     *
     * const list = withActive(modelList(1, 2, 3));
     *
     * list.active(); // 1
     * list.atStart; // true
     * list.atEnd; // false
     *
     * list.next(); // 2
     * list.atStart; // false
     * list.atEnd; // false
     *
     * list.next(); // 3
     * list.atStart; // false
     * list.atEnd; // true
     */
    atEnd = true

    /**
     * Returns `true` if the currently active item is the first item in the list.
     *
     * @member ActiveModelList#atStart
     * @type {boolean}
     * @readonly
     * @example
     * import { modelList, withActive } from '@paychex/core/models';
     *
     * const list = withActive(modelList(1, 2, 3));
     *
     * list.active(); // 1
     * list.atStart; // true
     * list.atEnd; // false
     *
     * list.next(); // 2
     * list.atStart; // false
     * list.atEnd; // false
     *
     * list.next(); // 3
     * list.atStart; // false
     * list.atEnd; // true
     */
    atStart = true

}

/**
 * Adds ordering functionality to an existing {@link ModelList} instance.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 */
export class OrderedModelList extends ModelList {

    /**
     * Orders the internal ModelList collection using the information provided.
     *
     * @method OrderedModelList#orderBy
     * @param {iteratee[]} [iteratees=[identity]] Optional iteratees to use as selector functions.
     * @param {Array<'asc'|'desc'>} [orders=['asc']] Optional sort orders to use for each selector value.
     * @fires OrderedModelList~order-change
     * @example
     * import { modelList, withOrdering } from '@paychex/core/models';
     *
     * const list = modelList(1, 2, 3, 4, 5, 6);
     *
     * list = withOrdering(list, [], ['desc']);
     * list.items(); // [6, 5, 4, 3, 2, 1]
     *
     * list.orderBy(); // identity ascending
     * list.items(); // [1, 2, 3, 4, 5, 6];
     *
     * list.orderBy(num => num % 3);
     * list.items(); // [3, 6, 1, 4, 2, 5];
     * @example
     * import { modelList, withOrdering } from '@paychex/core/models';
     * import { loadNotifications } from '../data/notifications';
     *
     * export async function getNotificationsList() {
     *   const notifications = await loadNotifications();
     *   const list = withOrdering(modelList(notifications));
     *   list.orderBy(['priority', 'date', 'subject'], ['desc', 'desc', 'asc']);
     *   return list;
     * }
     */
    orderBy() { }

}

/**
 * Adds filtering functionality to an existing {@link ModelList} instance.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 */
export class FilteredModelList extends ModelList {

    /**
    * Filters the underlying items in the ModelList collection.
    *
    * @method FilteredModelList#filterBy
    * @param {ModelListPredicate} [filterer=identity] The filter logic to apply.
    * @fires FilteredModelList~filter-change
    * @example
    * import { withFiltering } from '@paychex/core/models';
    * import { getNotificationsList } from '../models/notifications';
    *
    * export async function getUnreadNotifications() {
    *   // wrap an existing ModelList
    *   const list = await getNotificationsList();
    *   return withFiltering(list, ['unread']);
    * }
    * @example
    * import { modelList, withFiltering } from '@paychex/core/models';
    *
    * const isOdd = num => num % 2;
    * const list = withFiltering(modelList(), isOdd);
    *
    * list.add(1, 2, 3, 4, 5);
    * list.items(); // [1, 3, 5]
    *
    * list.filterBy(); // reset filtering
    * list.items(); // [1, 2, 3, 4, 5]
    */
    filterBy() { }

}

/**
 * Adds grouping functionality to an existing {@link ModelList} instance.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 */
export class GroupedModelList extends ModelList {

    /**
    * Groups the underlying items in the ModelList collection.
    *
    * @method GroupedModelList#groupBy
    * @param {Function} [grouper=identity] The grouping logic to apply.
    * @fires GroupedModelList~group-change
    * @example
    * import { withGrouping } from '@paychex/core/models';
    * import { getNotificationsList } from '../models/notifications';
    *
    * export async function groupNotifications() {
    *   // wrap an existing ModelList
    *   const list = await getNotificationsList();
    *   return withGrouping(list, ['status']);
    * }
    * @example
    * import { cond, conforms, constant, stubTrue } from 'lodash';
    * import { modelList, withGrouping } from '@paychex/core/models';
    * import { getClientList } from '../models/client';
    *
    * const lessThan = (max) => (num) => num < max;
    *
    * // function that buckets by employeeCount
    * const employeeBuckets = cond([
    *   [ conforms({ employeeCount: lessThan(10) }), constant('small')  ],
    *   [ conforms({ employeeCount: lessThan(50) }), constant('medium') ],
    *   [ stubTrue,                                  constant('large')  ]
    * ]);
    *
    * export async function getBucketedClientList() {
    *   const list = await getClientList();
    *   return withGrouping(list, employeeBuckets);
    * }
    *
    * // CONSUMER:
    * const clients = await getBucketedClientList();
    * clients.groups(); // { small: [...], medium: [...], large: [...] }
    *
    * clients.groupBy(['region']);
    * clients.groups(); // { 'east': [...], 'north': [...], 'south': [...] }
    */
    groupBy() { }

    /**
     * Returns the groups from the underlying collection. Groups are returned
     * as an object whose keys are the group names; each value is an array of
     * the objects belonging to that group.
     *
     * @method GroupedModelList#groups
     * @returns {Array<string, any[]>} The grouped objects.
     * @example
     * import { withGrouping } from '@paychex/core/models';
     * import { getNotificationsList } from '../models/notifications';
     *
     * export async function groupNotifications() {
     *   // wrap an existing ModelList
     *   const list = await getNotificationsList();
     *   return withGrouping(list, ['status']);
     * }
     *
     * // CONSUMER:
     * const notifications = groupNotifications();
     * notifications.groups(); // { 'read': [...], 'unread': [...] }
     */
    groups() { }

}

/**
 * Tracks which items within the wrapped {@link ModelList} instance
 * are selected at any given time. **NOTE:** Items which are not
 * available through the wrapped ModelList can not be selected.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 * @listens ModelList~event:items-remove
 * @listens FilteredModelList~event:filter-change
 */
export class SelectionModelList extends ModelList {

    /**
    * Gets or sets the currently selected items within the list.
    * **NOTE:** Only currently available items can be selected. For example, if you
    * are using {@link module:models.withFiltering withFiltering} then items which
    * have been filtered out can not be selected.
    *
    * @method SelectionModelList#selected
    * @param {...any} [items] The items to select. Must be present in the current list.
    * To retrieve the currently selected items, do not pass any arguments.
    * @returns {any[]} The currently selected items.
    * @fires SelectionModelList~selection-change
    * @example
    * import { modelList, withSelection } from '@paychex/core/models';
    *
    * const list = withSelection(modelList(1, 2, 3));
    *
    * list.selected();  // []
    * list.selected(2); // [2]
    * list.selected(2, 3); // [2, 3]
    */
    selected() { }

    /**
     * Select all, none, or some of the ModelList items, depending on which
     * are currently selected and which are passed as arguments.
     *
     * When called with no arguments, the behavior of toggle changes depending
     * on whether _none_, _some_, or _all_ items are currently selected:
     *
     * call | condition | result
     * :--- | :--- | :---
     * `toggle()` | selected() == [] | select all items
     * `toggle()` | selected() != items() | select all items
     * `toggle()` | selected() == items() | select no items
     *
     * When passed items, only those items' selection status will be toggled.
     * None of the previously selected items' selection status will change:
     *
     * ```javascript
     * list.selected(); // [1, 2, 3]
     * list.toggle(2);  // [1, 3]
     * list.toggle(2);  // [1, 2, 3]
     * ```
     *
     * @method SelectionModelList#toggle
     * @param {...any} [items] The items to select or deselect. Must be present
     * in the current list. To select or deselect all items, pass no arguments.
     * @returns {any[]} The currently selected items.
     * @fires SelectionModelList~selection-change
     * @example
     * import { modelList, withSelection } from '@paychex/core/models';
     *
     * const list = withSelection(modelList(1, 2, 3));
     *
     * list.selected(); // []
     * list.toggle(); // [1, 2, 3]
     * list.toggle(2); // [1, 3]
     * list.toggle(); // [1, 2, 3]
     * list.toggle(); // []
     * list.toggle(1, 2); // [1, 2]
     */
    toggle() { }

}

/**
 * Provides paging functionality to the wrapped {@link ModelList} instance.
 *
 * **Order of Operations:** Typically, you should call `withPaging` _after_
 * applying any other decorators. This ensures the underling `items` collection
 * represents the correct set of items when calculating page counts.
 *
 * **Note on Active Items:** If you apply paging to a {@link ActiveModelList ActiveModelList}
 * created using the {@link module:models.withActive withActive} decorator, the
 * current page index will update automatically as you change the active item.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 * @listens ModelList~event:items-add
 * @listens ModelList~event:items-remove
 * @listens ActiveModelList~event:active-change
 * @listens FilteredModelList~event:filter-change
 */
export class PagedModelList extends ModelList {

    /**
     * Gets or sets the current page size (the number of items that
     * should be visible on each page.)
     *
     * @method PagedModelList#pageSize
     * @param {number} [size] The number of items to show on each page.
     * Pass no arguments to retrieve the current page size.
     * @returns {number} The current page size.
     * @example
     * import { modelList, withPaging } from '@paychex/core/models';
     *
     * const list = withPaging(modelList());
     *
     * list.pageSize(); // 50 (default page size)
     *
     * list.pageSize(5); // 5
     * list.add(1, 2, 3, 4, 5, 6, 7, 8);
     * list.items(); // [1, 2, 3, 4, 5]
     *
     * list.pageSize(3); // 3
     * list.items(); // [1, 2, 3]
     */
    pageSize() { }

    /**
     * Moves to the next page of items. Does nothing if called on the last page.
     *
     * @method PagedModelList#nextPage
     * @returns {number} The new page index.
     * @fires PagedModelList~page-change
     * @example
     * import { modelList, withPaging } from '@paychex/core/models';
     *
     * const list = withPaging(modelList(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(); // 0
     *
     * list.nextPage();  // 1
     * list.nextPage();  // 2
     * list.nextPage();  // 2 (stops on last page)
     */
    nextPage() { }

    /**
     * Moves to the previous page of items. Does nothing if called on the first page.
     *
     * @method PagedModelList#prevPage
     * @returns {number} The new page index.
     * @fires PagedModelList~page-change
     * @example
     * import { modelList, withPaging } from '@paychex/core/models';
     *
     * const list = withPaging(modelList(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(2); // start on last page
     *
     * list.prevPage();  // 1
     * list.prevPage();  // 0
     * list.prevPage();  // 0 (stops on first page)
     */
    prevPage() { }

    /**
     * Gets or sets the current page index (base 0). If outside the available bounds,
     * the given index will be clamped between 0 and {@link PagedModelList#pageCount pageCount} - 1.
     *
     * @method PagedModelList#pageIndex
     * @param {number} index The new page index.
     * @returns {number} The new page index.
     * @example
     * import { modelList, withPaging } from '@paychex/core/models';
     *
     * const list = withPaging(modelList(1, 2, 3, 4, 5));
     *
     * list.pageSize(2);
     * list.pageIndex(); // 0
     *
     * list.nextPage();
     * list.pageIndex(); // 1
     *
     * list.pageIndex(0); // 0
     * list.pageIndex(15); // 2
     * list.pageIndex(-1); // 0
     */
    pageIndex() { }

    /**
     * Returns the number of pages based on the number of {@link ModelList#items items}
     * and the current {@link PagedModelList#pageSize pageSize}.
     *
     * @member PagedModelList#pageCount
     * @type {number}
     * @readonly
     * @example
     * import { modelList, withPaging } from '@paychex/core/models';
     *
     * const list = withPaging(modelList(1, 2, 3, 4));
     *
     * list.pageSize(10);
     * console.log(list.pageCount); // 1
     *
     * list.pageSize(2);
     * console.log(list.pageCount); // 2
     *
     * list.add(5);
     * console.log(list.pageCount); // 3
     * @example
     * // paging over a filtered list
     * import { modelList, withPaging, withFiltering } from '@paychex/core/models';
     *
     * // order matters! filter first, then page:
     * const list = withPaging(withFiltering(modelList()));
     *
     * list.pageSize(2);
     * list.add(1, 2, 3, 4, 5);
     * console.log(list.pageCount); // 3
     *
     * const isOdd = num => num % 2;
     * list.filterBy(isOdd);
     * console.log(list.pageCount); // 2
     */
    pageCount = 0

}

/**
 * Adds a uniqueness constraint to an existing {@link ModelList}'s items.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends ModelList
 */
export class UniqueModelList extends ModelList {

    /**
     * Applies a uniqueness constraint to the wrapped {@link ModelList} items.
     *
     * @method UniqueModelList#uniqueBy
     * @param {iteratee} [iteratee=identity] Optional iteratee to use as a selector function.
     * @fires UniqueModelList~unique-change
     * @example
     * import { modelList, withUnique } from '@paychex/core/models';
     *
     * const list = withUnique(modelList());
     *
     * list.add(1, 2, 3);
     * list.items(); // [1, 2, 3]
     *
     * list.add(1, 2, 2.5, 3, 4);
     * list.items(); // [1, 2, 2.5, 3, 4]
     *
     * list.uniqueBy(Math.floor);
     * list.items(); // [1, 2, 3, 4]
     */
    uniqueBy() { }

}

/**
 * Adds methods to update a {@link ModelList}'s items based on a more current
 * collection of items.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends UniqueModelList
 */
export class UpdatingModelList extends UniqueModelList {

    /**
     * Adds or updates items in the underlying collection. Does _not_ remove any
     * existing items.
     *
     * @method UpdatingModelList#upsert
     * @param {...any} [items] The items to add or update in the underlying collection.
     * @fires ModelList~items-add
     * @fires UpdatingModelList~items-update
     * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
     * @example
     * import { modelList, withUpdating } from '@paychex/core/models';
     *
     * // our selector can use lodash iteratee
     * const list = withUpdating(modelList(), 'id');
     *
     * list.add({ id: 123, name: 'Alice' });
     * list.add({ id: 456, name: 'Bob' });
     *
     * // update the first entry, keeping the second entry
     * list.upsert({ id: 123, name: 'Alicia' });
     */
    upsert() { }

    /**
     * Adds, updates, _and_ removes items in the underlying collection based on
     * the incoming items.
     *
     * @method UpdatingModelList#merge
     * @param {...any} [items] The items to add or update in the underlying collection.
     * Any items in the existing collection that are _not_ in the incoming collection
     * will be removed.
     * @fires ModelList~items-add
     * @fires ModelList~items-remove
     * @fires UpdatingModelList~items-update
     * @see {@link https://lodash.com/docs/4.17.11#iteratee _.iteratee}
     * @example
     * import { modelList, withUpdating } from '@paychex/core/models';
     *
     * // our selector can use lodash iteratee
     * const list = withUpdating(modelList(), 'id');
     * let users = [
     *   { id: 123, name: 'Alice' },
     *   { id: 456, name: 'Bob' }
     * ];
     *
     * list.add(...users);
     *
     * // update the first entry and REMOVE the second entry
     * users = [ { id: 123, name: 'Alicia' } ];
     * list.merge(...users);
     */
    merge() { }

}

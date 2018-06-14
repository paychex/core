import uniq from 'lodash/uniq';
import merge from 'lodash/merge';
import concat from 'lodash/concat';
import isSet from 'lodash/isSet';
import isArray from 'lodash/isArray';
import { Observable, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map, filter } from 'rxjs/operators';

const EMPTY = '\0';
const data = new WeakMap();
const trigger = new BehaviorSubject();

function triggerChange() {
    trigger.next();
}

function combiner(lhs, rhs) {
    if (isSet(rhs)) return combiner([...lhs], [...rhs]);
    if (isArray(rhs)) return uniq(concat(rhs, lhs));
}

function retrieve(node, key, options) {
    let result, results = [], target = node;
    do {
        result = data.get(target);
        if (result) {
            if (!key) results.unshift(result);
            else if (key in result) results.unshift(result[key]);
        }
        target = options.inherit ? (target.parentNode || target.host) : null;
    } while (target && !target.isSameNode(document));
    if ('default' in options && !results.length)
        results.push(options.default);
    if (!results.length) return EMPTY;
    return options.combine ? merge(...results, combiner) : results.pop();
}

/**
 * Retrieves a value associated with the specified node or its ancestors.
 * 
 * @param {Node} node The node to start the search at.
 * @param {String} [key] The optional key to retrieve. If not specified, returns all associated values.
 * @param {any} [options={}] Options. Default is {inherit: false, sync: false, combine: false, default: undefined}
 * @returns {any|Obsevable<any>} The value associated with the specified node, if {sync:true} was passed. Otherwise,
 *  an Observable instance that will notify observers whenever a value changes.
 */
function get(node, key, options = {}) {
    let value = retrieve(node, key, options);
    return options.sync
        ? value === EMPTY ? undefined : value
        : new Observable((observer) => {
            let target = node;
            const sub = trigger.pipe(
                map(() => retrieve(target, key, options)),
                filter(value => value !== EMPTY),
                distinctUntilChanged()
            ).subscribe(observer);
            return () => {
                target = null;
                sub.unsubscribe();
            };
        });
}

function set(node, key, value) {
    const map = Object.assign({}, data.get(node));
    data.set(node, map);
    map[key] = value;
    triggerChange();
}

function remove(node, key) {
    let result;
    const dict = data.get(node);
    if (!dict) return false;
    if (key) {
        result = delete dict[key];
    } else {
        result = true;
        data.delete(node);
    }
    if (result) triggerChange();
    return result;
}

export default { get, set, delete: remove };

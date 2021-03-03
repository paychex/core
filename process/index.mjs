import {
    noop,
    find,
    last,
    omit,
    keys,
    uniqBy,
    without,
    iteratee,
    isEmpty,
    isString,
    isFunction,
    isPlainObject,
 } from 'lodash-es';

import { rethrow, error } from '../errors/index.mjs';

/**
 * Provides utilities for running complex, multi-step asynchronous processes.
 *
 * ```js
 * // esm
 * import { process } from '@paychex/core';
 *
 * // cjs
 * const { process } = require('@paychex/core');
 *
 * // iife
 * const { process } = window['@paychex/core'];
 *
 * // amd
 * require(['@paychex/core'], function({ process }) { ... });
 * define(['@paychex/core'], function({ process }) { ... });
 * ```
 *
 * **Overview**
 *
 * A process consists of 2 things:
 *
 *  - a collection of actions to invoke
 *  - the logic for picking which actions should run at any given time
 *
 * This abstraction enables both workflow-style processes (multiple steps running in
 * parallel, with some steps dependent on the completion of earlier steps) as well as
 * state machine-style processes (one state active at a time, with the next state
 * determined by examining the process' current set of conditions).
 *
 * You can even set up custom process logic by providing your own {@link ProcessLogic} instance
 * to the {@link module:process.process process} method. See the example {@link ProcessLogic here}.
 *
 * **Action Methods**
 *
 * Each {@link Action} in a process can implement methods that the process will
 * invoke at the appropriate time. These methods can be broken down into 2 categories:
 *
 * 1. exec methods
 * 2. post-exec methods
 *
 * The "exec" methods are run when the action is invoked. These include {@link Action#init init},
 * {@link Action#execute execute} and {@link Action#retry retry}.
 *
 * The "post-exec" methods are run after the process completes. These include
 * {@link Action#rollback rollback}, {@link Action#failure failure}, and
 * {@link Action#success success}.
 *
 * **IMPORTANT!** The post-exec methods are run _in parallel_ and _at the same time_ that
 * the {@link ExecutionPromise} returned by {@link ProcessStart} is resolved or rejected,
 * meaning there is no guaranteed order between your process callbacks and your actions'
 * post-exec methods.
 *
 * @module process
 */

const abort = (err) => Promise.reject(err);
const readonly = (get) => ({ get, enumerable: true });
const resolved = Promise.resolve();
const immediate = (fn) => resolved.then(fn);

const DEFAULTS = {
    init: noop,
    execute: noop,
    retry: abort,
    rollback: noop,
    success: noop,
    failure: noop
};

const IGNORE_KEYS = ['started', 'completed', ...keys(DEFAULTS)];

/**
 * Creates a fully realized {@link Action} for use within a {@link module:process.process process}.
 *
 * @function
 * @param {string} name The name of the process action.
 * @param {AsyncVoidFunction|Action} api The execute method or partial {@link Action} to fill out.
 * @returns {Action}
 * @example
 * async function loadData() {
 *   // make a data call
 * }
 *
 * function processResults() {
 *   // access this.results.load
 *   // value returned will be assigned
 *   // to this.results.process
 * }
 *
 * const actions = models.collection();
 * actions.add(process.action('load', loadData));
 * actions.add(process.action('process', processResults));
 *
 * // "load" should transition to "process" automatically:
 * const criteria = [ ['load', 'process'] ];
 *
 * export const start = process.create('get data', actions, process.transitions(criteria));
 */
export function action(name, api) {
    const result = Object.assign({ name }, DEFAULTS);
    if (isFunction(api))
        result.execute = api;
    else
        Object.assign(result, api);
    return result;
}

function findByName(name) {
    return find(this, { name });
}

function call(method, context, ...args) {
    return new Promise((resolve) =>
        resolve(method.apply(context, args)));
}

function fork(item) {
    const { method, context, args = [] } = this;
    call(item[method], context, ...args);
}

/**
 * Utility method to run a single {@link Action} in isolation.
 * This method is used internally by {@link module:process.process process}
 * but is made available publicly for unusual situations.
 *
 * **NOTE:** The success and failure methods will not be run using this
 * method since their invocation depends on whether or not a collection
 * of Actions has completed successfully. If you want to invoke
 * the success and failure methods, you should do so manually. See the
 * example for details.
 *
 * @function
 * @param {Action} item The Action whose methods should be invoked.
 * @param {ProcessContext} context The context accessed using `this` within an action method.
 * @param {boolean} [initialize=true] Whether to run the Action's init method.
 * @example
 * const step = process.action('something', {
 *   count: 0,
 *   init() { this.count = 0; },
 *   execute() {
 *     console.log(this.args);
 *     this.count = this.count + 1;
 *     return this.count * this.factor;
 *   },
 *   success() {}, // must be invoked manually
 *   failure(err) {}, // must be invoked manually
 * });
 *
 * export async function invokeSomething(...args) {
 *   const context = { args, factor: 3 };
 *   const promise = process.run(step, context);
 *   // invoke success and failure methods
 *   // on separate promise chain than the
 *   // one we return to callers; we don't
 *   // care if these fail and we don't want
 *   // their return values to override the
 *   // return value from the execute method
 *   promise.then(
 *     () => step.success.call(context),
 *     (err) => step.failure.call(context, err)
 *   );
 *   return await promise; // value returned by execute()
 * }
 */
export function run(item, context, initialize = true) {
    const name = item.name;
    const init = initialize && call(item.init, context);
    const fail = rethrow({ action: name });
    const ctx = { ...context, ...omit(item, IGNORE_KEYS) };
    const recurse = () => run(item, ctx, false);
    const execute = () => call(item.execute, ctx);
    const retry = err => call(item.retry, ctx, err).then(recurse);
    const update = result => context.results[name] = result;
    return Promise.resolve(init)
        .then(execute)
        .catch(retry)
        .catch(fail)
        .then(update);
}

/**
 * Returns a method you can invoke to begin a complex asynchronous process.
 * The order of actions taken is determined using the {@link ProcessLogic}
 * object passed as the last argument. You can use the built-in {@link dependencies}
 * and {@link transitions} logic factories to create this object for you,
 * or supply your own logic to create custom process behaviors.
 *
 * @function
 * @param {string} name The name of the process to run.
 * @param {Iterable<Action>} actions An interable collection (e.g. Set, array, or {@link ModelList}) of {@link Action}s to run.
 * @param {ProcessLogic} logic The logic that determines how to start and continue a process.
 * @returns {ProcessStart} A method you can invoke to begin the process. The arguments will
 * depend in part on the {@link ProcessLogic} object you passed.
 * @example
 * // workflow
 *
 * import { loadUserInfo } from '../data/user';
 * import { loadClientData } from '../data/clients';
 *
 * import { start } from '../path/to/machine';
 *
 * const actions = models.collection();
 *
 * actions.add(process.action('loadUserInfo', loadUserInfo));
 *
 * actions.add(process.action('loadClientData', {
 *   async execute() {
 *     const clientId = this.args[0];
 *     return await loadClientData(clientId)
 *       .catch(errors.rethrow({ clientId }));
 *   }
 * }));
 *
 * actions.add(process.action('merge', {
 *   execute() {
 *     const user = this.results.loadUserInfo;
 *     const clients = this.results.loadClientData;
 *     return Object.assign({}, user, { clients });
 *   }
 * }));
 *
 * actions.add(process.action('eula', function execute() {
 *   const conditions = this.results;
 *   return start('initial', conditions);
 * }));
 *
 * export const dispatch = process.create('load user clients', actions, process.dependencies({
 *   'eula': ['merge'],
 *   'merge': ['loadUserInfo', 'loadClientData'],
 * }));
 *
 * // USAGE: dispatch(clientId);
 * @example
 * // state machine
 *
 * import { tracker } from '~/tracking';
 * import { showDialog } from '../some/dialog';
 * import { dispatch } from '../some/workflow';
 *
 * const actions = new Set();
 *
 * // if no start state is explicitly passed to the start()
 * // method then this first action will be used automatically
 * actions.add(process.action('start', {
 *   success() {
 *     tracker.event(`${this.process} succeeded`);
 *   },
 *   failure(err) {
 *     Object.assign(err, errors.fatal());
 *     tracker.error(err);
 *   }
 * }));
 *
 * actions.add(process.action('show dialog', {
 *   execute() {
 *     return showDialog('accept.cookies');
 *   }
 * }));
 *
 * // we can dispatch a workflow in one of our actions
 * actions.add(process.action('run workflow', function execute() {
 *   const cookiesEnabled = this.results['show dialog'];
 *   const ignoreError = errors.rethrow(errors.ignore({ cookiesEnabled }));
 *   return dispatch(cookiesEnabled).catch(ignoreError);
 * }));
 *
 * actions.add(process.action('stop', function() {
 *   this.stop(); // stop the machine
 * }));
 *
 * const transitions = process.transitions([
 *
 *   // show the dialog after starting the machine
 *   ['start', 'show dialog'],
 *
 *   // only run the workflow if the user has not
 *   // logged in within the past 2 weeks
 *   ['show dialog', 'run workflow', function notRecentlyLoggedIn() {
 *     const TWO_WEEKS = 1000 * 60 * 60 * 24 * 7 * 2;
 *     const lastLogin = Date.parse(localStorage.getItem('lastLogin'));
 *     return lastLogin < Date.now() - TWO_WEEKS;
 *   }],
 *
 *   // only if the above transition's condition returns
 *   // false (i.e. the user has recently logged in) will
 *   // this next transition will be evaluated; and since
 *   // this next transition always returns true, the machine
 *   // will always have a path forward
 *   ['show dialog', 'stop'],
 *
 *   // if we did get into the "run workflow" state, make
 *   // sure we stop the workflow afterwards
 *   ['run workflow', 'stop']
 *
 * ]);
 *
 * export const start = process.create('intro', actions, transitions);
 */
export function create(name, actions, logic) {

    const threads = uniqBy(Array.from(actions), 'name');
    const { getInitialActions, getNextActions, contextFromArgs = noop } = logic;

    function runActions(items, ctx) {
        return ctx.runtimeInfo.cancelled ?
            Promise.resolve() :
            Promise.all(items.map(runAction, ctx));
    }

    function runAction(item) {
        const { context, runtimeInfo } = this;
        context.started.push(item.name);
        runtimeInfo.active = true;
        return run(item, context)
            .then(() => context.completed.push(item.name))
            .then(() => {
                const next = getNextActions(threads, context);
                return runActions(next, this);
            })
            .then(() => runtimeInfo.active = false);
    }

    return function start(...args) {

        function callRollback(err) {
            context.started
                .map(findByName, threads)
                .forEach(fork, { method: 'rollback', context, args: [err] });
            throw err;
        }

        function callFailure(err) {
            threads.forEach(fork, { method: 'failure', context, args: [err] });
            throw err;
        }

        function callSuccess(result) {
            threads.forEach(fork, { method: 'success', context });
            return result;
        }

        let cancel, update, stop;

        const context = Object.freeze(Object.defineProperties({
            args,
            conditions: {},
            results: {},
            started: [],
            completed: [],
            ...contextFromArgs(args)
        }, {
            stop:   readonly(() => stop),
            cancel: readonly(() => cancel),
            update: readonly(() => update),
        }));

        const runtimeInfo = { active: false, cancelled: false };

        const throwError = rethrow(Object.defineProperties({}, {
            process:    readonly(() => name),
            completed:  readonly(() => context.completed.slice()),
            running:    readonly(() => without(context.started, context.completed))
        }));

        const promise = new Promise(function ProcessPromise(resolve, reject) {

            update = function updateProcess(conditions = {}) {
                Object.assign(context.conditions, conditions);
                if (!runtimeInfo.active) {
                    const next = getNextActions(threads, context);
                    runActions(next, { context, runtimeInfo }).catch(reject);
                }
            };

            cancel = function cancelProcess(data = {}) {
                runtimeInfo.cancelled = true;
                reject(error('Process cancelled.', data));
            };

            stop = function stopProcess() {
                runtimeInfo.cancelled = true;
                resolve(context.results);
            };

            if (isEmpty(threads))
                return resolve(context.results);

            return immediate(() => {
                const startActions = getInitialActions(threads, context);
                return runActions(startActions, { context, runtimeInfo }).catch(reject);
            });

        })
            .catch(throwError)
            .catch(callRollback)
            .catch(callFailure)
            .then(callSuccess);

        return Object.assign(promise, { cancel, update, stop } = context);

    };

}

/**
 * Creates a {@link ProcessLogic} instance that can be passed to the {@link module:process.process process}
 * method. When started, the process will use the dependency map to determine which {@link Action actions}
 * can be invoked immediately (having no dependencies) and which should be run when their dependent actions
 * have completed.
 *
 * This method results in the process running like a _workflow_, with some actions run in parallel
 * and the execution order of actions dependent upon the stated dependencies.
 *
 * @function
 * @param {Object.<string, string[]>} [deps={}] The dependency map that should be used
 * to determine the initial and follow-up {@link Action actions} to invoke in this
 * process.
 * @returns {ProcessLogic} A ProcessLogic instance that {@link module:process.process process}
 * can use to determine how to run the {@link ModelList} {@link Action actions} it was provided.
 * @example
 * const dependencies = process.dependencies({
 *   'step b': ['step a'], // action b runs after action a
 *   'step c': ['step b', 'step d'] // action c runs after actions b and d
 * });
 *
 * const actions = [
 *   process.action('step a', () => console.log('step a run')),
 *   process.action('step b', () => console.log('step b run')),
 *   process.action('step c', () => console.log('step c run')),
 *   process.action('step d', () => console.log('step d run')),
 * ];
 *
 * export const dispatch = process.create('my workflow', actions, dependencies);
 * @example
 * const actions = [
 *   process.action('start', function execute() {
 *     console.log('args:', this.args);
 *   }),
 *   process.action('parallel 1', function execute() {
 *     console.log('in', this.name);
 *   }),
 *   process.action('parallel 2', function execute() {
 *     console.log('in', this.name);
 *   }),
 * ];
 *
 * const order = process.dependencies({
 *   'parallel 1': ['start'],
 *   'parallel 2': ['start'],
 * });
 *
 * export const dispatch = process('my workflow', actions, order);
 *
 * // USAGE:
 * // dispatch(123, 'abc');
 */
export function dependencies(deps = {}) {

    function readyToRun(step) {
        const name = step.name;
        const required = deps[name] || [];
        const { completed, started } = this;
        const depsCompleted = required.every(Array.prototype.includes, completed);
        const notStarted = !started.includes(name);
        return notStarted && depsCompleted;
    }

    function getActions(actions, context) {
        if (context.completed.length === actions.length)
            return context.stop();
        return actions.filter(readyToRun, context);
    }

    return {
        getNextActions: getActions,
        getInitialActions: getActions,
    };

}

/**
 * Creates a {@link ProcessLogic} instance that can be passed to the {@link module:process.process process}
 * method. When started, the process will use the transition criteria to determine which {@link Action actions}
 * can be invoked based on the current set of {@link ProcessContext#conditions conditions} as passed to
 * the {@link ProcessStart start} method *or* through calls to {@link ExecutionUpdate update}.
 *
 * **NOTE:** A process using transitions logic will not stop until and unless one of the following occurs:
 *  - someone invokes the `stop()` method
 *  - someone invokes the `cancel()` method
 *  - a {@link Action} method throws an Error or returns a rejected Promise
 *
 * This method results in the process running like a _state machine_, with one action allowed to run at any
 * time and the next action determined using the current conditions and the given transition logic.
 *
 * @function
 * @param {ProcessTransitions} [criteria=[]] The transitions that should be used
 * to determine the initial and follow-up {@link Action actions} to invoke in this
 * process.
 * @returns {ProcessLogic} A ProcessLogic instance that {@link module:process.process process}
 * can use to determine how to run the {@link ModelList} {@link Action actions} it was provided.
 * @example
 * const states = models.collection();
 *
 * states.add(process.action('start', () => console.log('start')));
 * states.add(process.action('next',  () => console.log('next')));
 * states.add(process.action('stop',  function() {
 *   this.stop();
 * }));
 *
 * const criteria = process.transitions([
 *   ['start', 'next'],
 *   ['next', 'stop']
 * ]);
 *
 * export const start = process('my machine', states, criteria);
 *
 * // USAGE:
 * start();
 * start('next');
 * start('stop', { initial: 'conditions' });
 * // you can also just provide initial conditions;
 * // the first action will still be used as the start action
 * start({ initial: 'conditions' });
 */
export function transitions(criteria = []) {

    function isNextState([from, _, condition]) {
        const current = last(this.completed);
        const predicate = iteratee(condition);
        return from === current && predicate(this.conditions);
    }

    function getNextActions(actions, context) {
        const transition = criteria.find(isNextState, context);
        const next = transition && findByName.call(actions, transition[1]);
        return next ? [next] : [];
    }

    function getInitialActions(actions, context) {
        const start = findByName.call(actions, context.start) || actions[0];
        return start ? [start] : [];
    }

    function contextFromArgs(args) {
        const start = args.find(isString);
        const conditions = args.find(isPlainObject) || {};
        return { start, conditions };
    }

    return {
        getNextActions,
        getInitialActions,
        contextFromArgs,
    };

}

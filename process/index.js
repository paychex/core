import noop from 'lodash/noop';
import find from 'lodash/find';
import last from 'lodash/last';
import omit from 'lodash/omit';
import keys from 'lodash/keys';
import uniqBy from 'lodash/uniqBy';
import without from 'lodash/without';
import iteratee from 'lodash/iteratee';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';
import isPlainObject from 'lodash/isPlainObject';

import { rethrow, error } from '../errors';

/**
 * Provides utilities for running complex, multi-step asynchronous processes.
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
 * Encapsulates the business logic for a single action within a multi-step asynchronous process.
 *
 * @global
 * @interface Action
 * @see {@link module:process.action action} factory method
 */

/**
 * The name of the process action. Should be unique within a given process instance.
 *
 * @member Action#name
 * @type {string}
 */

/**
 * Runs once per process invocation. Can be used to initialize local variables or set up starting conditions.
 *
 * @method Action#init
 * @returns {*}
 * @this ProcessContext
 * @async
 * @example
 * import { action } from '@paychex/core/process';
 *
 * const multiply = action('multiply', {
 *   factor: 2,
 *   init() {
 *     // NOTE: args are passed to the
 *     // process' start function
 *     const [factor, _] = this.args;
 *     this.factor = factor || 2;
 *   },
 *   execute() {
 *     const [_, operand] = this.args;
 *     return operand * this.factor;
 *   }
 * });
 */

/**
 * Performs the bulk of the action's business logic. The value returned from
 * this method (or the resolved value of the Promise returned by this method)
 * will be assigned to the `results` map automatically.
 *
 * If you return a Promise, dependent actions will not be run until the Promise
 * has resolved. If the Promise rejects or if the execute method throws an
 * Error, the action's {@link Action#retry retry} method will be run. If
 * that method throws or rejects, the entire process will be aborted.
 *
 * @method Action#execute
 * @returns {*}
 * @this ProcessContext
 * @async
 * @example
 * import { action } from '@paychex/core/process';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = action('load', {
 *   async execute() {
 *     return await someAsyncOperation(...this.args);
 *   }
 * });
 */

/**
 * This method is invoked if the {@link Action#execute execute} method throws
 * or returns a rejected Promise. If this method also throws or rejects (which is
 * the default behavior) then the entire process will be aborted.
 *
 * @method Action#retry
 * @param {Error} error The Error raised by the {@link Action#execute execute} method
 *  or returned as the rejection reason of that method's Promise.
 * @returns {*}
 * @this ProcessContext
 * @async
 * @example
 * import { action } from '@paychex/core/process';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = action('load', {
 *   errorCount: 0,
 *   init() {
 *     this.errorCount = 0;
 *   },
 *   async execute() {
 *     return await someAsyncOperation(...this.args);
 *   },
 *   retry(err) {
 *     err.errorCount = ++this.errorCount;
 *     if (this.errorCount < 3)
 *       return Promise.resolve(); // try again
 *     return Promise.reject(); // do not retry
 *   }
 * });
 */

/**
 * This method is invoked if the action ran but the process was aborted.
 * You can use this opportunity to undo any behaviors performed in the
 * {@link Action#execute execute} method.
 *
 * @method Action#rollback
 * @returns {*}
 * @this ProcessContext
 * @async
 * @example
 * import { action } from '@paychex/core/process';
 * import { localStore } from '@paychex/core/stores';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = action('load', {
 *   store: localStore(),
 *   async execute() {
 *     const result = await someAsyncOperation(...this.args);
 *     this.store.set('my data cache', result);
 *     return result;
 *   },
 *   async rollback() {
 *     return this.store.delete('my data cache');
 *   }
 * });
 */

/**
 * This method runs if _any_ action of the process fails (even if this
 * action was not previous executed). It provides a cross-cutting way
 * to respond to errors caused by other actions.
 *
 * @method Action#failure
 * @param {Error} error The Error that failed the process.
 * @returns {*}
 * @this ProcessContext
 * @async
 * @example
 * import { tracker } from '~/tracking';
 * import { action } from '@paychex/core/process';
 *
 * const logger = action('log process failure', {
 *   failure(err) {
 *     tracker.error(err);
 *   }
 * });
 */

/**
 * This method runs if and when the entire process resolves. It provides a
 * cross-cutting way to respond to the overall success of a complex process.
 *
 * @method Action#success
 * @returns {*}
 * @async
 * @this ProcessContext
 * @example
 * import { tracker } from '~/tracking';
 * import { action } from '@paychex/core/process';
 *
 * const logger = action('log process sucess', {
 *   success() {
 *     tracker.event(`${this.process} successful`, this.results);
 *   }
 * });
 */

/**
 * Creates a fully realized {@link Action} for use within a {@link module:process.process process}.
 *
 * @function
 * @param {string} name The name of the process action.
 * @param {Action#execute|Action} api The execute method or partial {@link Action} to fill out.
 * @returns {Action}
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process, transitions } from '@paychex/core/process';
 *
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
 * const actions = modelList();
 * actions.add(action('load', loadData));
 * actions.add(action('process', processResults));
 *
 * // "load" should transition to "process" automatically:
 * const criteria = [ ['load', 'process'] ];
 *
 * export const start = process('get data', actions, transitions(criteria));
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process, transitions } from '@paychex/core/process';
 *
 * export const start = process('double', modelList(
 *   action('double', {
 *     someVariable: 123,
 *     execute() {
 *       return this.someVariable * 2;
 *     },
 *     success() {
 *       console.log(this.results);
 *     }
 *   })
 * ), transitions());
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

function fork(action) {
    const { method, context, args = [] } = this;
    call(action[method], context, ...args);
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
 * @param {Action} action The Action whose methods should be invoked.
 * @param {ProcessContext} context The context accessed using `this` within an action method.
 * @param {boolean} [initialize=true] Whether to run the Action's init method.
 * @example
 * import { action, run } from '@paychex/core/process';
 *
 * const step = action('something', {
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
 *   const promise = run(step, context);
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
export function run(action, context, initialize = true) {
    const name = action.name;
    const init = initialize && call(action.init, context);
    const fail = rethrow({ action: name });
    const ctx = { ...context, ...omit(action, IGNORE_KEYS) };
    const recurse = () => run(action, ctx, false);
    const execute = () => call(action.execute, ctx);
    const retry = error => call(action.retry, ctx, error).then(recurse);
    const update = result => context.results[name] = result;
    return Promise.resolve(init)
        .then(execute)
        .catch(retry)
        .catch(fail)
        .then(update);
}

/**
 * Contains information about the running {@link module:process.process process}.
 * In addition to the members listed here, the object returned by {@link ProcessLogic}'s
 * {@link ProcessLogic#contextFromArgs contextFromArgs} will be mixed in.
 *
 * @global
 * @typedef {object} ProcessContext
 * @property {any[]} args The arguments passed to {@link ProcessStart}.
 * @property {object} conditions Any values passed to {@link ExecutionUpdate update} or
 * provided as the 2nd argument to the {@link module:process.transitions transitions} {@link ProcessContext}.
 * @property {object} results A key-value map of the values returned by each {@link Action#execute execute} method.
 * @property {string[]} started The names of {@link Action actions} that have been started in the current process.
 * @property {string[]} completed The names of {@link Action actions} that have run to completion in the current process.
 * @property {ExecutionCancel} cancel Reject/abort the running process immediately.
 * @property {ExecutionStop} stop End/resolve the running process immediately.
 * @property {ExecutionUpdate} update Update the current set of conditions for the running process.
 */

/**
 * An object used by {@link module:process.process process} to determine which
 * {@link Action actions} should be executed and under what circumstances.
 *
 * @global
 * @interface ProcessLogic
 * @see {@link module:process.transitions transitions factory method}
 * @see {@link module:process.dependencies dependencies factory method}
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process } from '@paychex/core/process';
 *
 * const actions = modelList(
 *   action('a', () => console.log('running a')),
 *   action('b', () => console.log('running b')),
 *   action('c', () => console.log('running c')),
 * );
 *
 * const inParallel = {
 *   getInitialActions(actions, context) {
 *     return actions;
 *   },
 *   contextFromArgs(args) {
 *     const value = args.shift();
 *     return { key: value };
 *   }
 * };
 *
 * export const run = process('my process', actions, inParallel);
 * // USAGE: run('some value');
 */

/**
 * Returns an array of {@link Action actions} to run. This method is
 * called when {@link ExecutionUpdate update} is invoked (if no actions
 * are currently running) as well as whenever the previous set of actions
 * resolves. Return an empty array if the process should not do anything.
 *
 * @method ProcessLogic#getNextActions
 * @param {ModelList} actions The actions available for the process.
 * @param {ProcessContext} context Information about the running process.
 * @returns {Action[]} An array of actions to run.
 * @example
 * function getNextActions(actions, context) {
 *   // restrict parallel actions to a maximum of 5 at once:
 *   return actions
 *     .filter(action => !context.started.includes(action.name))
 *     .slice(0, 5);
 * }
 */

/**
 * Returns an array of {@link Action actions} to run when the process
 * is started. Return an empty array if the process should not do anything.
 *
 * @method ProcessLogic#getInitialActions
 * @param {ModelList} actions The actions available for the process.
 * @param {ProcessContext} context Information about the running process.
 * @returns {Action[]} An array of actions to run.
 * @example
 * // retrieve the action at the index passed
 * // to the start method returned by process(...)
 * // -- e.g. start(3) uses the 4th action
 * function getInitialActions(actions, context) {
 *   const index = context.args[0] || 0;
 *   const first = actions[index] || actions[0];
 *   return [ first ]; // always return an array
 * }
 */

/**
 * Generates the appropriate context object based on the arguments the user
 * has passed to the {@link ProcessStart} method.
 *
 * @method ProcessLogic#contextFromArgs
 * @param {any[]} args The arguments the user passed to the {@link ProcessStart} method.
 * @returns {object} An object that will be mixed into the running process's context
 * and passed to any {@link Action} methods as `this`.
 * @example
 * import merge from 'lodash/merge';
 *
 * // use whatever arguments were passed to start() as the context;
 * // e.g. start({key: 'value'}, {another: 'value'}) would return a
 * // context that combines both those objects
 * function contextFromArgs(args) {
 *   return merge({}, ...args);
 * }
 */

/**
 * The method you invoke to begin an asynchronous process.
 *
 * @global
 * @callback ProcessStart
 * @param {...any} [args] The arguments to invoke the process with. Which
 * arguments you pass will depend on the {@link ProcessLogic} instance
 * you passed to {@link module:process.process process}.
 * @returns {ExecutionPromise} A Promise that will be resolved or rejected
 * based on the process' running {@link Action actions}. In addition to
 * typical Promise methods, a few additional methods have been added to this
 * instance to interact with the running process.
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process, dependencies, transitions } from '@paychex/core/process';
 *
 * const actions = modelList(
 *   action('a', () => console.log('a')),
 *   action('b', () => console.log('b')),
 *   action('c', () => console.log('c')),
 * );
 *
 * const deps = dependencies({ 'b': ['a', 'c'] });
 * const trans = transitions([ ['a', 'c'], ['c', 'b']]);
 *
 * const dispatch = process('workflow', actions, deps);
 * const start = process('state machine', actions, trans);
 *
 * const workflowPromise = dispatch('arg 1', 'arg 2');
 * const machinePromise = start('a', { condition: 'value' });
 */

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
 * import { rethrow } from '@paychex/core/errors';
 * import { modelList } from '@paychex/core/models';
 * import { action, process, dependencies } from '@paychex/core/process';
 *
 * import { loadUserInfo } from '../data/user';
 * import { loadClientData } from '../data/clients';
 *
 * import { start } from '../path/to/machine';
 *
 * const actions = modelList();
 *
 * actions.add(action('loadUserInfo', loadUserInfo));
 *
 * actions.add(action('loadClientData', {
 *   async execute() {
 *     const clientId = this.args[0];
 *     return await loadClientData(clientId)
 *       .catch(rethrow({ clientId }));
 *   }
 * }));
 *
 * actions.add(action('merge', {
 *   execute() {
 *     const user = this.results.loadUserInfo;
 *     const clients = this.results.loadClientData;
 *     return Object.assign({}, user, { clients });
 *   }
 * }));
 *
 * actions.add(action('eula', function execute() {
 *   const conditions = this.results;
 *   return start('initial', conditions);
 * }));
 *
 * export const dispatch = process('load user clients', actions, dependencies({
 *   'eula': ['merge'],
 *   'merge': ['loadUserInfo', 'loadClientData'],
 * }));
 *
 * // USAGE: dispatch(clientId);
 * @example
 * // state machine
 * import { tracker } from '~/tracking';
 * import { action, process, transitions } from '@paychex/core/process';
 * import { rethrow, fatal, ignore } from '@paychex/core/errors';
 *
 * import { showDialog } from '../some/dialog';
 * import { dispatch } from '../some/workflow';
 *
 * const actions = new Set();
 *
 * // if no start state is explicitly passed to the start()
 * // method then this first action will be used automatically
 * actions.add(action('start', {
 *   success() {
 *     tracker.event(`${this.process} succeeded`);
 *   },
 *   failure(err) {
 *     Object.assign(err, fatal());
 *     tracker.error(err);
 *   }
 * }));
 *
 * actions.add(action('show dialog', {
 *   execute() {
 *     return showDialog('accept.cookies');
 *   }
 * }));
 *
 * // we can dispatch a workflow in one of our actions
 * actions.add(action('run workflow', function execute() {
 *   const cookiesEnabled = this.results['show dialog'];
 *   const ignoreError = rethrow(ignore({ cookiesEnabled }));
 *   return dispatch(cookiesEnabled).catch(ignoreError);
 * }));
 *
 * actions.add(action('stop', function() {
 *   this.stop(); // stop the machine
 * }));
 *
 * const criteria = [
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
 * ];
 *
 * export const start = process('intro', actions, transitions(criteria));
 * @example
 * // workflow used within a saga
 * import { call, takeEvery } from 'redux-saga/effects';
 *
 * import { addSaga } from '~/store';
 * import { action, process, dependencies } from '@paychex/core/process';
 *
 * const actions = [
 *   action('a', () => console.log('a')),
 *   action('b', () => console.log('b')),
 *   action('c', () => console.log('c')),
 * ];
 *
 * const dispatch = process('saga handler', actions, dependencies({
 *   b: ['a'],
 *   c: ['b', 'a']
 * }));
 *
 * addSaga(function* saga() {
 *   yield takeEvery('some-action', function* run(action) {
 *     yield call(dispatch, action.payload);
 *   });
 * });
 * @example
 * // state machine used within a saga
 * import { call, takeEvery } from 'redux-saga/effects';
 *
 * import { addSaga } from '~/store';
 * import { action, process, transitions } from '@paychex/core/process';
 *
 * const actions = [
 *   action('a', () => console.log('a')),
 *   action('b', () => console.log('b')),
 *   action('c', function() { this.stop(); }),
 * ];
 *
 * const start = process('saga handler', actions, transitions([
 *   ['a', 'b'],
 *   ['b', 'c']
 * ]));
 *
 * addSaga(function* saga() {
 *   yield takeEvery('some-action', function* run(action) {
 *     const conditions = action.payload;
 *     yield call(start, 'a', conditions);
 *   });
 * });
 */
export function process(name, actions, logic) {

    const threads = uniqBy(Array.from(actions), 'name');
    const { getInitialActions, getNextActions, contextFromArgs = noop } = logic;

    function runActions(actions, ctx) {
        return ctx.runtimeInfo.cancelled ?
            Promise.resolve() :
            Promise.all(actions.map(runAction, ctx));
    }

    function runAction(action) {
        const name = action.name;
        const { context, runtimeInfo } = this;
        context.started.push(name);
        runtimeInfo.active = true;
        return run(action, context)
            .then(() => context.completed.push(name))
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

            update = function update(conditions = {}) {
                Object.assign(context.conditions, conditions);
                if (!runtimeInfo.active) {
                    const next = getNextActions(threads, context);
                    runActions(next, { context, runtimeInfo }).catch(reject);
                }
            };

            cancel = function cancel(data = {}) {
                runtimeInfo.cancelled = true;
                reject(error('Process cancelled.', data));
            };

            stop = function stop() {
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
 * @param {ProcessDependencyMap} [deps={}] The dependency map that should be used
 * to determine the initial and follow-up {@link Action actions} to invoke in this
 * process.
 * @returns {ProcessLogic} A ProcessLogic instance that {@link module:process.process process}
 * can use to determine how to run the {@link ModelList} {@link Action actions} it was provided.
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process, dependencies } from '@paychex/core/process';
 *
 * const actions = modelList(
 *   action('start', function execute() {
 *     console.log('args:', this.args);
 *   }),
 *   action('parallel 1', function execute() {
 *     console.log('in', this.name);
 *   }),
 *   action('parallel 2', function execute() {
 *     console.log('in', this.name);
 *   }),
 * }));
 *
 * const order = dependencies({
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

    function readyToRun(action) {
        const name = action.name;
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
 * import { modelList } from '@paychex/core/models';
 * import { action, process, transitions } from '@paychex/core/process';
 *
 * const states = modelList();
 *
 * states.add(action('start', () => console.log('start')));
 * states.add(action('next',  () => console.log('next')));
 * states.add(action('stop',  function() {
 *   this.stop();
 * }));
 *
 * const criteria = [
 *   ['start', 'next'],
 *   ['next', 'stop']
 * ];
 *
 * export const start = process('my machine', states, transitions(criteria));
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

/**
 * A map of {@link Action action} names to their dependencies.
 *
 * @global
 * @typedef {Object.<string, string[]>} ProcessDependencyMap
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { action, process, dependencies } from '@paychex/core/process';
 *
 * const map = {
 *   'step b': ['step a'], // action b runs after action a
 *   'step c': ['step b', 'step d'] // action c runs after actions b and d
 * };
 *
 * const actions = modelList(
 *   action('step a', () => console.log('step a run')),
 *   action('step b', () => console.log('step b run')),
 *   action('step c', () => console.log('step c run')),
 *   action('step d', () => console.log('step d run')),
 * );
 *
 * export const dispatch = process('my workflow', actions, dependencies(map));
 */

/**
 * Invoked to update the set of conditions used within the running process.
 *
 * **NOTE:** This method updates the conditions used by the {@link ProcessLogic}
 * returned by {@link module:process.dependencies dependencies}.
 *
 * @global
 * @callback ExecutionUpdate
 * @param {object} [conditions={}] The conditions to merge into the process' internal set of conditions.
 */

/**
 * Invoked to stop the running process, immediately rejecting the promise. No further actions will be run.
 *
 * @global
 * @callback ExecutionCancel
 * @param {object} [data={}] Optional data to merge into the Error the promise will be rejected with.
 */

/**
 * Invoked to stop the running process, immediately resolving the promise. No further actions will be run.
 *
 * @global
 * @callback ExecutionStop
 */

/**
 * Provides normal Promise functionality plus the ability to update,
 * cancel, or stop a running process.
 *
 * **NOTE:** The `update` method is primarily used to change conditions
 * for a running {@link module:process.process process}.
 *
 * @global
 * @typedef {Promise} ExecutionPromise
 * @property {ExecutionUpdate} update Updates the set of conditions used within a running process.
 * @property {ExecutionCancel} cancel Cancels the running promise, rejecting the promise.
 * @property {ExecutionStop} stop Stops the running promise, resolving the promise.
 * @example
 * import { start } from '../path/to/machine';
 * import { dispatch } from '../path/to/workflow';
 *
 * const execution = start(); // default start state, no conditions
 * // OR:
 * // const execution = dispatch(); // no args for workflow
 *
 * // update the running conditions:
 * execution.update({ condition: 'value' });
 *
 * // cancel the state machine early (rejects the promise):
 * execution.cancel();
 * execution.cancel({ error: 'property' });
 *
 * // stop the machine early (resolves the promise):
 * execution.stop();
 *
 * // of course, we can also chain off the execution promise:
 * execution.then(console.log, console.error);
 */

/**
 * @global
 * @typedef {Array} ProcessTransition
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * // automatic transition when first action ends
 * const transition = ['from step', 'to step'];
 * @example
 * // transition if the machine's current conditions match this set
 * const transition = ['from step', 'to step', { condition: 'value', another: 'condition' }];
 * @example
 * // transition if the machine's current conditions has a truthy value for 'property'
 * const transition =  ['from step', 'to step', 'property'];
 * @example
 * // transition if the machine's current conditions have a 'property' key with a 'value' value
 * const transition =  ['from step', 'to step', ['property', 'value']];
 * @example
 * // transition if the function returns true
 * const transition =  ['from step', 'to step', function(conditions) {
 *   switch(conditions.key) {
 *     case 'value 1': return true;
 *     case 'value 2': return conditions.another > 12;
 *     default: return false;
 *   }
 * }]
 * @example
 * // transition if the current condition values match the corresponding predicates
 * import { conforms, isNil, isNumber } from 'lodash';
 *
 * const transition = ['from step', 'to step', conforms({
 *   'error': isNil,
 *   'value': isNumber,
 *   'property': (value) => value > 0 && value < 100
 * })];
 */

/**
 * An array of transition criteria.
 *
 * @global
 * @typedef {ProcessTransition[]} ProcessTransitions
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * import { conforms, isNil, isNumber } from 'lodash';
 *
 * const transitions = [
 *
 *   // automatic transition when first action ends
 *   ['from step', 'to step'],
 *
 *   // transition if the machine's current conditions match this set
 *   ['from step', 'to step', { condition: 'value', another: 'condition' }],
 *
 *   // transition if the machine's current conditions has a truthy value for 'property'
 *   ['from step', 'to step', 'property'],
 *
 *   // transition if the machine's current conditions have a 'property' key with a 'value' value
 *   ['from step', 'to step', ['property', 'value']],
 *
 *   // transition if the function returns true
 *   ['from step', 'to step', function(conditions) {
 *     switch(conditions.key) {
 *       case 'value 1': return true;
 *       case 'value 2': return conditions.another > 12;
 *       default: return false;
 *     }
 *   }],
 *
 *   // transition if the current condition values match the corresponding predicates
 *   ['from step', 'to step', conforms({
 *     'error': isNil,
 *     'value': isNumber,
 *     'property': (value) => value > 0 && value < 100
 *   })]
 *
 * ];
 */

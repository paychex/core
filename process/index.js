import noop from 'lodash/noop.js';
import find from 'lodash/find.js';
import last from 'lodash/last.js';
import omit from 'lodash/omit.js';
import keys from 'lodash/keys.js';
import uniqBy from 'lodash/uniqBy.js';
import without from 'lodash/without.js';
import iteratee from 'lodash/iteratee.js';
import isEmpty from 'lodash/isEmpty.js';
import isString from 'lodash/isString.js';
import isFunction from 'lodash/isFunction.js';
import isPlainObject from 'lodash/isPlainObject.js';

import { rethrow, error } from '../errors/index.js';

import {
    Action,
    ProcessLogic,
    ProcessContext,
    ExecutionPromise,
    ProcessTransitions,
} from '../types/process.js';

class UnusedAction extends Action {}
class UnusedProcessLogic extends ProcessLogic {}
class UnusedProcessContext extends ProcessContext {}
class UnusedExecutionPromise extends ExecutionPromise {}
class UnusedProcessTransitions extends ProcessTransitions {}

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
 * The method you invoke to begin an asynchronous process.
 *
 * @async
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

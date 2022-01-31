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
 * to the {@link process} method. See the example {@link ProcessLogic here}.
 *
 * **Action Methods**
 *
 * Each {@link Action} in a process can implement methods that the process will
 * invoke at the appropriate time. These methods can be broken down into 2 categories:
 *
 * 1. exec methods
 * 2. post-exec methods
 *
 * The "exec" methods are run when the action is invoked. These include {@link init},
 * {@link execute} and {@link Action.retry retry}.
 *
 * The "post-exec" methods are run after the process completes. These include
 * {@link rollback}, {@link failure}, and
 * {@link success}.
 *
 * **IMPORTANT!** The post-exec methods are run _in parallel_ and _at the same time_ that
 * the {@link ExecutionPromise} returned by {@link ProcessStart} is resolved or rejected,
 * meaning there is no guaranteed order between your process callbacks and your actions'
 * post-exec methods.
 *
 * @module process
 */

import {
    get,
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
    constant,
 } from 'lodash';

import { rethrow, error } from '../errors/index';

import { Properties } from "../errors";

export interface ProcessRunner {

    /**
     * Invoked to stop the running {@link process}, immediately rejecting the promise. No further actions will be run.
     *
     * @param data Optional data to merge into the Error the promise will be rejected with.
     */
    cancel(data?: Properties): void

    /**
     * Invoked to stop the running {@link process}, immediately resolving the promise. No further actions will be run.
     */
    stop(): void

    /**
     * Invoked to update the set of conditions used within the running {@link process}.
     *
     * **NOTE:** This method updates the conditions used by the {@link ProcessLogic}
     * returned by {@link dependencies}.
     *
     * @param conditions The conditions to merge into the process' internal set of conditions.
     */
    update(conditions?: Record<string, any>): void

}

/**
 * Provides normal Promise functionality plus the ability to update,
 * cancel, or stop a running {@link process}.
 *
 * **NOTE:** The `update` method is primarily used to change conditions
 * for a running process.
 *
 * @example
 * ```js
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
 * ```
 */
export interface ExecutionPromise<T extends Record<string, any>> extends ProcessRunner, Promise<T> { }

/**
 * An array containing the following values:
 *
 * 0 (string): the step name that just completed
 * 1 (string): the step name to transition to
 * 2 (iteratee): optional predicate function to run to determine if the transition should occur
 *
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * ```js
 * // automatic transition when first action ends
 * const transition = ['from step', 'to step'];
 * ```
 * @example
 * ```js
 * // transition if the machine's current conditions match this set
 * const transition = ['from step', 'to step', { condition: 'value', another: 'condition' }];
 * ```
 * @example
 * ```js
 * // transition if the machine's current conditions has a truthy value for 'property'
 * const transition =  ['from step', 'to step', 'property'];
 * ```
 * @example
 * ```js
 * // transition if the machine's current conditions have a 'property' key with a 'value' value
 * const transition =  ['from step', 'to step', ['property', 'value']];
 * ```
 * @example
 * ```js
 * // transition if the function returns true
 * const transition =  ['from step', 'to step', function(conditions) {
 *   switch(conditions.key) {
 *     case 'value 1': return true;
 *     case 'value 2': return conditions.another > 12;
 *     default: return false;
 *   }
 * }]
 * ```
 * @example
 * ```js
 * // transition if the current condition values match the corresponding predicates
 * import { conforms, isNil, isNumber } from 'lodash';
 *
 * const transition = ['from step', 'to step', conforms({
 *   'error': isNil,
 *   'value': isNumber,
 *   'property': (value) => value > 0 && value < 100
 * })];
 * ```
 */
export type ProcessTransition = [string, string, any?];

/**
 * An array of {@link ProcessTransition} array instances.
 *
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * ```js
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
 * ```
 */
export type ProcessTransitions = ProcessTransition[];

/**
 * Contains information about the running {@link process}.
 * In addition to the members listed here, the object returned by {@link ProcessLogic}'s
 * {@link ProcessLogic.contextFromArgs contextFromArgs} will be mixed in.
 */
export interface ProcessContext extends ProcessRunner {

    /**
     * The arguments passed to {@link ProcessStart}.
     */
    args: any[]

    /**
     * Any values passed to {@link ProcessRunner.update update} or
     * provided as the 2nd argument to the {@link transitions} {@link ProcessContext}.
     */
    conditions: Record<string, any>

    /**
     * The values returned by each {@link execute} method, where each action name is a key.
     */
    results: Record<string, any>

    /**
     * The names of {@link Action actions} that have been started in the current process.
     */
    started: string[]

    /**
     * The names of {@link Action actions} that have run to completion in the current process.
     */
    completed: string[]

}

/**
 * Encapsulates the business logic for a single action within a multi-step asynchronous process.
 *
 * @see {@link action} factory method
 */
export interface Action extends Record<string, any> {

    /**
     * The name of the process action. Should be unique within a given process instance.
     *
     * @readonly
     */
    name: string

    /**
    * Runs once per process invocation. Can be used to initialize local variables or set up starting conditions.
    *
    * @this ProcessContext
    * @example
    * ```js
    * const multiply = process.action('multiply', {
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
    * ```
    */
    init(): void

    /**
     * Performs the bulk of the action's business logic. The value returned from
     * this method (or the resolved value of the Promise returned by this method)
     * will be assigned to the `results` map automatically.
     *
     * If you return a Promise, dependent actions will not be run until the Promise
     * has resolved. If the Promise rejects or if the execute method throws an
     * Error, the action's {@link retry} method will be run. If
     * that method throws or rejects, the entire process will be aborted.
     *
     * @this ProcessContext
     * @returns Value (or a Promise that resolves to a value) that will be stored
     * in the results collection passed to other actions through context, and
     * provided as the overall process Promise resolve value.
     * @example
     * ```js
     * import { someAsyncOperation } from '../data';
     *
     * const loadData = process.action('load', {
     *   async execute() {
     *     return await someAsyncOperation(...this.args);
     *   }
     * });
     * ```
     */
    execute(): Promise<any> | any

    /**
     * This method is invoked if the {@link execute} method throws
     * or returns a rejected Promise. If this method also throws or rejects (which is
     * the default behavior) then the entire process will be aborted.
     *
     * @param error The Error raised by the {@link execute} method
     *  or returned as the rejection reason of that method's Promise.
     * @this ProcessContext
     * @returns Rejected promise to abort the process (default behavior). Any other return
     * value will cause the action's {@link execute} method to re-run. If a Promise is returned,
     * execute will not run until and unless the promise resolves.
     * @example
     * ```js
     * import { someAsyncOperation } from '../data';
     *
     * const loadData = process.action('load', {
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
     * ```
     */
    retry(error?: Error): Promise<void> | any

    /**
     * This method is invoked if the action ran but the process was aborted.
     * You can use this opportunity to undo any behaviors performed in the
     * {@link execute} method.
     *
     * @this ProcessContext
     * @example
     * ```js
     * import { someAsyncOperation } from '../data';
     *
     * const loadData = process.action('load', {
     *   store: stores.localStore(),
     *   async execute() {
     *     const result = await someAsyncOperation(...this.args);
     *     await this.store.set('my data cache', result);
     *     return result;
     *   },
     *   async rollback() {
     *     await this.store.delete('my data cache');
     *   }
     * });
     * ```
     */
    rollback(): void

    /**
     * This method runs if _any_ action of the process fails (even if this
     * action was not previous executed). It provides a cross-cutting way
     * to respond to errors caused by other actions.
     *
     * @param error The Error that failed the process.
     * @this ProcessContext
     * @example
     * ```js
     * import { tracker } from '~/tracking';
     *
     * const logger = process.action('log process failure', {
     *   failure(err) {
     *     tracker.error(err);
     *   }
     * });
     * ```
     */
    failure(error: Error): void

    /**
     * This method runs if and when the entire process resolves. It provides a
     * cross-cutting way to respond to the overall success of a complex process.
     *
     * @this ProcessContext
     * @example
     * ```js
     * import { tracker } from '~/tracking';
     *
     * const logger = process.action('log process sucess', {
     *   success() {
     *     tracker.event(`${this.process} successful`, this.results);
     *   }
     * });
     * ```
     */
    success(): void

}

/**
 * An object used by {@link process} to determine which
 * {@link Action actions} should be executed and under what circumstances.
 *
 * @see {@link transitions transitions factory method}
 * @see {@link dependencies dependencies factory method}
 * @example
 * ```js
 * const actions = models.collection(
 *   process.action('a', () => console.log('running a')),
 *   process.action('b', () => console.log('running b')),
 *   process.action('c', () => console.log('running c')),
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
 * export const run = process.create('my process', actions, inParallel);
 * // USAGE: run('some value');
 * ```
 */
export interface ProcessLogic {

    /**
     * Returns an array of {@link Action actions} to run. This method is
     * called when {@link ProcessRunner.update update} is invoked (if no actions
     * are currently running) as well as whenever the previous set of actions
     * resolves. Return an empty array if the process should not do anything.
     *
     * @param actions The actions available for the process.
     * @param context Information about the running process.
     * @returns An array of actions to run.
     * @example
     * ```js
     * function getNextActions(actions, context) {
     *   // restrict parallel actions to a maximum of 5 at once:
     *   return actions
     *     .filter(action => !context.started.includes(action.name))
     *     .slice(0, 5);
     * }
     * ```
     */
    getNextActions?(actions: Action[], context: ProcessContext): Action[]

    /**
     * Returns an array of {@link Action actions} to run when the process
     * is started. Return an empty array if the process should not do anything.
     *
     * @param actions The actions available for the process.
     * @param context Information about the running process.
     * @returns An array of actions to run.
     * @example
     * ```js
     * // retrieve the action at the index passed
     * // to the start method returned by process(...)
     * // -- e.g. start(3) uses the 4th action
     * function getInitialActions(actions, context) {
     *   const index = context.args[0] || 0;
     *   const first = actions[index] || actions[0];
     *   return [ first ]; // always return an array
     * }
     * ```
     */
    getInitialActions?(actions: Action[], context: ProcessContext): Action[]

    /**
     * Generates the appropriate context object based on the arguments the user
     * has passed to the {@link ProcessStart} method.
     *
     * @param args The arguments the user passed to the {@link ProcessStart} method.
     * @returns An object that will be mixed into the running process's context
     * and passed to any {@link Action} methods as `this`.
     * @example
     * ```js
     * import { merge } from 'lodash';
     *
     * // use whatever arguments were passed to start() as the context;
     * // e.g. start({key: 'value'}, {another: 'value'}) would return a
     * // context that combines both those objects
     * function contextFromArgs(args) {
     *   return merge({}, ...args);
     * }
     * ```
     */
    contextFromArgs?(args: any[]): Record<string, any>

}

/**
 * The method you invoke to begin an asynchronous process.
 *
 * @param args The arguments to invoke the process with. Which
 * arguments you pass will depend on the {@link ProcessLogic} instance
 * you passed to {@link process}.
 * @returns A Promise that will be resolved or rejected
 * based on the process' running {@link Action actions}. In addition to
 * typical Promise methods, a few additional methods have been added to this
 * instance to interact with the running process.
 * @example
 * ```js
 * const actions = [
 *   process.action('a', () => console.log('a')),
 *   process.action('b', () => console.log('b')),
 *   process.action('c', () => console.log('c')),
 * ];
 *
 * const deps = process.dependencies({ 'b': ['a', 'c'] });
 * const trans = process.transitions([ ['a', 'c'], ['c', 'b']]);
 *
 * const dispatch = process.create('workflow', actions, deps);
 * const start = process.create('state machine', actions, trans);
 *
 * const workflowPromise = dispatch('arg 1', 'arg 2');
 * const machinePromise = start('a', { condition: 'value' });
 * ```
 */
export interface ProcessStart { (...args: any[]): ExecutionPromise<Record<string, any>> }

const resolved = Promise.resolve();
const abort = (err: Error) => Promise.reject(err);
const readonly = (getter: () => any): PropertyDescriptor => ({ get: getter, enumerable: true });
const immediate = (fn: (value: any) => any|PromiseLike<any>) => resolved.then(fn);

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
 * Creates a fully realized {@link Action} for use within a {@link process}.
 *
 * @param name The name of the process action.
 * @param api The execute method or partial {@link Action} to fill out.
 * @returns
 * @example
 * ```js
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
 * ```
 */
export function action(name: string, api?: Partial<Action>|Function): Action {
    const result = Object.create(null);
    Object.defineProperties(result, {
        name: readonly(() => name),
    });
    Object.assign(result, DEFAULTS);
    Object.assign(result, isFunction(api)
        ? { execute: api }
        : api);
    return result;
}

function findByName(name: string): Action {
    return find(this, { name });
}

function call(method: Function, context: any, ...args: any[]) {
    return new Promise((resolve) =>
        resolve(method.apply(context, args)));
}

function fork(item: Action) {
    const { method, context, args = [] } = this;
    call(get(item, method), context, ...args);
}

/**
 * Utility method to run a single {@link Action} in isolation.
 * This method is used internally by {@link process}
 * but is made available publicly for unusual situations.
 *
 * **NOTE:** The success and failure methods will not be run using this
 * method since their invocation depends on whether or not a collection
 * of Actions has completed successfully. If you want to invoke
 * the success and failure methods, you should do so manually. See the
 * example for details.
 *
 * @param item The Action whose methods should be invoked.
 * @param context The context accessed using `this` within an action method.
 * @param initialize Whether to run the Action's init method.
 * @example
 * ```js
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
 * ```
 */
export function run(item: Action, context: any, initialize = true): Promise<any> {
    const name = item.name;
    const init = initialize && call(item.init, context);
    const fail = rethrow({ action: name });
    const ctx = { ...context, ...omit(item, IGNORE_KEYS) };
    const recurse = () => run(item, ctx, false);
    const execute = () => call(item.execute, ctx);
    const retry = (err: Error) => call(item.retry, ctx, err).then(recurse);
    const update = (result: any) => context.results[name] = result;
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
 * @param name The name of the process to run.
 * @param actions An interable collection (e.g. Set, array, or {@link ModelCollection}) of {@link Action}s to run.
 * @param logic The logic that determines how to start and continue a process.
 * @returns A method you can invoke to begin the process. The arguments will
 * depend in part on the {@link ProcessLogic} object you passed.
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */
export function create(name: string, actions: Iterable<Action>, logic: ProcessLogic): ProcessStart {

    const threads = uniqBy(Array.from(actions), 'name');
    const {
        contextFromArgs = constant({}),
        getNextActions = constant([]),
        getInitialActions = constant([]),
    } = logic;

    function runActions(items: Action[], ctx: any): Promise<any[]> {
        return ctx.runtimeInfo.cancelled ?
            Promise.resolve([]) :
            Promise.all(items.map(runAction, ctx));
    }

    function runAction(item: Action): Promise<boolean> {
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

    return function start(...args: any[]): ExecutionPromise<Record<string, any>> {

        function callRollback(err: Error) {
            context.started
                .map(findByName, threads)
                .forEach(fork, { method: 'rollback', context, args: [err] });
            throw err;
        }

        function callFailure(err: Error) {
            threads.forEach(fork, { method: 'failure', context, args: [err] });
            throw err;
        }

        function callSuccess(result: any) {
            threads.forEach(fork, { method: 'success', context });
            return result;
        }

        let cancel: Function,
            update: Function,
            stop: Function;

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
        })) as unknown as ProcessContext;

        const runtimeInfo = { active: false, cancelled: false };

        const throwError = rethrow(Object.defineProperties({}, {
            process:    readonly(() => name),
            completed:  readonly(() => context.completed.slice()),
            running:    readonly(() => without(context.started, ...context.completed))
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
 * Creates a {@link ProcessLogic} instance that can be passed to the {@link process}
 * method. When started, the process will use the dependency map to determine which {@link Action actions}
 * can be invoked immediately (having no dependencies) and which should be run when their dependent actions
 * have completed.
 *
 * This method results in the process running like a _workflow_, with some actions run in parallel
 * and the execution order of actions dependent upon the stated dependencies.
 *
 * @param deps The dependency map that should be used
 * to determine the initial and follow-up {@link Action actions} to invoke in this
 * process.
 * @returns A ProcessLogic instance that {@link process}
 * can use to determine how to run the {@link ModelCollection} {@link Action actions} it was provided.
 * @example
 * ```js
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
 * ```
 * @example
 * ```js
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
 * ```
 */
export function dependencies(deps: Record<string, string[]> = {}): ProcessLogic {

    function readyToRun(step: Action) {
        const name = step.name;
        const required = deps[name] || [];
        const { completed, started } = this;
        const depsCompleted = required.every(Array.prototype.includes, completed);
        const notStarted = !started.includes(name);
        return notStarted && depsCompleted;
    }

    function getActions(actions: Action[], context: ProcessContext): Action[] {
        if (context.completed.length === actions.length) {
            context.stop();
            return [];
        }
        return actions.filter(readyToRun, context);
    }

    return {
        getNextActions: getActions,
        getInitialActions: getActions,
    };

}

/**
 * Creates a {@link ProcessLogic} instance that can be passed to the {@link process}
 * method. When started, the process will use the transition criteria to determine which {@link Action actions}
 * can be invoked based on the current set of {@link ProcessContext.conditions conditions} as passed to
 * the {@link ProcessStart start} method *or* through calls to {@link ProcessContext.update update}.
 *
 * **NOTE:** A process using transitions logic will not stop until and unless one of the following occurs:
 *  - someone invokes the `stop()` method
 *  - someone invokes the `cancel()` method
 *  - a {@link Action} method throws an Error or returns a rejected Promise
 *
 * This method results in the process running like a _state machine_, with one action allowed to run at any
 * time and the next action determined using the current conditions and the given transition logic.
 *
 * @param criteria The transitions that should be used
 * to determine the initial and follow-up {@link Action actions} to invoke in this
 * process.
 * @returns A ProcessLogic instance that {@link process}
 * can use to determine how to run the {@link ModelCollection} {@link Action actions} it was provided.
 * @example
 * ```js
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
 * ```
 */
export function transitions(criteria: ProcessTransition[] = []): ProcessLogic {

    function isNextState([from, _, condition]: ProcessTransition) {
        const current = last(this.completed);
        const predicate = iteratee(condition);
        return from === current && predicate(this.conditions);
    }

    function getNextActions(actions: Action[], context: ProcessContext): Action[] {
        const transition = criteria.find(isNextState, context);
        const next = transition && findByName.call(actions, transition[1]);
        return next ? [next] : [];
    }

    function getInitialActions(actions: Action[], context: ProcessContext): Action[] {
        const start = findByName.call(actions, (context as any).start) || actions[0];
        return start ? [start] : [];
    }

    function contextFromArgs(args: any): any {
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

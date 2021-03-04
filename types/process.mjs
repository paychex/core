/**
 * @class
 * @global
 * @extends Promise
 * @hideconstructor
 */
export class ProcessRunner extends Promise {

    /**
     * Invoked to stop the running {@link module:process.process process}, immediately rejecting the promise. No further actions will be run.
     *
     * @param {object} [data={}] Optional data to merge into the Error the promise will be rejected with.
     */
    cancel(data) { }

    /**
     * Invoked to stop the running {@link module:process.process process}, immediately resolving the promise. No further actions will be run.
     */
    stop() { }

    /**
     * Invoked to update the set of conditions used within the running {@link module:process.process process}.
     *
     * **NOTE:** This method updates the conditions used by the {@link ProcessLogic}
     * returned by {@link module:process.dependencies dependencies}.
     *
     * @param {Object.<string, any>} [conditions={}] The conditions to merge into the process' internal set of conditions.
     */
    update(conditions) { }

}

/**
 * Provides normal Promise functionality plus the ability to update,
 * cancel, or stop a running {@link module:process.process process}.
 *
 * **NOTE:** The `update` method is primarily used to change conditions
 * for a running process.
 *
 * @class
 * @global
 * @extends ProcessRunner
 * @hideconstructor
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
export class ExecutionPromise extends ProcessRunner {}

/**
 * @class
 * @global
 * @extends Array
 * @hideconstructor
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
 * import { conforms, isNil, isNumber } from 'lodash-es';
 *
 * const transition = ['from step', 'to step', conforms({
 *   'error': isNil,
 *   'value': isNumber,
 *   'property': (value) => value > 0 && value < 100
 * })];
 */
class ProcessTransition extends Array {

    /**
     * The step that just completed.
     *
     * @type {string}
     * @memberof ProcessTransition#
     */
    [0] = ''

    /**
     * The step that should be started next.
     *
     * @type {string}
     * @memberof ProcessTransition#
     */
    [1] = ''

    /**
     * Optional {@link https://lodash.com/docs/4.17.11#iteratee iteratee} to invoke
     * to determine if the transition should occur. The iteratee will be invoked
     * with the current {@link ExecutionContext#conditions process conditions}.
     *
     * @memberof ProcessTransition#
     */
    [2] = null

}

/**
 * An array of {@link ProcessTransition} array instances.
 *
 * @class
 * @global
 * @hideconstructor
 * @extends Array
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * import { conforms, isNil, isNumber } from 'lodash-es';
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
export class ProcessTransitions extends Array {}

/**
 * Contains information about the running {@link module:process.process process}.
 * In addition to the members listed here, the object returned by {@link ProcessLogic}'s
 * {@link ProcessLogic#contextFromArgs contextFromArgs} will be mixed in.
 *
 * @class
 * @global
 * @extends ProcessRunner
 * @hideconstructor
 */
export class ProcessContext extends ProcessRunner {

    /**
     * The arguments passed to {@link ProcessStart}.
     *
     * @type {Array.<*>}
     * @memberof ProcessContext#
     */
    args = []

    /**
     * Any values passed to {@link ExecutionUpdate update} or
     * provided as the 2nd argument to the {@link module:process.transitions transitions} {@link ProcessContext}.
     *
     * @type {Object.<string,any>}
     * @memberof ProcessContext#
     */
    conditions = {}

    /**
     * A key-value map of the values returned by each {@link Action#execute execute} method.
     *
     * @type {Object.<string,any>}
     * @memberof ProcessContext#
     */
    results = {}

    /**
     * The names of {@link Action actions} that have been started in the current process.
     *
     * @memberof ProcessContext#
     * @type {string[]}
     */
    started = []

    /**
     * The names of {@link Action actions} that have run to completion in the current process.
     *
     * @memberof ProcessContext#
     * @type {string[]}
     */
    completed = []

}

/**
 * Encapsulates the business logic for a single action within a multi-step asynchronous process.
 *
 * @global
 * @class
 * @hideconstructor
 * @see {@link module:process.action action} factory method
 */
export class Action {

    /**
     * The name of the process action. Should be unique within a given process instance.
     *
     * @member Action#name
     * @type {string}
     */
    name = ''

    /**
    * Runs once per process invocation. Can be used to initialize local variables or set up starting conditions.
    *
    * @method Action#init
    * @returns {*}
    * @this ProcessContext
    * @async
    * @example
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
    */
    init() { }

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
     * import { someAsyncOperation } from '../data';
     *
     * const loadData = process.action('load', {
     *   async execute() {
     *     return await someAsyncOperation(...this.args);
     *   }
     * });
     */
    execute() { }

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
     */
    retry() { }

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
     */
    rollback() { }

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
     *
     * const logger = process.action('log process failure', {
     *   failure(err) {
     *     tracker.error(err);
     *   }
     * });
     */
    failure() { }

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
     *
     * const logger = process.action('log process sucess', {
     *   success() {
     *     tracker.event(`${this.process} successful`, this.results);
     *   }
     * });
     */
    success() { }

}

/**
 * An object used by {@link module:process.process process} to determine which
 * {@link Action actions} should be executed and under what circumstances.
 *
 * @global
 * @class
 * @hideconstructor
 * @see {@link module:process.transitions transitions factory method}
 * @see {@link module:process.dependencies dependencies factory method}
 * @example
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
 */
export class ProcessLogic {

    /**
     * Returns an array of {@link Action actions} to run. This method is
     * called when {@link ExecutionUpdate update} is invoked (if no actions
     * are currently running) as well as whenever the previous set of actions
     * resolves. Return an empty array if the process should not do anything.
     *
     * @method ProcessLogic#getNextActions
     * @param {Array.<Action>} actions The actions available for the process.
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
    getNextActions(actions, context) { }

    /**
     * Returns an array of {@link Action actions} to run when the process
     * is started. Return an empty array if the process should not do anything.
     *
     * @method ProcessLogic#getInitialActions
     * @param {Array.<Action>} actions The actions available for the process.
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
    getInitialActions(actions, context) { }

    /**
     * Generates the appropriate context object based on the arguments the user
     * has passed to the {@link ProcessStart} method.
     *
     * @method ProcessLogic#contextFromArgs
     * @param {any[]} args The arguments the user passed to the {@link ProcessStart} method.
     * @returns {object} An object that will be mixed into the running process's context
     * and passed to any {@link Action} methods as `this`.
     * @example
     * import { merge } from 'lodash-es';
     *
     * // use whatever arguments were passed to start() as the context;
     * // e.g. start({key: 'value'}, {another: 'value'}) would return a
     * // context that combines both those objects
     * function contextFromArgs(args) {
     *   return merge({}, ...args);
     * }
     */
    getContextFromArgs(args) { }

}

/**
 * Method that takes no arguments and can return any type. If it returns a Promise,
 * the resolved value will be returned instead.
 *
 * @async
 * @callback AsyncVoidFunction
 * @returns {*} Any type, or a Promise that resolves to any type.
 */
function AsyncVoidFunction() { }

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
 */
async function ProcessStart(...args) {}
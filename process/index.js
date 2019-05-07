import noop from 'lodash/noop';
import find from 'lodash/find';
import last from 'lodash/last';
import omit from 'lodash/omit';
import keys from 'lodash/keys';
import without from 'lodash/without';
import constant from 'lodash/constant';
import iteratee from 'lodash/iteratee';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';

import { rethrow, error, ignore } from '../errors';
import { withUnique } from '../models';

/**
 * Provides utilities for running complex, multi-step asynchronous processes.
 *
 * @module process
 */

const abort = (err) => Promise.reject(err);
const readonly = (get) => ({ get, enumerable: true });

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
 * Encapsulates the business logic for a single step within a multi-step asynchronous process.
 *
 * @global
 * @interface ProcessStep
 * @see {@link module:process.step step} factory method
 */

/**
 * The name of the process step. Should be unique within a given process instance.
 *
 * @member ProcessStep#name
 * @type {string}
 */

/**
 * Runs once per process invocation. Can be used to initialize local variables or set up starting conditions.
 *
 * @method ProcessStep#init
 * @returns {*}
 * @async
 * @example
 * import { step } from '@paychex/core/process';
 *
 * const multiply = step('multiply', {
 *   factor: 2,
 *   init() {
 *     // NOTE: args are passed to the
 *     // workflow's dispatch function
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
 * Performs the bulk of the step's business logic. The value returned from
 * this method (or the resolved value of the Promise returned by this method)
 * will be assigned to the `results` map automatically.
 *
 * If you return a Promise, dependent steps will not be run until the Promise
 * has resolved. If the Promise rejects or if the execute method throws an
 * Error, the step's {@link ProcessStep#retry retry} method will be run. If
 * that method throws or rejects, the entire process will be aborted.
 *
 * @method ProcessStep#execute
 * @returns {*}
 * @async
 * @example
 * import { step } from '@paychex/core/process';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = step('load', {
 *   async execute() {
 *     return await someAsyncOperation(...this.args);
 *   }
 * });
 */

/**
 * This method is invoked if the {@link ProcessStep#execute execute} method throws
 * or returns a rejected Promise. If this method also throws or rejects (which is
 * the default behavior) then the entire process will be aborted.
 *
 * @method ProcessStep#retry
 * @param {Error} error The Error raised by the {@link ProcessStep#execute execute} method
 *  or returned as the rejection reason of that method's Promise.
 * @returns {*}
 * @async
 * @example
 * import { step } from '@paychex/core/process';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = step('load', {
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
 * This method is invoked if the step ran but the process was aborted.
 * You can use this opportunity to undo any behaviors performed in the
 * {@link ProcessStep#execute execute} method.
 *
 * @method ProcessStep#rollback
 * @returns {*}
 * @async
 * @example
 * import { step } from '@paychex/core/process';
 * import { localStore } from '@paychex/core/stores';
 * import { someAsyncOperation } from '../data';
 *
 * const loadData = step('load', {
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
 * This method runs if _any_ step of the process fails (even if this
 * step was not previous executed). It provides a cross-cutting way
 * to respond to errors caused by other steps.
 *
 * @method ProcessStep#failure
 * @param {Error} error The Error that failed the process.
 * @returns {*}
 * @async
 * @example
 * import { tracker } from '@paychex/landing';
 * import { step } from '@paychex/core/process';
 *
 * const logger = step('log process failure', {
 *   failure(err) {
 *     tracker.error(err);
 *   }
 * });
 */

/**
 * This method runs if and when the entire process resolves. It provides a
 * cross-cutting way to respond to the overall success of a complex process.
 *
 * @method ProcessStep#success
 * @returns {*}
 * @async
 * @example
 * import { tracker } from '@paychex/landing';
 * import { step } from '@paychex/core/process';
 *
 * const logger = step('log process sucess', {
 *   success() {
 *     tracker.event(`${this.process} successful`, this.results);
 *   }
 * });
 */

/**
 * Creates a fully realized {@link ProcessStep} for use within a {@link module:process.stateMachine stateMachine's}
 * or {@link module:process.workflow workflow's} internal {@link module:model.modelList modelList}.
 *
 * @function
 * @param {string} name The name of the process step.
 * @param {ProcessStep#execute|ProcessStep} api The execute method or partial {@link ProcessStep} to fill out.
 * @returns {ProcessStep}
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { step, stateMachine } from '@paychex/core/process';
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
 * const steps = modelList();
 * steps.add(step('load', loadData));
 * steps.add(step('process', processResults));
 *
 * // "load" should transition to "process" automatically:
 * const transitions = [ ['load', 'process'] ];
 *
 * export const start = stateMachine('get data', steps, transitions);
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { step, stateMachine } from '@paychex/core/process';
 *
 * export const start = stateMachine('double', modelList(
 *   step('double', {
 *     someVariable: 123,
 *     execute() {
 *       return this.someVariable * 2;
 *     },
 *     success() {
 *       console.log(this.results);
 *     }
 *   })
 * ));
 */
export function step(name, api) {
    const base = { name, ...DEFAULTS };
    return isFunction(api) ?
        { ...base, execute: api } :
        { ...base, ...api };
}

function findByName(name) {
    return find(this, { name });
}

function call(method, context, ...args) {
    return new Promise((resolve, reject) => {
        const result = method.apply(context, args);
        if (isFunction(result && result.then))
            return result.then(resolve, reject);
        resolve(result);
    });
}

function fork(step) {
    const { method, context, args = [] } = this;
    call(step[method], context, ...args);
}

function run(step, context, initialize = true) {
    const name = step.name;
    const init = initialize && call(step.init, context);
    const fail = rethrow({ step: name });
    const ctx = { ...context, ...omit(step, IGNORE_KEYS) };
    const recurse = () => run(step, ctx, false);
    const execute = () => call(step.execute, ctx);
    const retry = error => call(step.retry, ctx, error).then(recurse);
    const update = result => context.results[name] = result;
    return Promise.resolve(init)
        .then(execute)
        .catch(retry)
        .catch(fail)
        .then(update);
}

function readyToRun(step) {
    const { dependencies, context: { completed, started } } = this;
    const name = step.name;
    const deps = dependencies[name] || [];
    const doneDeps = deps.every(Array.prototype.includes, completed);
    const notStarted = !started.includes(name);
    return notStarted && (doneDeps || isEmpty(deps));
}

function runStep(step) {
    const name = step.name;
    const { steps, context, dependencies, runtimeInfo } = this;
    context.started.push(name);
    return run(step, context)
        .then(() => context.completed.push(name))
        .then(() => runNextSteps(steps, context, dependencies, runtimeInfo));
}

function runNextSteps(steps, context, dependencies, runtimeInfo) {
    const ctx = { steps, context, dependencies, runtimeInfo };
    const next = steps.filter(readyToRun, ctx);
    if (!runtimeInfo.cancelled && !isEmpty(next))
        return Promise.all(next.map(runStep, ctx));
}

function runState(state) {
    const name = state.name;
    const { states, context, transitions, runtimeInfo } = this;
    context.started.push(name);
    runtimeInfo.active = true;
    return run(state, context)
        .then(() => context.completed.push(name))
        .then(() => runNextState(states, context, transitions, runtimeInfo))
        .then(() => runtimeInfo.active = false);
}

function isNextState([from, _, condition]) {
    const current = last(this.completed);
    const predicate = iteratee(condition);
    return from === current && predicate(this.conditions);
}

function runNextState(states, context, transitions, runtimeInfo) {
    const transition = transitions.find(isNextState, context);
    if (!runtimeInfo.cancelled && transition) {
        const next = findByName.call(states, transition[1]);
        return next && runState.call({ states, context, transitions, runtimeInfo }, next);
    }
}

function execute(name, steps, getInitialPromise, getNextPromise, contextProps) {

    function callRollback(err) {
        context.started
            .map(findByName, states)
            .forEach(fork, { method: 'rollback', context, args: [err] });
        throw err;
    }

    function callFailure(err) {
        states.forEach(fork, { method: 'failure', context, args: [err] });
        throw err;
    }

    function callSuccess(result) {
        states.forEach(fork, { method: 'success', context });
        return result;
    }

    let cancel, update, stop;

    const context = Object.freeze(Object.defineProperties({
        args: [],
        conditions: {},
        results: {},
        started: [],
        completed: [],
        ...contextProps
    }, {
        stop:   readonly(() => stop),
        cancel: readonly(() => cancel),
        update: readonly(() => update),
    }));

    const states = withUnique(steps, 'name').items();
    const runtimeInfo = { active: false, cancelled: false };

    const throwError = rethrow(Object.defineProperties({}, {
        process:    readonly(() => name),
        completed:  readonly(() => context.completed.slice()),
        running:    readonly(() => without(context.started, context.completed))
    }));

    const promise = new Promise(function ProcessPromise(resolve, reject) {

        update = function update(conditions = {}) {
            Object.assign(context.conditions, conditions);
            if (!runtimeInfo.active)
                getNextPromise(states, context, runtimeInfo, resolve, reject);
        };

        cancel = function cancel(data = {}) {
            runtimeInfo.cancelled = true;
            reject(error('Process cancelled.', ignore(data)));
        };

        stop = function stop() {
            runtimeInfo.cancelled = true;
            resolve(context.results);
        };

        if (isEmpty(states))
            return resolve(context.results);

        getInitialPromise(states, context, runtimeInfo, resolve, reject);

    })
        .catch(callRollback)
        .catch(callFailure)
        .catch(throwError)
        .then(callSuccess);

    return Object.assign(promise, { cancel, update, stop } = context);

}

/**
 * A map of workflow {@link ProcessStep step} names to their dependencies.
 *
 * @global
 * @typedef {Object} WorkflowDependencies
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { step, workflow } from '@paychex/core/process';
 *
 * const dependencies = {
 *   'step b': ['step a'], // step b runs after step a
 *   'step c': ['step b', 'step d'] // step c runs after steps b and d
 * };
 *
 * const steps = modelList(
 *   step('step a', () => console.log('step a run')),
 *   step('step b', () => console.log('step b run')),
 *   step('step c', () => console.log('step c run')),
 *   step('step d', () => console.log('step d run')),
 * );
 *
 * export const dispatch = workflow('my process', steps, dependencies);
 */

/**
 * Invoked to update the set of conditions used within the running process.
 *
 * **NOTE:** This method is primarily intended for a running {@link module:process.stateMachine stateMachine}
 * and is ignored by {@link module:process.workflow workflow}s.
 *
 * @global
 * @callback ExecutionUpdate
 * @param {object} [conditions={}] The conditions to merge into the process' internal set of conditions.
 */

/**
 * Invoked to stop the running process, immediately rejecting the promise. No further steps will be run.
 *
 * @global
 * @callback ExecutionCancel
 * @param {object} [data={}] Optional data to merge into the Error the promise will be rejected with.
 */

/**
 * Invoked to stop the running process, immediately resolving the promise. No further steps will be run.
 *
 * @global
 * @callback ExecutionStop
 */

/**
 * Provides normal Promise functionality plus the ability to update,
 * cancel, or stop a running process.
 *
 * **NOTE:** The `update` method is primarily used to change conditions
 * for a running {@link module:process.stateMachine stateMachine} and
 * is ignored by {@link module:process.workflow workflow}s.
 *
 * @global
 * @typedef {Promise} ExecutionPromise
 * @property {ExecutionUpdate} update Updates the set of conditions used within a running process.
 * @property {ExecutionCancel} cancel Cancels the running promise, rejecting the promise.
 * @property {ExecutionStop} update Stops the running promise, resolving the promise.
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
 * Method returned by the {@link module:process.workflow workflow} factory method;
 * used to invoke the workflow. Any arguments passed to dispatch will be made available
 * to each {@link ProcessStep}'s methods through their invocation context (`this.args`).
 *
 * @global
 * @callback WorkflowDispatch
 * @param {...any[]} args Optional arguments; will be accessible from within
 * each {@link ProcessStep} method's invocation context (`this.args`).
 * @returns {ExecutionPromise} A Promise that will be resolved with a map of results
 * or else rejected with the first {@link ProcessStep#execute execute} method
 * that fails. This Promise has special methods to control workflow execution.
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { step, workflow } from '@paychex/core/process';
 *
 * const steps = modelList(step('start', {
 *   execute() {
 *     console.log('args:', this.args);
 *   }
 * }));
 *
 * export const dispatch = workflow('my workflow', steps);
 *
 * // dispatch(123, 'abc'); // args: [123, "abc"]
 */

/**
 * Creates a new {@link WorkflowDispatch} method for the given steps. The workflow steps
 * will be run in the correct order as determined from the {@link WorkflowDependencies}
 * provided (or else run immediately and in parallel if no inter-dependencies are specified).
 *
 * @function
 * @param {string} name The name of the workflow. Used in Errors to assist with debugging.
 * @param {ModelList} stepList A ModelList containing the {@link ProcessStep}s to run.
 * @param {WorkflowDependencies} [dependencies={}] An optional map of dependencies
 * between workflow steps.
 * @returns {WorkflowDispatch} A method to dispatch the workflow.
 * @example
 * import { rethrow } from '@paychex/core/errors';
 * import { modelList } from '@paychex/core/models';
 * import { step, workflow } from '@paychex/core/process';
 *
 * import { loadUserInfo } from '../data/user';
 * import { loadClientData } from '../data/clients';
 *
 * import { start } from '../path/to/machine';
 *
 * const steps = modelList();
 *
 * steps.add(step('loadUserInfo', loadUserInfo));
 *
 * steps.add(step('loadClientData', {
 *   async execute() {
 *     const clientId = this.args[0];
 *     return await loadClientData(clientId)
 *       .catch(rethrow({ clientId }));
 *   }
 * }));
 *
 * steps.add(step('merge', {
 *   execute() {
 *     const user = this.results.loadUserInfo;
 *     const clients = this.results.loadClientData;
 *     return Object.assign({}, user, { clients });
 *   }
 * }));
 *
 * steps.add(step('eula', function execute() {
 *   const conditions = this.results;
 *   return start('initial', conditions);
 * }));
 *
 * export const dispatch = workflow('load user clients', steps, {
 *   'eula': ['merge'],
 *   'merge': ['loadUserInfo', 'loadClientData'],
 * });
 *
 * // USAGE: dispatch(clientId);
 * @example
 * // workflow used within a saga
 * import { call, takeEvery } from 'redux-saga/effects';
 *
 * import { addSaga } from '@paychex/landing';
 * import { modelList } from '@paychex/core/models';
 * import { step, workflow } from '@paychex/core/process';
 *
 * const steps = modelList(
 *   step('a', () => console.log('a')),
 *   step('b', () => console.log('b')),
 *   step('c', () => console.log('c')),
 * );
 *
 * const dispatch = workflow('saga handler', steps, {
 *   b: ['a'],
 *   c: ['b', 'a']
 * });
 *
 * addSaga(function* saga() {
 *   yield takeEvery('some-action', function* run(action) {
 *     yield call(dispatch, action.payload);
 *   });
 * });
 */
export function workflow(name, stepList, dependencies = {}) {
    return function dispatch(...args) {

        function getInitialPromise(steps, context, runtimeInfo, resolve, reject) {
            Promise.resolve(runNextSteps(steps, context, dependencies, runtimeInfo))
                .then(constant(context.results))
                .then(resolve, reject);
        }

        return execute(name, stepList, getInitialPromise, noop, { args });

    };
}

/**
 * Method returned by the {@link module:process.stateMachine stateMachine} factory method; used
 * to start the state machine at a specific step and with optional initial conditions. The conditions
 * can be accessed by each {@link ProcessStep} method's invocation context (`this.conditions`).
 *
 * @global
 * @callback MachineStart
 * @param {string} [start] The initial step to run. If not provided, the first step in the machine's
 * list of {@link ProcessStep}s will be used as the start step.
 * @param {object} [conditions={}] The optional initial conditions of the machine. Conditions
 * are run against the {@link MachineTransitions} specified during machine creation to determine
 * which state to transition to each time the current state ends.
 * @returns {ExecutionPromise} A Promise that will be resolved with a map of results
 * or else rejected with the first {@link ProcessStep#execute execute} method
 * that fails. This Promise has special methods to control workflow execution.
 * @example
 * import { modelList } from '@paychex/core/models';
 * import { step, stateMachine } from '@paychex/core/process';
 *
 * const states = modelList();
 *
 * states.add(step('start', () => console.log('start')));
 * states.add(step('next',  () => console.log('next')));
 * states.add(step('stop',  () => console.log('stop')));
 *
 * const transitions = [
 *   ['start', 'next'],
 *   ['next', 'stop']
 * ];
 *
 * export const start = stateMachine('my machine', states, transitions);
 *
 * // USAGE:
 * start();
 * start('initial state');
 * start('initial state', { initial: 'conditions' });
 */

/**
 * @global
 * @typedef {Array} MachineTransition
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * // automatic transition when first step ends
 * const transition = ['from step', 'to step'];
 * @example
 * // transition if the machine's current conditions match this set
 * const transition = ['from step', 'to step', { condition: 'value', another: 'condition' }];
 * @example
 * // transition if the machine's current conditions has a truthy value for 'property'
 * const transition =  ['from step', 'to step', 'property'];
 * @example
 * // transition if the machine's current conditions have a 'property' key with a 'value' value
 * const transition =  ['from step', 'to step', ['property', 'value'];
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
 * const transition =  ['from step', 'to step', conforms({
 *   'error': isNil,
 *   'value': isNumber,
 *   'property': (value) => value > 0 and value < 100
 * })];
 */

/**
 * An array of transition criteria.
 *
 * @global
 * @typedef {MachineTransition[]} MachineTransitions
 * @see lodash {@link https://lodash.com/docs/4.17.11#iteratee iteratee} options
 * @example
 * import { conforms, isNil, isNumber } from 'lodash';
 *
 * const transitions = [
 *
 *   // automatic transition when first step ends
 *   ['from step', 'to step'],
 *
 *   // transition if the machine's current conditions match this set
 *   ['from step', 'to step', { condition: 'value', another: 'condition' }],
 *
 *   // transition if the machine's current conditions has a truthy value for 'property'
 *   ['from step', 'to step', 'property'],
 *
 *   // transition if the machine's current conditions have a 'property' key with a 'value' value
 *   ['from step', 'to step', ['property', 'value'],
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
 *     'property': (value) => value > 0 and value < 100
 *   })]
 *
 * ];
 */

/**
 * Creates a new {@link MachineStart} method for the given steps. The machine steps will be
 * invoked one at a time, starting with the provided start step. When each step ends, the next
 * step to invoke will be chosen based on the current set of machine conditions as matched against
 * the provided {@link MachineTransitions transition criteria}.
 *
 * **NOTE:** A machine will not stop until and unless one of the following occurs:
 *  - someone invokes the `stop()` method
 *  - someone invokes the `cancel()` method
 *  - a {@link ProcessStep} method throws an Error or returns a rejected Promise
 *
 * @function
 * @param {string} name The name of the state machine. Used in Errors to assist with debugging.
 * @param {ModelList} stateList A ModelList instance containing the machine {@link ProcessStep steps}.
 * @param {MachineTransitions} [transitions=[]] Optional transitions between states.
 * @returns {MachineStart} A method to start the state machine.
 * @example
 * import { tracker } from '@paychex/landing';
 * import { modelList } from '@paychex/core/models';
 * import { step, stateMachine } from '@paychex/core/process';
 * import { rethrow, fatal, ignore } from '@paychex/core/errors';
 *
 * import { showDialog } from '../some/dialog';
 * import { dispatch } from '../some/workflow';
 *
 * const states = modelList();
 *
 * // if no start state is explicitly passed to the start()
 * // method then this first step will be used automatically
 * states.add(step('start', {
 *   success() {
 *     tracker.event(`${this.process} succeeded`);
 *   },
 *   failure(err) {
 *     Object.assign(err, fatal());
 *     tracker.error(err);
 *   }
 * }));
 *
 * states.add(step('show dialog', {
 *   execute() {
 *     return showDialog('accept.cookies');
 *   }
 * }));
 *
 * // we can dispatch a workflow in one of our steps
 * states.add(step('run workflow', function execute() {
 *   const cookiesEnabled = this.results['show dialog'];
 *   const ignoreError = rethrow(ignore({ cookiesEnabled }));
 *   return dispatch(cookiesEnabled).catch(ignoreError);
 * }));
 *
 * states.add(step('stop', function() {
 *   this.stop(); // stop the machine
 * }));
 *
 * const transitions = [
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
 * export const start = stateMachine('intro', states, transitions);
 * @example
 * // state machine used within a saga
 * import { call, takeEvery } from 'redux-saga/effects';
 *
 * import { addSaga } from '@paychex/landing';
 * import { modelList } from '@paychex/core/models';
 * import { step, machine } from '@paychex/core/process';
 *
 * const steps = modelList(
 *   step('a', () => console.log('a')),
 *   step('b', () => console.log('b')),
 *   step('c', function() { this.stop(); }),
 * );
 *
 * const start = machine('saga handler', steps, [
 *   ['a', 'b'],
 *   ['b', 'c']
 * ]);
 *
 * addSaga(function* saga() {
 *   yield takeEvery('some-action', function* run(action) {
 *     const conditions = action.payload;
 *     yield call(start, 'initial state', conditions);
 *   });
 * });
 */
export function stateMachine(name, stateList, transitions = []) {
    return function start(state, conditions = {}) {

        function getInitialPromise(states, context, runtimeInfo, _, reject) {
            const start = findByName.call(states, state) || states[0];
            return runState.call({ states, context, transitions, runtimeInfo }, start)
                .catch(reject);
        }

        function getNextPromise(states, context, runtimeInfo, _, reject) {
            return Promise.resolve(runNextState(states, context, transitions, runtimeInfo))
                .catch(reject);
        }

        return execute(name, stateList, getInitialPromise, getNextPromise, { conditions });

    };
}

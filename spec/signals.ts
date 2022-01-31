import * as expect from 'expect';
import { spy } from './index';
import {
    autoReset,
    manualReset,
    countdown,
    semaphore,
} from '../signals/index';
import { AutoResetSignal, CountdownSignal, ManualResetSignal, Semaphore } from '../signals';

describe('signals', () => {

    describe('manualReset', () => {

        let signal: ManualResetSignal;
        beforeEach(() => signal = manualReset());

        it('has expected methods', () => {
            ['ready', 'reset', 'set'].forEach((method: keyof ManualResetSignal) =>
                expect(signal[method]).toBeInstanceOf(Function));
        });

        describe('ready', () => {

            it('resolves if signaled', async () => {
                signal = manualReset(true);
                const nextFrame = spy();
                setTimeout(nextFrame);
                await signal.ready(); // end of current frame
                expect(nextFrame.called).toBe(false);
            });

            it('waits until signaled', async () => {
                const nextFrame = spy().invokes(signal.set);
                setTimeout(nextFrame);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('reset', () => {

            it('blocks queue', async () => {
                signal = manualReset(true);
                signal.reset();
                const nextFrame = spy().invokes(signal.set);
                setTimeout(nextFrame);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('signal', () => {

            it('resolves queue in order', async () => {
                const calls: number[] = [];
                signal.ready().then(() => calls.push(1));
                signal.ready().then(() => calls.push(2));
                signal.ready().then(() => calls.push(3));
                await signal.set();
                expect(calls).toEqual([1, 2, 3]);
            });

        });

    });

    describe('autoReset', () => {

        let signal: AutoResetSignal;
        beforeEach(() => signal = autoReset());

        it('has expected methods', () => {
            ['ready', 'reset', 'set'].forEach((method: keyof AutoResetSignal) =>
                expect(signal[method]).toBeInstanceOf(Function));
        });

        describe('ready', () => {

            it('resolves if signaled', async () => {
                signal = autoReset(true);
                const nextFrame = spy();
                setTimeout(nextFrame);
                await signal.ready(); // end of current frame
                expect(nextFrame.called).toBe(false);
            });

            it('waits until signaled', async () => {
                const nextFrame = spy().invokes(signal.set);
                setTimeout(nextFrame);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('reset', () => {

            it('blocks queue', async () => {
                signal = autoReset(true);
                signal.reset();
                const nextFrame = spy().invokes(signal.set);
                setTimeout(nextFrame);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('signal', () => {

            it('resolves one queued item in order', async () => {
                const calls: number[] = [];
                signal.ready().then(() => calls.push(1));
                signal.ready().then(() => calls.push(2));
                signal.ready().then(() => calls.push(3));
                await signal.set();
                expect(calls).toEqual([1]);
                await signal.set();
                expect(calls).toEqual([1, 2]);
                await signal.set();
                expect(calls).toEqual([1, 2, 3]);
            });

            it('does nothing if nothing queued', async () => {
                const calls: number[] = [];
                await signal.set();
                expect(calls).toEqual([]);
                signal.ready().then(() => calls.push(1));
                signal.ready().then(() => calls.push(2));
                await signal.set();
                await signal.set();
                expect(calls).toEqual([1, 2]);
                await signal.set();
                await signal.set();
                await signal.set();
                expect(calls).toEqual([1, 2]);
            });

        });

    });

    describe('countdown', () => {

        let signal: CountdownSignal;
        beforeEach(() => signal = countdown());

        it('has expected methods', () => {
            ['ready', 'increment', 'decrement'].forEach((method: keyof CountdownSignal) =>
                expect(signal[method]).toBeInstanceOf(Function));
        });

        it('starts signaled', async () => {
            const nextFrame = spy();
            setTimeout(nextFrame);
            await signal.ready();
            expect(nextFrame.called).toBe(false);
        });

        describe('ready', () => {

            it('resolves if counter = 0', async () => {
                const nextFrame = spy();
                setTimeout(nextFrame);
                signal.increment();
                signal.decrement();
                await signal.ready();
                expect(nextFrame.called).toBe(false);
            });

            it('waits if not signaled', async () => {
                signal = countdown(1);
                const nextFrame = spy().invokes(signal.decrement);
                setTimeout(nextFrame);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('increment', () => {

            it('blocks queue', async () => {
                const nextFrame = spy().invokes(signal.decrement);
                setTimeout(nextFrame);
                signal.increment();
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

            it('adds specified amount', async () => {
                const nextFrame = spy().invokes(signal.decrement);
                setTimeout(nextFrame);
                signal.increment(2);
                signal.decrement();
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

            it('clamps to 1', async () => {
                const nextFrame = spy().invokes(signal.decrement);
                setTimeout(nextFrame);
                signal.increment(-2);
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

        });

        describe('decrement', () => {

            it('subtracts specified amount', async () => {
                signal.increment(2);
                signal.decrement(2);
                const waiter: any = spy();
                await signal.ready().then(waiter);
                expect(waiter.called).toBe(true);
            });

            it('continues blocking if counter > 0', async () => {
                const nextFrame = spy().invokes(signal.decrement);
                setTimeout(nextFrame);
                signal.increment(2);
                signal.decrement();
                await signal.ready();
                expect(nextFrame.called).toBe(true);
            });

            it('resolves queue in order if counter = 0', async () => {
                const calls: number[] = [];
                signal.increment(2);
                signal.ready().then(() => calls.push(1));
                signal.ready().then(() => calls.push(2));
                signal.ready().then(() => calls.push(3));
                signal.decrement(2);
                await signal.ready();
                expect(calls).toEqual([1, 2, 3]);
            });

            it('clamps value to 1', async () => {
                const nextFrame = spy();
                setTimeout(nextFrame);
                signal.increment();
                signal.decrement(-2);
                await signal.ready();
                expect(nextFrame.called).toBe(false);
            });

            it('clamps counter to 0', async () => {
                const nextFrame = spy();
                setTimeout(nextFrame);
                signal.increment();
                signal.decrement(5);
                await signal.ready();
                expect(nextFrame.called).toBe(false);
            });

        });

    });

    describe('semaphore', () => {

        const nextTick = () => new Promise(resolve => setTimeout(resolve));

        let signal: Semaphore;
        beforeEach(() => signal = semaphore(2));

        it('has expected methods', () => {
            ['ready', 'release'].forEach((method: keyof Semaphore) =>
                expect(signal[method]).toBeInstanceOf(Function));
        });

        it('has expected properties', () => {
            ['available', 'queued', 'running'].forEach((prop: keyof Semaphore) =>
                expect(typeof signal[prop]).toBe('number'));
        });

        it('queues above limit', async () => {
            const handler: any = spy();
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            expect(signal.queued).toBe(2);
            expect(signal.running).toBe(2);
            expect(signal.available).toBe(0);
            await nextTick();
            expect(handler.callCount).toBe(2);
        });

        it('uses default limit if none provided', () => {
            signal = semaphore();
            expect(signal.queued).toBe(0);
            expect(signal.running).toBe(0);
            expect(signal.available).toBe(5);
        });

        it('runs queued tasks on release', async () => {
            const handler: any = spy().invokes(signal.release);
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            await nextTick();
            expect(handler.callCount).toBe(4);
        });

        it('runs subset of queued tasks on partial release', async () => {
            const handler: any = spy();
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            signal.ready().then(handler);
            expect(signal.queued).toBe(2);
            expect(signal.running).toBe(2);
            expect(signal.available).toBe(0);
            await nextTick();
            signal.release(1);
            expect(signal.queued).toBe(1);
            expect(signal.running).toBe(2);
            expect(signal.available).toBe(0);
            signal.ready().then(handler);
            expect(signal.queued).toBe(2);
            await nextTick();
            expect(handler.callCount).toBe(3);
            signal.release();
            signal.release();
            expect(signal.queued).toBe(0);
            expect(signal.running).toBe(2);
            expect(signal.available).toBe(0);
            await nextTick();
            expect(handler.callCount).toBe(5);
            signal.release(50);
            expect(signal.queued).toBe(0);
            expect(signal.running).toBe(0);
            expect(signal.available).toBe(2);
        });

    });

});
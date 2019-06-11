import expect from 'expect';
import { spy } from './utils';
import {
    autoReset,
    countdown,
    manualReset,
} from '../signals';

describe('signals', () => {

    describe('manualReset', () => {

        let signal;
        beforeEach(() => signal = manualReset());

        it('has expected methods', () => {
            ['ready', 'reset', 'set'].forEach(method =>
                expect(typeof signal[method]).toBe('function'));
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
                const calls = [];
                signal.ready().then(() => calls.push(1));
                signal.ready().then(() => calls.push(2));
                signal.ready().then(() => calls.push(3));
                await signal.set();
                expect(calls).toEqual([1, 2, 3]);
            });

        });

    });

    describe('autoReset', () => {

        let signal;
        beforeEach(() => signal = autoReset());

        it('has expected methods', () => {
            ['ready', 'reset', 'set'].forEach(method =>
                expect(typeof signal[method]).toBe('function'));
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
                const calls = [];
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
                const calls = [];
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

        let signal;
        beforeEach(() => signal = countdown());

        it('has expected methods', () => {
            ['ready', 'increment', 'decrement'].forEach(method =>
                expect(typeof signal[method]).toBe('function'));
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
                const waiter = spy();
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
                const calls = [];
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

});
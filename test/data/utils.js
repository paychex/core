import expect from 'expect';
import { spy } from '../utils';

import {
    withFalloff,
    ifResponseStatus,
    ifRequestMethod
} from '../../data/utils'

describe('data/utils', () => {

    describe('withFalloff', () => {

        it('resolves after period when below failure count', async () => {
            const request = {};
            const delays = [200, 400, 800, 1600, 3200];
            const timeout = (fn, delay) => {
                expect(delay).toBe(delays.shift());
                fn();
            }
            const retry = withFalloff(5, 200, timeout);
            await retry(request);
            await retry(request);
            await retry(request);
            await retry(request);
            await retry(request);
        });

        it('rejects after period when reaches failure count', async () => {
            const request = {};
            const timeout = fn => fn();
            const retry = withFalloff(2, 200, timeout);
            await retry(request);
            await retry(request);
            try {
                await retry(request);
            } catch (e) {
                expect(e).toBeUndefined();
            }
        });

        it('counts different requests separately', async () => {
            const request1 = {};
            const request2 = {};
            const timeout = fn => fn();
            const retry = withFalloff(2, 200, timeout);
            await retry(request1);
            await retry(request2);
            await retry(request1);
            await retry(request2);
        });

        it('uses default arguments when necessary', async () => {
            const original = setTimeout;
            const timeout = global.setTimeout = spy();
            const retry = withFalloff();
            retry({});
            expect(timeout.called).toBe(true);
            expect(timeout.args[1]).toBe(200);
            timeout.args[0]();
            global.setTimeout = original.bind(global);
        });

    });

    describe('ifRequestMethod', () => {

        it('invokes getter if method matches', async () => {
            let called = false;
            const getter = () => called = true;
            const wrapper = ifRequestMethod('FAKE', getter);
            wrapper({ method: 'FAKE' });
            expect(called).toBe(true);
        });

        it('does not invoke getter if method mismatched', async () => {
            let called = false;
            const getter = () => called = true;
            const wrapper = ifRequestMethod('FAKE', getter);
            wrapper({ method: 'POST' });
            expect(called).toBe(false);
        });

    });

    describe('ifResponseStatus', () => {

        it('invokes setter if status matches', async () => {
            let called = false;
            const setter = () => called = true;
            const wrapper = ifResponseStatus(200, setter);
            wrapper({}, { status: 200 });
            expect(called).toBe(true);
        });

        it('does not invoke setter if status mismatched', async () => {
            let called = false;
            const setter = () => called = true;
            const wrapper = ifResponseStatus(200, setter);
            wrapper({}, { status: 404 });
            expect(called).toBe(false);
        });

    });

});

import expect from 'expect';
import { createRouter } from '../router';
import { spy } from './utils';

describe('router', () => {

    let globals, options;

    beforeEach(() => {
        options = { dispatch: spy() };
        globals = {
            addEventListener: spy(),
            history: {
                replaceState: spy()
            },
            document: {
                title: '',
                location: {
                    hash: '',
                    search: '',
                    pathname: ''
                }
            }
        };
    });

    describe('createRouter', () => {

        it('throws if dispatch method not provided', () => {
            expect(() => createRouter({}, globals))
                .toThrow('createRouter options must include a `dispatch` method.');
        });

        it('uses default prefix', () => {
            globals.document.location.hash = '#!container://route/path?arr=1&arr=2';
            createRouter(options, globals);
            expect(options.dispatch.callCount).toBe(1);
            expect(options.dispatch.args[0]).toMatchObject({
                type: 'navigate',
                data: {
                    container: 'container',
                    path: 'route/path',
                    params: {
                        arr: ['1', '2']
                    }
                }
            });
        });

        it('uses default separator', () => {
            globals.document.location.hash = '#!a://route||b://route';
            createRouter(options, globals);
            expect(options.dispatch.callCount).toBe(2);
            expect(options.dispatch.args[0]).toMatchObject({
                type: 'navigate',
                data: {
                    container: 'b',
                    path: 'route',
                    params: {}
                }
            });
        });

        it('uses provided prefix and separator', () => {
            globals.document.location.hash = '##a://route-a?key=a**b://route-b?key=b';
            options = { prefix: '##', separator: '**', dispatch: spy() };
            createRouter(options, globals);
            expect(options.dispatch.callCount).toBe(2);
            expect(options.dispatch.args[0]).toMatchObject({
                type: 'navigate',
                data: {
                    container: 'b',
                    path: 'route-b',
                    params: {
                        key: 'b'
                    }
                }
            });
        });

        describe('router', () => {

            let router;

            beforeEach(() => {
                router = createRouter(options, globals);
            });

            describe('navigate', () => {

                it('exists', () => {
                    expect(typeof router.navigate).toBe('function');
                });

                it('updates document hash asynchronously', async () => {
                    router.navigate('container', 'route/path', { arr: ['1', '2'] });
                    await Promise.resolve();
                    expect(globals.document.location.hash).toBe('#!container://route/path?arr=1&arr=2');
                });

                it('debounces document hash updates', async () => {
                    router.navigate('a', 'route/a', { arr: ['1', '2'] });
                    router.navigate('b', 'route/b');
                    await Promise.resolve();
                    expect(globals.document.location.hash).toBe('#!a://route/a?arr=1&arr=2||b://route/b');
                });

            });

            describe('hashchange', () => {

                let handler;

                beforeEach(() => {
                    handler = globals.addEventListener.args[1];
                });

                it('dispatches action if same path but different params', () => {
                    globals.document.location.hash = '#!id://path?key=abc';
                    handler();
                    options.dispatch.reset();
                    globals.document.location.hash = '#!id://path?key=def';
                    handler();
                    expect(options.dispatch.called).toBe(true);
                });

                it('dispatches action if different path but same params', () => {
                    globals.document.location.hash = '#!id://path/a?key=abc';
                    handler();
                    options.dispatch.reset();
                    globals.document.location.hash = '#!id://path/b?key=abc';
                    handler();
                    expect(options.dispatch.called).toBe(true);
                });

                it('dispatches action when path removed', () => {
                    globals.document.location.hash = '#!id://path/a?key=abc';
                    handler();
                    options.dispatch.reset();
                    globals.document.location.hash = '#!';
                    handler();
                    expect(options.dispatch.called).toBe(true);
                });

                it('does not dispatch if same path and params', () => {
                    globals.document.location.hash = '#!id://path/a?key=abc';
                    handler();
                    options.dispatch.reset();
                    globals.document.location.hash = '#!id://path/a?key=abc';
                    handler();
                    expect(options.dispatch.called).toBe(false);
                });

                it('does not dispatch if hash is invalid');

            });

        });

    });

});
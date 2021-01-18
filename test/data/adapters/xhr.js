import expect from 'expect';
import set from 'lodash/set.js';

import { spy } from '../../utils.js';
import { xhr as adapter } from '../../../data/adapters/xhr.js';

describe('xhr adapter', () => {

    let xhr, http, request, headers;

    beforeEach(() => {
        request = { method: 'GET', url: 'test.com', body: null };
        headers = 'content-type: application/json\r\ncontent-length: 412';
        http = {
            open: spy(),
            send: spy(),
            addEventListener: spy(),
            setRequestHeader: spy(),
            getAllResponseHeaders: spy().returns(headers),
        };
        set(global, 'XMLHttpRequest', xhr = spy().returns(http));
    });

    it('constructs XMLHttpRequest', () => {
        request.timeout = 100;
        request.withCredentials = true;
        adapter(request);
        expect(xhr.called).toBe(true);
        expect(http.timeout).toBe(100);
        expect(http.withCredentials).toBe(true);
        expect(http.open.called).toBe(true);
        expect(http.open.args).toEqual(['GET', 'test.com']);
        expect(http.send.called).toBe(true);
        expect(http.send.args).toEqual([null]);
        expect(http.addEventListener.callCount).toBe(4);
    });

    it('changes "json" responseType to "text"', () => {
        request.responseType = 'json';
        adapter(request);
        expect(http.responseType).toBe('text');
    });

    it('sets request headers', () => {
        request.headers = { key: 'value' };
        adapter(request);
        expect(http.setRequestHeader.called).toBe(true);
        expect(http.setRequestHeader.args).toEqual(['key', 'value']);
    });

    it('sets request headers from array', () => {
        request.headers = { key: ['value1', 'value2'] };
        adapter(request);
        expect(http.setRequestHeader.called).toBe(true);
        expect(http.setRequestHeader.args).toEqual(['key', 'value1, value2']);
    });

    it('ignores non-string headers', () => {
        request.headers = {
            key: 123,
            abc: undefined,
            def: 'value',
        };
        adapter(request);
        expect(http.setRequestHeader.called).toBe(true);
        expect(http.setRequestHeader.callCount).toBe(1);
    });

    it('handles null response headers', (done) => {
        http.getAllResponseHeaders.returns(null);
        adapter(request).then(response => {
            expect(response.meta.headers).toEqual({});
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('success returns correct response', (done) => {
        http.status = 204;
        http.statusText = 'No Content';
        http.response = { key: 'value' };
        adapter(request).then(response => {
            expect(response.status).toBe(204);
            expect(response.statusText).toBe('No Content');
            expect(response.data).toMatchObject(http.response);
            expect(response.meta).toMatchObject({
                messages: [],
                error: false,
                cached: false,
                timeout: false,
            });
            expect(response.meta.headers).toMatchObject({
                'content-type': 'application/json',
                'content-length': '412'
            });
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('success returns frozen response', async () => {
        http.status = 200;
        http.statusText = 'OK';
        http.response = { key: 'value' };
        const promise = adapter(request);
        http.addEventListener.calls[0].args[1](); // load
        const response = await promise;
        expect(Object.isFrozen(response)).toBe(true);
    });

    it('sets meta.cached based on Date response header', (done) => {
        const past = new Date(Date.now() - 1000);
        http.status = 200;
        http.response = '';
        http.getAllResponseHeaders.returns(`date: ${past.toGMTString()}`);
        adapter(request).then(response => {
            expect(response.meta.cached).toBe(true);
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('handles safari headers', (done) => {
        const data = { key: 'value' };
        http.status = 200;
        http.response = JSON.stringify(data);
        // safari response headers don't have a space
        // between the header name and the value
        http.getAllResponseHeaders.returns('content-type:application/json');
        adapter(request).then(response => {
            expect(response.status).toBe(200);
            expect(response.meta.headers['content-type']).toBe('application/json');
            expect(response.data).toMatchObject(data);
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('parses JSON string', (done) => {
        const data = { key: 'value' };
        http.status = 200;
        http.response = JSON.stringify(data);
        http.getAllResponseHeaders.returns('content-type: application/json');
        adapter(request).then(response => {
            expect(response.status).toBe(200);
            expect(response.data).toMatchObject(data);
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('strips XSSI prefix from JSON string', (done) => {
        const data = { key: 'value' };
        http.status = 200;
        http.response = ')]}\'\n' + JSON.stringify(data);
        http.getAllResponseHeaders.returns('content-type: application/json');
        adapter(request).then(response => {
            expect(response.status).toBe(200);
            expect(response.data).toMatchObject(data);
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('ignores non-string JSON', (done) => {
        http.status = 200;
        http.response = { key: 'value' };
        request.headers = { 'content-type': 'application/json' };
        adapter(request).then(response => {
            expect(response.status).toBe(200);
            expect(response.data).toMatchObject({ key: 'value' });
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('ignores invalid JSON', (done) => {
        http.status = 200;
        http.response = '{ "invalid" }';
        request.headers = { 'content-type': 'application/json' };
        adapter(request).then(response => {
            expect(response.status).toBe(200);
            expect(response.data).toBe(http.response);
            done();
        });
        http.addEventListener.calls[0].args[1](); // load
    });

    it('error returns correct response', (done) => {
        http.status = 404;
        http.statusText = 'Not Found';
        http.response = null;
        adapter(request).then(response => {
            expect(response.status).toBe(404);
            expect(response.statusText).toBe('Not Found');
            expect(response.data).toBe(null);
            expect(response.meta).toMatchObject({
                messages: [],
                error: true,
                cached: false,
                timeout: false,
            });
            done();
        });
        http.addEventListener.calls[2].args[1](); // error
    });

    it('abort returns correct response', (done) => {
        adapter(request).then(response => {
            expect(response.status).toBe(0);
            expect(response.statusText).toBe('Aborted');
            expect(response.data).toBe(null);
            expect(response.meta).toMatchObject({
                messages: [],
                error: true,
                cached: false,
                timeout: false,
            });
            done();
        });
        http.addEventListener.calls[1].args[1](); // abort
    });

    it('timeout returns correct response', (done) => {
        adapter(request).then(response => {
            expect(response.status).toBe(0);
            expect(response.statusText).toBe('Timeout');
            expect(response.data).toBe(null);
            expect(response.meta).toMatchObject({
                messages: [],
                error: true,
                cached: false,
                timeout: true,
            });
            done();
        });
        http.addEventListener.calls[3].args[1](); // timeout
    });

});

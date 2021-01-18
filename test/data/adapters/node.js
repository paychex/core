import https from 'https';
import expect from 'expect';
import crypto from 'crypto';

import { spy } from '../../utils.js';
import { node } from '../../../data/adapters/node.js';

describe('node adapter', () => {

    let request;
    beforeEach(() => {
        request = {
            ignore: {},
            headers: {},
            tracking: {},
            method: 'GET',
            responseType: '',
            url: 'https://www.paychex.com/path?qs=value',
        };
    });

    let req, res, orig, args = {};
    beforeEach(() => {
        req = {
            on: spy(),
            end: spy(),
            write: spy(),
        };
        res = {
            headers: {},
            statusCode: 0,
            statusMessage: '',
            on: spy(),
            setEncoding: spy(),
        };
        orig = https.request;
        https.request = spy().invokes((url, options, callback) => {
            args.url = url;
            args.options = options;
            args.callback = callback;
            return req;
        });
    });

    afterEach(() => https.request = orig);

    it('sets meta.cached', (done) => {
        const past = '2000-01-01T00:00:00.000Z';
        node(request).then(rsp => {
            expect(rsp.meta.cached).toBe(true);
            done();
        });
        setTimeout(() => {
            res.headers.date = past;
            args.callback(res);
            res.on.args[1](); // resolve
        });
    });

    it('sets multi-value request headers', (done) => {
        request.headers['x-custom'] = ['value 1', 'value 2'];
        node(request);
        setTimeout(() => {
            expect(args.options.headers['x-custom']).toBe('value 1, value 2');
            done();
        });
    });

    it('parses JSON strings', (done) => {
        const payload = { key: 'value' };
        const chunk = JSON.stringify(payload);
        res.headers['content-type'] = 'application/json';
        node(request).then(rsp => {
            expect(rsp.data).toEqual(payload);
            done();
        });
        setTimeout(() => {
            args.callback(res);
            res.on.calls[0].args[1](chunk); // chunk
            res.on.args[1](); // resolve
        });
    });

    it('parses ArrayBuffer', (done) => {
        const chunk = '0x48 0x49';
        request.responseType = 'arraybuffer';
        node(request).then(rsp => {
            expect(rsp.data.toString()).toBe('72,73');
            done();
        });
        setTimeout(() => {
            args.callback(res);
            res.on.calls[0].args[1](chunk); // chunk
            res.on.args[1](); // resolve
        });
    });

    it('parses Document', (done) => {
        const document = Object.create(null);
        const chunk = `<?xml version="1.0"><root />`;
        const parseFromString = spy().returns(document);
        globalThis.DOMParser = spy().returns({ parseFromString });
        res.headers['content-type'] = 'text/xml'
        request.responseType = 'document';
        node(request).then(rsp => {
            expect(rsp.data).toBe(document);
            expect(parseFromString.args).toEqual([chunk, 'text/xml']);
            done();
        });
        setTimeout(() => {
            args.callback(res);
            res.on.calls[0].args[1](chunk); // chunk
            res.on.args[1](); // resolve
        });
    });

    it('errors if Blob requested', (done) => {
        request.responseType = 'blob';
        node(request).then(rsp => {
            expect(rsp.data).toBe(null);
            expect(rsp.meta.error).toBe(true);
            expect(rsp.statusText).toMatch(/Blob/);
            done();
        });
        setTimeout(() => {
            args.callback(res);
            res.on.args[1](); // resolve
        });

    });

    it('sets meta error on error', (done) => {
        const err = new Error('test error');
        node(request).then(rsp => {
            expect(rsp.meta.error).toBe(true);
            expect(rsp.meta.messages[0].code).toBe('test error');
            done();
        });
        setTimeout(() => {
            args.callback(res);
            req.on.calls[0].args[1](err); // error
            res.on.args[1](); // resolve
        });
    });

    it('sets meta error on abort', (done) => {
        node(request).then(rsp => {
            expect(rsp.meta.error).toBe(true);
            done();
        });
        setTimeout(() => {
            args.callback(res);
            req.on.calls[2].args[1](); // abort
            res.on.args[1](); // resolve
        });
    });

    it('sets meta error on timeout', (done) => {
        node(request).then(rsp => {
            expect(rsp.meta.error).toBe(true);
            expect(rsp.meta.timeout).toBe(true);
            done();
        });
        setTimeout(() => {
            args.callback(res);
            req.on.calls[1].args[1](); // timeout
            res.on.args[1](); // resolve
        });
    });

    it('sets request body JSON', (done) => {
        request.body = { key: 'value' };
        node(request);
        setTimeout(() => {
            args.callback(res);
            expect(req.write.called).toBe(true);
            expect(req.write.args[0]).toEqual(expect.any(String));
            done();
        });
    });

    it('sends the request', (done) => {
        node(request);
        setTimeout(() => {
            args.callback(res);
            expect(req.end.called).toBe(true);
            done();
        });
    });

});

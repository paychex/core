import get from 'lodash/get';
import set from 'lodash/set';
import attempt from 'lodash/attempt';
import forEach from 'lodash/forEach';
import isString from 'lodash/isString';

const splitter = /[\r\n]+/;

function asHeaderMap(map, header) {
    const parts = header.split(': ');
    const key = String(parts.shift());
    const value = String(parts.join(': '));
    map[key.trim().toLowerCase()] = value.trim();
    return map;
}

function setStatus(response, http) {
    response.status = http.status;
    response.statusText = http.statusText;
}

function setHeaders(response, http) {
    const headers = http.getAllResponseHeaders() || '';
    response.meta.headers = headers.split(splitter)
        .filter(Boolean)
        .reduce(asHeaderMap, {});
}

function setResponse(response, http) {
    response.data = http.response;
    if (get(response, 'meta.headers.content-type', '').includes('json'))
        attempt(() => response.data = JSON.parse(response.data));
}

function setCached(response, sendDate) {
    const date = new Date(get(response, 'meta.headers.date'));
    if (!isNaN(date)) // determines if Date is valid
        set(response, 'meta.cached', date < sendDate)
}

export async function xhr(request) {

    return new Promise(function XHRPromise(resolve) {

        const sendDate = new Date();
        const http = new XMLHttpRequest();

        const response = {
            meta: {
                headers: {},
                messages: [],
                error: false,
                cached: false,
                timeout: false,
            },
            status: 0,
            statusText: 'OK',
            data: null,
        };

        function success() {
            setStatus(response, http);
            setHeaders(response, http);
            setResponse(response, http);
            setCached(response, sendDate);
            resolve(Object.freeze(response));
        }

        function abort() {
            setHeaders(response, http);
            response.status = 0;
            response.meta.error = true;
            response.statusText = response.meta.timeout ?
                'Timeout' : 'Aborted';
            resolve(Object.freeze(response));
        }

        function timeout() {
            response.meta.timeout = true;
            abort();
        }

        function failure() {
            setHeaders(response, http);
            response.meta.error = true;
            response.status = http.status;
            response.statusText = http.statusText;
            resolve(Object.freeze(response));
        }

        http.timeout = request.timeout;
        http.withCredentials = request.withCredentials;

        http.addEventListener('load', success);
        http.addEventListener('abort', abort);
        http.addEventListener('error', failure);
        http.addEventListener('timeout', timeout);

        http.open(request.method, request.url);

        forEach(request.headers, (value, name) => {
            if (!isString(value)) return;
            http.setRequestHeader(name, value);
        });

        http.send(request.body);

    });

}

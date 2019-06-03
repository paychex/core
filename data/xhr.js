import get from 'lodash/get';
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

export async function xhr(request) {

    return new Promise(function XHRPromise(resolve) {

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

        function setHeaders() {
            const headers = http.getAllResponseHeaders() || '';
            response.meta.headers = headers.split(splitter)
                .filter(Boolean)
                .reduce(asHeaderMap, {});
        }

        function success() {
            setHeaders();
            response.data = http.response;
            response.status = http.status;
            response.statusText = http.statusText;
            if (get(request, 'headers.content-type', '').includes('json'))
                attempt(() => response.data = JSON.parse(response.data));
            resolve(response);
        }

        function abort() {
            setHeaders();
            response.status = 0;
            response.meta.error = true;
            response.statusText = response.meta.timeout ?
                'Timeout' : 'Aborted';
            resolve(response);
        }

        function timeout() {
            response.meta.timeout = true;
            abort();
        }

        function failure() {
            setHeaders();
            response.meta.error = true;
            response.status = http.status;
            response.statusText = http.statusText;
            resolve(response);
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

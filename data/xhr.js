import get from 'lodash/get';
import set from 'lodash/set';
import filter from 'lodash/filter';
import flatten from 'lodash/flatten';
import attempt from 'lodash/attempt';
import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';

const splitter = /[\r\n]+/;
const XSSI = /^\)]\}',?\n/;
const empty = Object.create(null);

function toStringArray(value) {
    return filter(flatten([value]), isString).join(', ');
}

function safeParseJSON(response) {
    const json = String(response.data);
    response.data = JSON.parse(json.replace(XSSI, ''));
}

function asHeaderMap(map, header) {
    const parts = header.split(': ');
    const key = String(parts.shift());
    const value = String(parts.join(': '));
    map[key.trim().toLowerCase()] = value.trim();
    return map;
}

function setResponseType(request, http) {
    http.responseType = request.responseType;
    if (request.responseType === 'json')
        http.responseType = 'text';
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
        attempt(safeParseJSON, response);
}

function setCached(response, sendDate) {
    const date = new Date(get(response, 'meta.headers.date'));
    if (!isNaN(date)) // determines if Date is valid
        set(response, 'meta.cached', date < sendDate)
}

function toKeyValuePair(name) {
    return [name, toStringArray(this[name])];
}

function hasHeaderValue([, values]) {
    return !isEmpty(values);
}

function setRequestHeader([name, value]) {
    this.setRequestHeader(name, value);
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

        setResponseType(request, http);

        Object.keys(get(request, 'headers', empty))
            .map(toKeyValuePair, request.headers)
            .filter(hasHeaderValue)
            .forEach(setRequestHeader, http);

        http.send(request.body);

    });

}

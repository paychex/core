import QS from 'query-string';

const rxToken = /:(\w+)/g;
const rxTrailing = /\?$/;

const replacer = params => (token, key) => {
    const value = params[key] || token;
    delete params[key];
    return value;
}

export default function tokenize(url = '', params = {}) {
    const values = {...params};
    const out = url.replace(rxToken, replacer(values));
    const qs = QS.stringify(values);
    const sep = out.includes('?') ? '&' : '?';
    return (out + sep + qs).replace(rxTrailing, '');
}

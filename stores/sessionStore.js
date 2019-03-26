import createStore from './htmlStore';

export default function sessionStore(provider = sessionStorage) {

    return createStore(provider);

}

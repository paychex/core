import{ map, take } from 'rxjs/operators';

import PayxContext from './PayxContext';

class PayxComponentLoader extends HTMLElement {

    connectedCallback() {
        if (!this.hasAttribute('name')) throw new Error('Attribute "name" is required.');
        PayxComponentLoader.create(this.getAttribute('name'), this)
            .then(el => this.appendChild(el));
    }

    static create(name, context) {
        return PayxContext.get(context || document.body, 'userInfo', {inherit: true})
            .pipe(
                take(1),
                map(userInfo => userInfo.modules[name])
            )
            .toPromise()
            .then(src => !!src && !window.customElements.get(name) && import(src))
            .then(() => document.createElement(name));
    }

}

window.customElements.get('payx-component-loader') ||
    window.customElements.define('payx-component-loader', PayxComponentLoader);

export default PayxComponentLoader;
import UnloadStrategy from './unload';
import PayxComponentLoader from './PayxComponentLoader';

const instances = new Map();

class PayxContainer extends HTMLElement {

    static getById(id) {
        return instances.get(id);
    }

    static verifyElement(el) {
        if (!el || !(el instanceof HTMLElement)) {
            throw new Error(`The argument must be an HTMLElement.`);
        }
    }

    static dispatch(instance, event, detail) {
        instance.dispatchEvent(new CustomEvent(event, { bubbles: true, detail }));
    }

    constructor(...args) {
        super(...args);
        this.addHandlers = [];
        this.registerAddHandler((el, add) => PayxComponentLoader.create(el).then(add))
    }

    connectedCallback() {
        this.staticId = this.getAttribute('static-id');
        const strategy = this.getAttribute('unload-strategy') || UnloadStrategy.DEFAULT;
        if (instances.has(this.staticId)) {
            throw new Error(`PayxContainer with static-id "${this.staticId}" already in DOM.`);
        } else if (!UnloadStrategy.isValid(strategy)) {
            throw new Error(`Invalid unload-strategy: "${strategy}"`);
        }
        this.staticId && instances.set(this.staticId, this);
        this.unloadStrategy = UnloadStrategy.create(strategy, this);
    }

    disconnectedCallback() {
        this.staticId && instances.delete(this.staticId);
    }

    registerAddHandler(handler) {
        this.addHandlers.unshift(handler);
    }

    add(el) {
        if (typeof el === 'string') {
            return this.addHandlers.reduce((promise, handler) => 
                promise.catch(() => handler(el, child => this.add(child))),
                Promise.reject()
            );
        }
        PayxContainer.verifyElement(el);
        this.appendChild(el);
        this.classList.add('open');
        PayxContainer.dispatch(this, 'payx:component-added', el);
        requestAnimationFrame(() => el.classList.add('open'));
        return Promise.resolve()
            .then(() => el.load && el.load());
    }

    remove(el) {
        PayxContainer.verifyElement(el);
        if (!this.contains(el)) return;
        return Promise.resolve()
            .then(() => this.unloadStrategy.remove(el))
            .then(() => {
                el.classList.remove('open');
                return new Promise(resolve => setTimeout(resolve, 100))
            })
            .then(() => {
                this.contains(el) && this.removeChild(el);
                PayxContainer.dispatch(this, 'payx:component-removed', el);
            })
            .then(() => this.hasChildNodes() || this.classList.remove('open'));
    }

    clear() {
        return Promise.resolve()
            .then(() => this.unloadStrategy.clear(this.children))
            .then(() => this.innerHTML = '');
    }

}

window.customElements.get('payx-container') ||
    window.customElements.define('payx-container', PayxContainer);

export default PayxContainer;
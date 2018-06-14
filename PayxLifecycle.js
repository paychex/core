/**
 * @param {Class} [Base=HTMLElement] The base HTMLElement class your element extends.
 * @example
 * const PayxLifecycle = require('...');
 * export default class MyFormComponent extends PayxLifecycle(HTMLFormElement) {
 *     // override the methods you care about:
 *     load() {}
 *     unload() {}
 *     shouldUnload() {}
 * };
 */
export default (Base = HTMLElement) => class extends Base {
    load() {}
    unload() {}
    shouldUnload() {}
    attachHTML(html) {
        if (!this.shadowRoot) {
            this.attachShadow({mode: 'open'});
        }
        const template = document.createElement('template');
        template.innerHTML = html;
        this.shadowRoot.appendChild(document.importNode(template.content, true));
    }
}
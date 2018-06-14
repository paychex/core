const html = `
    <style type="text/css">
        dialog menu {
            padding: 0;
            margin: 1em 0 0 0;
        }
        dialog menu button {
            padding: .5em;
        }
        dialog menu button:not(:last-child) {
            margin-right: .5em;
        }
    </style>
    <dialog template>
        <form method="dialog">
            <div></div>
            <menu></menu>
        </form>
    </dialog>
`

class PayxDialog extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = html;
    }

    showDialog(options) {
        return new Promise((resolve, reject) => {
            const { modal = false, actions = [], html = '' } = options;
            const dialog = this.shadowRoot.querySelector('dialog');
            const menu = dialog.querySelector('menu');
            const content = dialog.querySelector('div');
            actions.forEach(action => {
                const button = document.createElement('button');
                button.innerText = action.text;
                button.addEventListener('click', () => handleResult(action.value, action.cancel));
                menu.appendChild(button);
            });
            content.innerHTML = html;
            function handleResult(value, cancel = false) {
                cancel ? reject(value) : resolve(value);
                dialog.close();
            }
            dialog.addEventListener('close', () => this.parentNode.removeChild(this));
            dialog.addEventListener('cancel', () => handleResult('user cancelled', true));
            modal ? dialog.showModal() : dialog.show();
        });
    }
    
}

window.customElements.get('payx-dialog') ||
    window.customElements.define('payx-dialog', PayxDialog);

export default 'payx-dialog';
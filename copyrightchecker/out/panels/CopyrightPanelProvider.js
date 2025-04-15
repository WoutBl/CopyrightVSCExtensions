"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyrightPanelProvider = void 0;
const vscode = __importStar(require("vscode"));
class CopyrightPanelProvider {
    context;
    static viewType = 'copyrightSidebar.configView';
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = {
            enableScripts: true
        };
        // Initialize global state values if not already set
        const currentCompany = this.context.globalState.get('company') || 'Default Company';
        const currentEmail = this.context.globalState.get('email') || 'default@example.com';
        webviewView.webview.html = this.getHtml(webviewView.webview, currentCompany, currentEmail);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                if (message.command === 'saveConfig') {
                    await this.context.globalState.update('company', message.company);
                    await this.context.globalState.update('email', message.email);
                    vscode.window.showInformationMessage('Copyright config saved!');
                }
            }
            catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }
    getHtml(webview, company, email) {
        // Escape HTML to prevent injection issues
        const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return /* html */ `
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 1rem; }
                    input { width: 100%; margin-bottom: 1rem; padding: 0.5rem; }
                    button { padding: 0.5rem 1rem; }
                </style>
            </head>
            <body>
                <h2>Copyright Config</h2>
                <label>Company</label>
                <input id="company" type="text" value="${escapeHtml(company)}">
                <label>Email</label>
                <input id="email" type="text" value="${escapeHtml(email)}">
                <button onclick="save()">Save Config</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    function save() {
                        const company = document.getElementById('company').value;
                        const email = document.getElementById('email').value;
                        vscode.postMessage({ command: 'saveConfig', company, email });
                    }
                </script>
            </body>
            </html>
        `;
    }
}
exports.CopyrightPanelProvider = CopyrightPanelProvider;
//# sourceMappingURL=CopyrightPanelProvider.js.map
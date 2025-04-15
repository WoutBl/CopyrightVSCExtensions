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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ignore_1 = __importDefault(require("ignore"));
const DIAGNOSTIC_COLLECTION = vscode.languages.createDiagnosticCollection("copyrightChecker");
function activate(context) {
    const command = vscode.commands.registerCommand('extension.checkCopyrightHeaders', () => {
        runCheck();
    });
    context.subscriptions.push(command, vscode.commands.registerCommand('extension.insertCopyrightHeader', async (uri) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        const company = vscode.workspace.getConfiguration().get('copychecker.company') ?? 'Your company';
        const email = vscode.workspace.getConfiguration().get('copychecker.email') ?? 'Your company email';
        const year = new Date().getFullYear();
        const fileName = path.basename(document.fileName);
        const snippet = new vscode.SnippetString(`/*\n` +
            `* @file ${fileName}\n` +
            `*\n` +
            `* \${1:brief explanation what the file contains}\n` + // <- This is the snippet tabstop
            `*\n` +
            `* Copyright ${year}, ${company} <${email}>\n` +
            `*/\n\n`);
        editor.insertSnippet(snippet, new vscode.Position(0, 0));
    }));
    vscode.workspace.onDidOpenTextDocument(doc => runCheck());
    vscode.workspace.onDidSaveTextDocument(doc => runCheck());
    vscode.languages.registerCodeActionsProvider('*', new CopyRightCodeActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    });
    runCheck();
}
function runCheck() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders)
        return;
    const root = workspaceFolders[0].uri.fsPath;
    const company = vscode.workspace.getConfiguration().get('copychecker.company') ?? 'Your company';
    const email = vscode.workspace.getConfiguration().get('copychecker.email') ?? 'Your company email';
    const regex = new RegExp(`Copyright 20\\d{2}, ${escapeRegex(company)} <${escapeRegex(email)}>`, 'i');
    const ig = (0, ignore_1.default)();
    ig.add([
        '**/.git',
        '**/node_modules',
        '**/bin',
        '**/obj',
        '**/dist',
        '**/out',
        '**/.vscode',
        '**.copyignore'
    ]);
    findCopyIgnoreFiles(root).forEach(file => {
        const relDir = path.dirname(path.relative(root, file));
        const rawLines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        const lines = rawLines
            .map(x => x.trim())
            .filter(x => x && !x.startsWith("#"));
        console.log(`Adding ignore rules from ${file}:`, lines);
        lines.forEach((line) => ig.add(path.join(relDir, line)));
        console.log(`Added ignore rules from ${file}:`, ig);
    });
    const allFiles = getAllFiles(root);
    const filesToCheck = allFiles.filter(f => !ig.ignores(path.relative(root, f)));
    const diagnosticsMap = new Map();
    for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf8');
        if (!regex.test(content)) {
            const uri = vscode.Uri.file(file);
            const diagnostic = new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)), `Missing or invalid copyright header.`, vscode.DiagnosticSeverity.Warning);
            diagnostic.code = 'missingCopyright';
            const existing = diagnosticsMap.get(uri.fsPath) ?? [];
            diagnosticsMap.set(uri.fsPath, [...existing, diagnostic]);
        }
    }
    DIAGNOSTIC_COLLECTION.clear();
    diagnosticsMap.forEach((diags, file) => {
        DIAGNOSTIC_COLLECTION.set(vscode.Uri.file(file), diags);
    });
}
function getAllFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        }
        else {
            results.push(fullPath);
        }
    }
    return results;
}
function findCopyIgnoreFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findCopyIgnoreFiles(fullPath));
        }
        else if (entry.name === '.copyignore') {
            results.push(fullPath);
        }
    }
    return results;
}
function escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
class CopyRightCodeActionProvider {
    provideCodeActions(document, range) {
        const diagnostics = DIAGNOSTIC_COLLECTION.get(document.uri);
        if (!diagnostics)
            return;
        const actions = [];
        for (const diag of diagnostics) {
            if (diag.code === 'missingCopyright') {
                const fix = new vscode.CodeAction('Add copyright header', vscode.CodeActionKind.QuickFix);
                // Call a command that inserts the snippet
                fix.command = {
                    title: 'Insert copyright header',
                    command: 'extension.insertCopyrightHeader',
                    arguments: [document.uri]
                };
                fix.diagnostics = [diag];
                fix.isPreferred = true;
                actions.push(fix);
            }
        }
        return actions;
    }
}
function deactivate() {
    DIAGNOSTIC_COLLECTION.clear();
}
//# sourceMappingURL=extension.js.map
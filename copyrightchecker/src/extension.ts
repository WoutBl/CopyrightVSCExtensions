import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

const DIAGNOSTIC_COLLECTION = vscode.languages.createDiagnosticCollection("copyrightChecker");

export function activate(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('extension.checkCopyrightHeaders', () => {
        runCheck();
    });

    context.subscriptions.push(command, vscode.commands.registerCommand('extension.insertCopyrightHeader', async (uri: vscode.Uri) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
    
        const company = vscode.workspace.getConfiguration().get<string>('copychecker.company') ?? 'Your company';
        const email = vscode.workspace.getConfiguration().get<string>('copychecker.email') ?? 'Your company email';
        const year = new Date().getFullYear();
        const fileName = path.basename(document.fileName);
    
        const snippet = new vscode.SnippetString(
            `/*\n` +
            `* @file ${fileName}\n` +
            `*\n` +
            `* \${1:brief explanation what the file contains}\n` + // <- This is the snippet tabstop
            `*\n` +
            `* Copyright ${year}, ${company} <${email}>\n` +
            `*/\n\n`
        );
    
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
    if (!workspaceFolders) return;

    const root = workspaceFolders[0].uri.fsPath;
    const company = vscode.workspace.getConfiguration().get<string>('copychecker.company') ?? 'Your company';
    const email = vscode.workspace.getConfiguration().get<string>('copychecker.email') ?? 'Your company email';

    const regex = new RegExp(`Copyright 20\\d{2}, ${escapeRegex(company)} <${escapeRegex(email)}>`, 'i');

    const ig = ignore();
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
            .filter(x => x && !x.startsWith("#"))
        console.log(`Adding ignore rules from ${file}:`, lines);
        lines.forEach((line: string) => ig.add(path.join(relDir, line)));
        console.log(`Added ignore rules from ${file}:`, ig);
    });

    const allFiles = getAllFiles(root);
    const filesToCheck = allFiles.filter(f => !ig.ignores(path.relative(root, f)));

    const diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();

    for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf8');
        if (!regex.test(content)) {
            const uri = vscode.Uri.file(file);
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
                `Missing or invalid copyright header.`,
                vscode.DiagnosticSeverity.Warning
            );
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

function getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    }

    return results;
}

function findCopyIgnoreFiles(dir: string): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findCopyIgnoreFiles(fullPath));
        } else if (entry.name === '.copyignore') {
            results.push(fullPath);
        }
    }

    return results;
}

function escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class CopyRightCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] | undefined {
        const diagnostics = DIAGNOSTIC_COLLECTION.get(document.uri);
        if (!diagnostics) return;

        const actions: vscode.CodeAction[] = [];

        for (const diag of diagnostics) {
            if (diag.code === 'missingCopyright') {
                const fix = new vscode.CodeAction(
                    'Add copyright header',
                    vscode.CodeActionKind.QuickFix
                );
                
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

export function deactivate() {
    DIAGNOSTIC_COLLECTION.clear();
}

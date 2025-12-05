import { isMatch } from 'micromatch';
import * as vscode from 'vscode';

/**
 * The exclusive DiagnosticCollection for this extension.
 *
 * Initialised in activate(). Disposed in deactivate().
 */
let collection: vscode.DiagnosticCollection;

/**
 * The severity level at which to display keywords that are found.
 *
 * Read from the extension settings.
 */
let severityLevel = vscode.DiagnosticSeverity.Information;

/**
 * Determines if keyword search is case insensitive.
 *
 * Read from the extension settings.
 */
let caseInsensitiveSearch = true;

/**
 * The set of files (within the workspace) to search for keywords.
 *
 * Read from the extension settings.
 */
let globPattern = '{**/*.txt,**/*.md}';

/**
 * The keywords to search for.
 *
 * Read from the extension settings.
 */
let keywords = ['FIXME', 'PLACEHOLDER', 'TODO'];

/**
 * The maximum length of the message printed to the Problems pane.
 *
 * Read from the extension settings.
 */
let resultDisplayMaxLen = 120;

/**
 * The RegExps generated from keywords.
 *
 * Initialised in initSettings().
 */
let regExps: RegExp[] = [];

/**
 * The RegExp representing EOL.
 */
const eol = /\r?\n/;

export function activate(context: vscode.ExtensionContext) {
  initSettings();

  collection = vscode.languages.createDiagnosticCollection('todos-n-fixmes');

  registerHandlers(context);
  registerCommands(context);

  initWorkspaceDiagnostics();
}

export function deactivate() {
  collection.dispose();
}

/**
 * Initializes the extension configuration.
 */
const initSettings = () => {
  const configuration = vscode.workspace.getConfiguration('todos-n-fixmes');

  switch (configuration.get('severityLevel')) {
    case 'Error':
      severityLevel = vscode.DiagnosticSeverity.Error;
      break;
    case 'Warning':
      severityLevel = vscode.DiagnosticSeverity.Warning;
      break;
    case 'Information':
      severityLevel = vscode.DiagnosticSeverity.Information;
      break;
    case 'Hint':
      severityLevel = vscode.DiagnosticSeverity.Hint;
      break;
    default:
      break;
  }
  caseInsensitiveSearch = configuration.get('caseInsensitiveSearch') ?? caseInsensitiveSearch;
  globPattern = configuration.get('globPattern') ?? globPattern;
  keywords = configuration.get('keywords') ?? keywords;
  resultDisplayMaxLen = configuration.get('resultDisplayMaximumLength') ?? resultDisplayMaxLen;

  regExps = keywords.map(
    (value: string, _, __) => new RegExp(value, caseInsensitiveSearch ? 'i' : undefined)
  );
};

/**
 * Registers event handlers for the extension.
 *
 * @param context The extension context that will hold all the handlers.
 */
const registerHandlers = (context: vscode.ExtensionContext) => {
  const onDidSaveTextDocumentHandle = vscode.workspace.onDidSaveTextDocument(
    (e: vscode.TextDocument) => {
      if (pathMatchesGlobPattern(e.uri.path)) {
        updateFileDiagnostics(e.uri);
      }
    }
  );
  context.subscriptions.push(onDidSaveTextDocumentHandle);

  const onDidCreateFilesHandle = vscode.workspace.onDidCreateFiles((e: vscode.FileCreateEvent) => {
    for (const file of e.files) {
      if (pathMatchesGlobPattern(file.path)) {
        updateFileDiagnostics(file);
      }
    }
  });
  context.subscriptions.push(onDidCreateFilesHandle);

  const onDidRenameFilesHandle = vscode.workspace.onDidRenameFiles((e: vscode.FileRenameEvent) => {
    for (const file of e.files) {
      const prev_diagnostics = collection.get(file.oldUri);
      collection.set(file.oldUri, undefined);

      if (pathMatchesGlobPattern(file.newUri.path)) {
        if (pathMatchesGlobPattern(file.oldUri.path)) {
          // Reuse previous diagnostics.
          collection.set(file.newUri, prev_diagnostics);
        } else {
          updateFileDiagnostics(file.newUri);
        }
      }
    }
  });
  context.subscriptions.push(onDidRenameFilesHandle);

  const onDidDeleteFilesHandle = vscode.workspace.onDidDeleteFiles((e: vscode.FileDeleteEvent) => {
    for (const file of e.files) {
      collection.set(file, undefined);
    }
  });
  context.subscriptions.push(onDidDeleteFilesHandle);
};

/**
 * Registers commands for the extension.
 *
 * @param context The extension context that will hold all the handlers.
 */
const registerCommands = (context: vscode.ExtensionContext) => {
  const rescanWorkspaceHandle = vscode.commands.registerCommand(
    'todos-n-fixmes.rescan-workspace',
    async () => {
      await updateWorkspaceDiagnostics();

      vscode.window.setStatusBarMessage('TODOs & FIXMEs: rescan complete', 5000);
    }
  );

  context.subscriptions.push(rescanWorkspaceHandle);
};

/**
 * Matches the given path against globPattern.
 *
 * @param path The path to match.
 * @returns true if path matches. false otherwise.
 */
const pathMatchesGlobPattern = (path: string): boolean => isMatch(path, globPattern);

/**
 * Performs keyword search on all matching files in the current workspace.
 */
const initWorkspaceDiagnostics = async (): Promise<void> => updateWorkspaceDiagnostics();

/**
 * Performs keyword search on all matching files in the current workspace.
 */
const updateWorkspaceDiagnostics = async (): Promise<void> => {
  // Quick return if nothing to do.
  if (regExps.length === 0) {
    return;
  }

  const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];

  const files = await vscode.workspace.findFiles(globPattern);
  for (const file of files) {
    try {
      const bytes = await vscode.workspace.fs.readFile(file);
      const content = await vscode.workspace.decode(bytes);
      const diagnostics = scanFileContent(content, regExps);

      if (diagnostics !== undefined) {
        entries.push([file, diagnostics]);
      }
    } catch (error) {
      // Just skip over bad files.
      console.debug(error);
    }
  }

  collection.clear();
  collection.set(entries);
};

/**
 * Performs keyword search on the given file, then updates the diagnostics.
 *
 * @param uri The URI of the file to be updated.
 */
const updateFileDiagnostics = async (uri: vscode.Uri): Promise<void> => {
  // Quick return if nothing to do.
  if (regExps.length === 0) {
    return;
  }

  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = await vscode.workspace.decode(bytes);
    const diagnostics = scanFileContent(content, regExps);

    collection.set(uri, diagnostics);
  } catch (error) {
    // Just skip over bad files.
    console.debug(error);
  }
};

/**
 * Scans the given file content for keywords.
 *
 * @param content The file content to search in.
 * @param regExps The RegExps to search for in file content.
 * @returns The set of Diagnostics for this file to be set in the DiagnosticCollection.
 */
const scanFileContent = (content: String, regExps: RegExp[]): vscode.Diagnostic[] | undefined => {
  let diagnostics: vscode.Diagnostic[] = [];

  content.split(eol).forEach((line: string, lineNumber: number, _) => {
    regExps.forEach((regExp: RegExp, _, __) => {
      // Only the first match will count for each line.
      const col = line.search(regExp);
      if (col > -1) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(
              new vscode.Position(lineNumber, col),
              new vscode.Position(lineNumber, col + [...regExp.source].length)
            ),
            line.slice(col, col + resultDisplayMaxLen),
            severityLevel
          )
        );
      }
    });
  });

  return diagnostics.length > 0 ? diagnostics : undefined;
};

/**
 * Symbols exported for unit testing.
 */
export const unitTest = { scanFileContent };

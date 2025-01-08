import { isMatch } from 'micromatch';
import * as vscode from 'vscode';

/**
 * The exclusive DiagnosticCollection for this extension.
 *
 * Initialised in activate(). Disposed in deactivate().
 */
let collection: vscode.DiagnosticCollection;

let caseInsensitiveSearch = false;

let globPattern = '**/*.rs';

let keywords = ['FIXME', 'TODO', 'todo!'];

let resultDisplayMaxLen = 120;

/**
 * The search functions corresponding to keywords.
 *
 * Initialised in initSettings().
 */
let predicates: Array<
  (value: number, index: number, obj: Uint8Array<ArrayBufferLike>) => number | undefined
>;

let newline = '\n'.charCodeAt(0);

export function activate(context: vscode.ExtensionContext) {
  initSettings();

  collection = vscode.languages.createDiagnosticCollection('todos-n-fixmes');

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
      updateFileDiagnostics(file);
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

  caseInsensitiveSearch = configuration.get('caseInsensitiveSearch')!;
  globPattern = configuration.get('globPattern')!;
  keywords = configuration.get('keywords')!;

  predicates = keywords.map((value: string, index: number, array: string[]) =>
    searchPredicate(value)
  );
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
  const files = await vscode.workspace.findFiles(globPattern);

  const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];
  for (const file of files) {
    const content = await vscode.workspace.fs.readFile(file);
    const diagnostics = scanFileContent(content);

    if (diagnostics !== undefined) {
      entries.push([file, diagnostics]);
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
  const content = await vscode.workspace.fs.readFile(uri);
  const diagnostics = scanFileContent(content);

  collection.set(uri, diagnostics);
};

/**
 * Scans the given buffer for keywords.
 *
 * @param buffer The file content to search in.
 * @returns The set of Diagnostics for this file to be set in the DiagnosticCollection.
 */
const scanFileContent = (buffer: Uint8Array<ArrayBufferLike>): vscode.Diagnostic[] | undefined => {
  let diagnostics: vscode.Diagnostic[] = [];
  let lines: number[] = [-1];
  buffer.forEach((value: number, index: number, array: Uint8Array<ArrayBufferLike>) => {
    if (value === newline) {
      lines.push(index);
      return;
    }

    for (const predicate of predicates) {
      const searchResult = predicate(value, index, array);

      if (searchResult === undefined) {
        continue;
      }

      const line = lines.length - 1;
      const endCol = index - lines[lines.length - 1];
      const startCol = endCol - searchResult;

      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(line, startCol), new vscode.Position(line, endCol)),
          firstLineFrom(index - searchResult + 1, buffer, resultDisplayMaxLen),
          vscode.DiagnosticSeverity.Information
        )
      );
    }
  });

  return diagnostics.length > 0 ? diagnostics : undefined;
};

/**
 * Generates the display string for the search result.
 *
 * @param start The starting index in the buffer.
 * @param buffer The file content to generate the display string from.
 * @param maxLen The maximum length of the generated string, ignoring the truncation ellipsis.
 * @returns The generated display string.
 */
const firstLineFrom = (
  start: number,
  buffer: Uint8Array<ArrayBufferLike>,
  maxLen: number
): string => {
  const eol = buffer.indexOf(newline, start);

  let end = start + maxLen;
  let truncated = true;
  if (eol !== -1 && eol < end) {
    end = eol;
    truncated = false;
  }

  return buffer.slice(start, end).toString() + (truncated ? '...' : '');
};

/**
 * Converts a keyword to a function that checks whether the term is found at an index in an array.
 *
 * @param keyword The keyword to search for.
 * @returns The length of the keyword if it is found just before (and including) the index.
 * undefined otherwise.
 */
const searchPredicate = (
  keyword: string
): ((value: number, index: number, obj: Uint8Array<ArrayBufferLike>) => number | undefined) => {
  const reversed = keyword.split('').reverse();

  return (_, index, obj) => {
    if (index < reversed.length - 1) {
      return undefined;
    }

    return reversed.every(
      (char, reversed_index, _) => obj[index - reversed_index] === char.charCodeAt(0)
    )
      ? reversed.length
      : undefined;
  };
};

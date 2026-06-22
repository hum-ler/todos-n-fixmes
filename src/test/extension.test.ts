import * as assert from 'assert';
import * as vscode from 'vscode';
import { unitTest } from '../extension';

suite('Extension Test Suite', () => {
  test('scanFileContent', () => {
    let actual = unitTest.scanFileContent('\nXTODOX\nXtodoX\n', [/TODO/i]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 2);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 5)),
        'TODOX',
        vscode.DiagnosticSeverity.Information,
      ),
    );
    assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(2, 1), new vscode.Position(2, 5)),
        'todoX',
        vscode.DiagnosticSeverity.Information,
      ),
    );

    actual = unitTest.scanFileContent('\r\nXTODOX\r\nXtodoX\r\n', [/TODO/i]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 2);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 5)),
        'TODOX',
        vscode.DiagnosticSeverity.Information,
      ),
    );
    assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(2, 1), new vscode.Position(2, 5)),
        'todoX',
        vscode.DiagnosticSeverity.Information,
      ),
    );

    actual = unitTest.scanFileContent('XTODOXfixmeXTODOX', [/FIXME/i, /TODO/i]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 2);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 6), new vscode.Position(0, 11)),
        'fixmeXTODOX',
        vscode.DiagnosticSeverity.Information,
      ),
    );
    assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 1), new vscode.Position(0, 5)),
        'TODOXfixmeXTODOX',
        vscode.DiagnosticSeverity.Information,
      ),
    );

    actual = unitTest.scanFileContent('xxx', [/FIXME/i, /TODO/i]);
    assert.strictEqual(actual, undefined);
  });

  test('UTF-8', () => {
    const input = '中英文均可';
    const positiveRegExp = /英文/;
    const negativeRegExp = /你好/;
    const positiveCaseInsensitiveRegExp = /英文/i;
    const negativeCaseInsensitiveRegExp = /你好/i;

    let actual = unitTest.scanFileContent(input, [positiveRegExp]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 1);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 1), new vscode.Position(0, 3)),
        '英文均可',
        vscode.DiagnosticSeverity.Information,
      ),
    );

    actual = unitTest.scanFileContent(input, [negativeRegExp]);
    assert.strictEqual(actual, undefined);

    actual = unitTest.scanFileContent(input, [positiveCaseInsensitiveRegExp]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 1);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 1), new vscode.Position(0, 3)),
        '英文均可',
        vscode.DiagnosticSeverity.Information,
      ),
    );

    actual = unitTest.scanFileContent(input, [negativeCaseInsensitiveRegExp]);
    assert.strictEqual(actual, undefined);
  });

  test('excludePattern and includePattern matching', () => {
    // 1. excludePattern is undefined, path matches includePattern.
    unitTest.setPatterns('{**/*.txt,**/*.md}', undefined);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/file.txt'), true);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/file.md'), true);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/file.js'), false);

    // 2. excludePattern set, matches excludePattern.
    unitTest.setPatterns('{**/*.txt,**/*.md}', '**/exclude/**');
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/file.txt'), true);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/exclude/file.txt'), false);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('exclude/file.md'), false);
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/exclude/other/file.txt'), false);

    // 3. excludePattern set, doesn't match excludePattern.
    assert.strictEqual(unitTest.pathMatchesGlobPattern('src/other/file.txt'), true);
  });
});

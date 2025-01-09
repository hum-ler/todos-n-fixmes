import * as assert from 'assert';
import * as vscode from 'vscode';
import { unitTest } from '../extension';

suite('Extension Test Suite', () => {
  test('searchPredicate', () => {
    const predicate = unitTest.searchPredicate('TODO');

    let actual = Buffer.from('XTODOXTODOX').map(
      (value, index, array) => predicate(value, index, array) ?? 0
    );
    assert.deepEqual(Array.from(actual), [0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0]);

    actual = Buffer.from('TODOTODO').map(
      (value, index, array) => predicate(value, index, array) ?? 0
    );
    assert.deepEqual(Array.from(actual), [0, 0, 0, 4, 0, 0, 0, 4]);

    actual = Buffer.from('TODO').map((value, index, array) => predicate(value, index, array) ?? 0);
    assert.deepEqual(Array.from(actual), [0, 0, 0, 4]);

    actual = Buffer.from('XXX').map((value, index, array) => predicate(value, index, array) ?? 0);
    assert.deepEqual(Array.from(actual), [0, 0, 0]);

    actual = Buffer.from('tOdO').map((value, index, array) => predicate(value, index, array) ?? 0);
    assert.deepEqual(Array.from(actual), [0, 0, 0, 0]);
  });

  test('caseInsensitiveSearchPredicate', () => {
    const predicate = unitTest.caseInsensitiveSearchPredicate('TODO');

    let actual = Buffer.from('XTODOXtodoX').map(
      (value, index, array) => predicate(value, index, array) ?? 0
    );
    assert.deepEqual(Array.from(actual), [0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0]);

    actual = Buffer.from('TOdotoDO').map(
      (value, index, array) => predicate(value, index, array) ?? 0
    );
    assert.deepEqual(Array.from(actual), [0, 0, 0, 4, 0, 0, 0, 4]);

    actual = Buffer.from('TODO').map((value, index, array) => predicate(value, index, array) ?? 0);
    assert.deepEqual(Array.from(actual), [0, 0, 0, 4]);

    actual = Buffer.from('XXX').map((value, index, array) => predicate(value, index, array) ?? 0);
    assert.deepEqual(Array.from(actual), [0, 0, 0]);
  });

  test('firstLineFrom', () => {
    const lfInput = '\nTODO\n';
    const crInput = '\r\nTODO\r\n';

    assert.strictEqual(unitTest.firstLineFrom(1, Buffer.from(lfInput), 100), 'TODO');
    assert.strictEqual(unitTest.firstLineFrom(2, Buffer.from(crInput), 100), 'TODO');

    assert.strictEqual(unitTest.firstLineFrom(1, Buffer.from(lfInput), 3), 'TOD...');
    assert.strictEqual(unitTest.firstLineFrom(1, Buffer.from(lfInput), 4), 'TODO');
    assert.strictEqual(unitTest.firstLineFrom(1, Buffer.from(lfInput), 0), '...');
  });

  test('scanFileContent', () => {
    const findTodo = unitTest.caseInsensitiveSearchPredicate('TODO');
		const findFixme = unitTest.caseInsensitiveSearchPredicate('FIXME');

		const resultDisplayMaxLen = 100;

    let actual = unitTest.scanFileContent(Buffer.from('\nXTODOX\nXtodoX\n'), [findTodo]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 2);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 5)),
        'TODOX',
        vscode.DiagnosticSeverity.Information
      )
    );
    assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(2, 1), new vscode.Position(2, 5)),
        'todoX',
        vscode.DiagnosticSeverity.Information
      )
    );

    actual = unitTest.scanFileContent(Buffer.from('\r\nXTODOX\r\nXtodoX\r\n'), [findTodo]);
    assert.notStrictEqual(actual, undefined);
    assert.strictEqual(actual!.length, 2);
    assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 5)),
        'TODOX',
        vscode.DiagnosticSeverity.Information
      )
    );
    assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(2, 1), new vscode.Position(2, 5)),
        'todoX',
        vscode.DiagnosticSeverity.Information
      )
    );

		actual = unitTest.scanFileContent(Buffer.from('XTODOXfixmeXTODOX'), [findFixme, findTodo]);
		assert.notStrictEqual(actual, undefined);
		assert.strictEqual(actual!.length, 3);
		assert.deepStrictEqual(
      actual![0],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 1), new vscode.Position(0, 5)),
        'TODOXfixmeXTODOX',
        vscode.DiagnosticSeverity.Information
      )
    );
		assert.deepStrictEqual(
      actual![1],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 6), new vscode.Position(0, 11)),
        'fixmeXTODOX',
        vscode.DiagnosticSeverity.Information
      )
    );
		assert.deepStrictEqual(
      actual![2],
      new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 12), new vscode.Position(0, 16)),
        'TODOX',
        vscode.DiagnosticSeverity.Information
      )
    );

		actual = unitTest.scanFileContent(Buffer.from('xxx'), [findFixme, findTodo]);
		assert.strictEqual(actual, undefined);
  });
});

'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  ObservableDiagnosticProvider,
  DiagnosticProviderUpdate,
  InvalidationMessage,
  FileDiagnosticMessage,
} from '../../nuclide-diagnostics-base';
import type {Result} from '../../nuclide-active-editor-based-service';

import type {CoverageResult, CoverageProvider} from '../lib/types';

import invariant from 'assert';
import {Range} from 'atom';
import {Subject} from 'rxjs';

import {diagnosticProviderForResultStream} from '../lib/coverageDiagnostics';

describe('diagnosticProviderForResultStream', () => {
  let inputResults: Subject<Result<CoverageProvider, ?CoverageResult>> = (null: any);
  let isEnabledStream: Subject<boolean> = (null: any);

  let diagnosticProvider: ObservableDiagnosticProvider = (null: any);

  let updates: Array<Array<FileDiagnosticMessage>> = (null: any);
  let invalidations: Array<InvalidationMessage> = (null: any);

  let editor: atom$TextEditor = (null: any);

  let provider: CoverageProvider = (null: any);
  let sampleResult: CoverageResult = (null: any);

  beforeEach(() => {
    updates = [];
    invalidations = [];
    inputResults = new Subject();
    isEnabledStream = new Subject();
    diagnosticProvider = diagnosticProviderForResultStream(inputResults, isEnabledStream);

    // For now it's easy enough to stub out the editor but in the future it may be worthwhile to use
    // an action TextEditor object. We would need an actual fixture to open, though, since we rely
    // on the path being non-null (so `atom.workspace.open()` would not be sufficient).
    editor = ({
      getPath() { return 'foo'; },
    }: any);

    provider = {
      getCoverage() { return Promise.resolve(null); },
      priority: 1,
      grammarScopes: [],
      displayName: 'Foo',
    };

    sampleResult = {
      percentage: 90,
      uncoveredRanges: [
        new Range([1, 2], [3, 4]),
      ],
    };

    diagnosticProvider.updates.subscribe((update: DiagnosticProviderUpdate) => {
      // We go through all this just to extract the array of file messages for the current file.
      const filePathToMessages = update.filePathToMessages;
      invariant(filePathToMessages != null);
      invariant(filePathToMessages.size === 1);
      const firstValue = filePathToMessages.values().next();
      invariant(firstValue.value != null);
      const fileMessages: Array<FileDiagnosticMessage> = firstValue.value;
      updates.push(fileMessages);
    });
    diagnosticProvider.invalidations.subscribe(invalidation => invalidations.push(invalidation));

  });

  describe('diagnostic updates', () => {
    it('should emit an update with a diagnostic message for each uncovered region', () => {
      isEnabledStream.next(true);
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(1);
      expect(updates[0].length).toBe(1);
      expect(updates[0][0]).toEqual({
        scope: 'file',
        providerName: 'Type Coverage',
        type: 'Warning',
        filePath: 'foo',
        range: sampleResult.uncoveredRanges[0],
        text: 'Not covered by the type system',
      });
      expect(invalidations.length).toBe(0);
    });

    it('should not emit an update before it has been switched on', () => {
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(0);
    });

    it('should not emit an update after it has been switched off', () => {
      isEnabledStream.next(true);
      isEnabledStream.next(false);
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(0);
    });
  });

  describe('diagnostic invalidations', () => {
    const invalidateAll = {scope: 'all'};

    it('should emit an invalidation when toggled off', () => {
      isEnabledStream.next(true);
      expect(invalidations).toEqual([]);
      isEnabledStream.next(false);
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when no text editor has focus', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'not-text-editor'});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when there is no provider for the current editor', () => {
      isEnabledStream.next(true);
      // Cheat the type system a bit -- if necessary we can fill in all the fields in the future
      inputResults.next(({kind: 'no-provider'}: any));
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when the provider throws an error', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'provider-error'});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation on a pane change', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'pane-change'});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should not emit an invalidation on edit or save', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'edit'});
      inputResults.next({kind: 'save'});
      expect(invalidations).toEqual([]);
    });
  });
});
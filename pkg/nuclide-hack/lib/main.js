'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {
  BusySignalProviderBase as BusySignalProviderBaseType,
} from '../../nuclide-busy-signal';
import type {NuclideEvaluationExpressionProvider} from '../../nuclide-debugger-interfaces/service';
import type {DefinitionProvider} from '../../nuclide-definition-service';
import type {Provider} from '../../nuclide-quick-open/lib/types';

import {HackSymbolProvider} from './HackSymbolProvider';
import {CompositeDisposable} from 'atom';
import {HACK_GRAMMARS} from '../../nuclide-hack-common';
import {HackDefinitionProvider} from './HackDefinitionProvider';
import AutocompleteProvider from './AutocompleteProvider';
import FindReferencesProvider from './FindReferencesProvider';
import TypeHintProvider from './TypeHintProvider';
import {HackEvaluationExpressionProvider} from './HackEvaluationExpressionProvider';
import {
  HackDiagnosticsProvider,
  ObservableDiagnosticProvider,
} from './HackDiagnosticsProvider';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {BusySignalProviderBase} from '../../nuclide-busy-signal';
import CodeFormatProvider from './CodeFormatProvider';
import {hackLanguageService, resetHackLanguageService} from './HackLanguage';
import {getConfig} from './config';


const HACK_GRAMMARS_STRING = HACK_GRAMMARS.join(', ');
const PACKAGE_NAME = 'nuclide-hack';

let subscriptions: ?CompositeDisposable = null;
let hackDiagnosticsProvider;
let observableDiagnosticsProvider;
let busySignalProvider;
let definitionProvider: ?DefinitionProvider = null;

const diagnosticService = 'nuclide-diagnostics-provider';

export function activate() {
  subscriptions = new CompositeDisposable();
  hackLanguageService.activate();

  if (getConfig().useIdeConnection) {
    subscriptions.add(
      atom.packages.serviceHub.provide(
        diagnosticService, '0.2.0', provideObservableDiagnostics()));
  } else {
    subscriptions.add(
      atom.packages.serviceHub.provide(
        diagnosticService, '0.1.0', provideDiagnostics()));
  }
}

/** Provider for autocomplete service. */
export function createAutocompleteProvider(): atom$AutocompleteProvider {
  const autocompleteProvider = new AutocompleteProvider();

  return {
    selector: HACK_GRAMMARS.map(grammar => '.' + grammar).join(', '),
    inclusionPriority: 1,
    // The context-sensitive hack autocompletions are more relevant than snippets.
    suggestionPriority: 3,
    excludeLowerPriority: false,

    getSuggestions(
      request: atom$AutocompleteRequest,
    ): Promise<?Array<atom$AutocompleteSuggestion>> {
      return autocompleteProvider.getAutocompleteSuggestions(request);
    },
  };
}

/** Provider for code format service. */
export function createCodeFormatProvider(): any {
  const codeFormatProvider = new CodeFormatProvider();

  return {
    selector: HACK_GRAMMARS_STRING,
    inclusionPriority: 1,

    formatCode(editor: atom$TextEditor, range: atom$Range): Promise<string> {
      return codeFormatProvider.formatCode(editor, range);
    },
  };
}

export function createFindReferencesProvider(): any {
  return FindReferencesProvider;
}

export function createTypeHintProvider(): any {
  const typeHintProvider = new TypeHintProvider();

  return {
    selector: HACK_GRAMMARS_STRING,
    inclusionPriority: 1,
    providerName: PACKAGE_NAME,

    typeHint(editor: atom$TextEditor, position: atom$Point): Promise<?TypeHint> {
      return typeHintProvider.typeHint(editor, position);
    },
  };
}

export function createEvaluationExpressionProvider(): NuclideEvaluationExpressionProvider {
  const evaluationExpressionProvider = new HackEvaluationExpressionProvider();
  const getEvaluationExpression =
    evaluationExpressionProvider.getEvaluationExpression.bind(evaluationExpressionProvider);
  return {
    selector: HACK_GRAMMARS_STRING,
    name: PACKAGE_NAME,
    getEvaluationExpression,
  };
}

function provideDiagnostics() {
  if (!hackDiagnosticsProvider) {
    const busyProvider = provideBusySignal();
    hackDiagnosticsProvider = new HackDiagnosticsProvider(false, busyProvider);
  }
  return hackDiagnosticsProvider;
}

function provideObservableDiagnostics() {
  if (observableDiagnosticsProvider == null) {
    observableDiagnosticsProvider = new ObservableDiagnosticProvider();
  }
  return observableDiagnosticsProvider;
}

export function deactivate(): void {
  if (subscriptions) {
    subscriptions.dispose();
    subscriptions = null;
  }
  if (hackDiagnosticsProvider) {
    hackDiagnosticsProvider.dispose();
    hackDiagnosticsProvider = null;
  }
  resetHackLanguageService();
}

function provideBusySignal(): BusySignalProviderBaseType {
  if (busySignalProvider == null) {
    busySignalProvider = new BusySignalProviderBase();
  }
  return busySignalProvider;
}

export function provideDefinitions(): DefinitionProvider {
  if (definitionProvider == null) {
    definitionProvider = new HackDefinitionProvider();
  }
  return definitionProvider;
}

export function registerQuickOpenProvider(): Provider {
  return HackSymbolProvider;
}

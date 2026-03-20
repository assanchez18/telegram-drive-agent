import { describe, it, expect } from 'vitest';
import {
  isStart,
  isHelp,
  isCancel,
  isAddProperty,
  isListProperties,
  isDeleteProperty,
  isArchive,
  isArchiveProperty,
  isListArchived,
  isUnarchiveProperty,
  isBulk,
  isBulkDone,
  isSelfTest,
  isGoogleLogin,
  isVersion,
  isStatus,
  defaultCommands,
  bulkModeCommands,
  knownCommands,
  getHelpMessage,
  getArchiveMenuMessage,
} from '../src/domain/commands.js';

function msg(text) {
  return { text };
}

describe('command matchers', () => {
  it('isStart', () => {
    expect(isStart(msg('/start'))).toBe(true);
    expect(isStart(msg('/help'))).toBe(false);
  });

  it('isHelp', () => {
    expect(isHelp(msg('/help'))).toBe(true);
    expect(isHelp(msg('/start'))).toBe(false);
  });

  it('isCancel', () => {
    expect(isCancel(msg('/cancel'))).toBe(true);
    expect(isCancel(msg('/start'))).toBe(false);
  });

  it('isAddProperty', () => {
    expect(isAddProperty(msg('/add_property'))).toBe(true);
    expect(isAddProperty(msg('/other'))).toBe(false);
  });

  it('isListProperties', () => {
    expect(isListProperties(msg('/list_properties'))).toBe(true);
    expect(isListProperties(msg('/other'))).toBe(false);
  });

  it('isDeleteProperty', () => {
    expect(isDeleteProperty(msg('/delete_property'))).toBe(true);
    expect(isDeleteProperty(msg('/other'))).toBe(false);
  });

  it('isArchive', () => {
    expect(isArchive(msg('/archive'))).toBe(true);
    expect(isArchive(msg('/archive_property'))).toBe(false);
  });

  it('isArchiveProperty', () => {
    expect(isArchiveProperty(msg('/archive_property'))).toBe(true);
    expect(isArchiveProperty(msg('/other'))).toBe(false);
  });

  it('isListArchived', () => {
    expect(isListArchived(msg('/list_archived'))).toBe(true);
    expect(isListArchived(msg('/other'))).toBe(false);
  });

  it('isUnarchiveProperty', () => {
    expect(isUnarchiveProperty(msg('/unarchive_property'))).toBe(true);
    expect(isUnarchiveProperty(msg('/other'))).toBe(false);
  });

  it('isBulk', () => {
    expect(isBulk(msg('/bulk'))).toBe(true);
    expect(isBulk(msg('/bulk_done'))).toBe(false);
  });

  it('isBulkDone', () => {
    expect(isBulkDone(msg('/bulk_done'))).toBe(true);
    expect(isBulkDone(msg('/bulk'))).toBe(false);
  });

  it('isSelfTest', () => {
    expect(isSelfTest(msg('/self_test'))).toBe(true);
    expect(isSelfTest(msg('/other'))).toBe(false);
  });

  it('isGoogleLogin', () => {
    expect(isGoogleLogin(msg('/google_login'))).toBe(true);
    expect(isGoogleLogin(msg('/other'))).toBe(false);
  });

  it('isVersion', () => {
    expect(isVersion(msg('/version'))).toBe(true);
    expect(isVersion(msg('/other'))).toBe(false);
  });

  it('isStatus', () => {
    expect(isStatus(msg('/status'))).toBe(true);
    expect(isStatus(msg('/other'))).toBe(false);
  });

  it('handles msg with no text', () => {
    expect(isStart({})).toBe(undefined);
    expect(isArchive({})).toBe(false);
    expect(isBulk({})).toBe(false);
  });
});

describe('command lists', () => {
  it('defaultCommands contiene los comandos principales', () => {
    const names = defaultCommands.map(c => c.command);
    expect(names).toContain('start');
    expect(names).toContain('add_property');
    expect(names).toContain('archive');
    expect(names).toContain('self_test');
  });

  it('bulkModeCommands contiene bulk_done y cancel', () => {
    const names = bulkModeCommands.map(c => c.command);
    expect(names).toContain('bulk_done');
    expect(names).toContain('cancel');
  });

  it('knownCommands contiene todos los comandos con /', () => {
    expect(knownCommands.every(c => c.startsWith('/'))).toBe(true);
    expect(knownCommands).toContain('/start');
    expect(knownCommands).toContain('/bulk_done');
  });
});

describe('getHelpMessage', () => {
  it('incluye comandos principales', () => {
    const msg = getHelpMessage();
    expect(msg).toContain('/add_property');
    expect(msg).toContain('/bulk');
    expect(msg).toContain('/self_test');
  });
});

describe('getArchiveMenuMessage', () => {
  it('incluye comandos de archivo', () => {
    const msg = getArchiveMenuMessage();
    expect(msg).toContain('/archive_property');
    expect(msg).toContain('/list_archived');
    expect(msg).toContain('/unarchive_property');
  });
});

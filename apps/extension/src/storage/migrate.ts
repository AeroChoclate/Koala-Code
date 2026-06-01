import * as vscode from 'vscode';
import { ExtensionSettings, ExtensionSettingsSchema } from '@koala/shared';
import { StorageService } from './service';

export async function migrateLegacySettings(
  context: vscode.ExtensionContext,
  storage: StorageService
) {
  await storage.ensureReady();
  const diskSettings = await storage.loadConfig();
  if (Object.keys(diskSettings).length > 0) {
    return;
  }

  const raw = context.globalState.get('koalaSettings') || {};
  let settings: ExtensionSettings;
  try {
    settings = ExtensionSettingsSchema.parse(raw);
  } catch {
    settings = ExtensionSettingsSchema.parse({});
  }

  await storage.saveConfig(settings);
  await context.globalState.update('koalaSettings', undefined);
}

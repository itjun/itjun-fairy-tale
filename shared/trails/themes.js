import { sweetKitchen } from './sweet-kitchen.js';

export const fieldThemes = [sweetKitchen];

export function fieldStages(worlds) {
  return fieldThemes.map(theme => ({ ...worlds.find(s => s.themeId === theme.theme), id: theme.id,
    structure: 'field-journey', chapterName: theme.title, subtitle: theme.subtitle, story: theme.story }));
}

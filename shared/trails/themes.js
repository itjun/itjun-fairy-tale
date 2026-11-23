import { sweetKitchen } from './sweet-kitchen.js';

import { tideLighthouse } from './tide-lighthouse.js';

import { kiteMeadow } from './kite-meadow.js';

import { toyRailway } from './toy-railway.js';

export const fieldThemes = [sweetKitchen, tideLighthouse, kiteMeadow, toyRailway];

export function fieldStages(worlds) {
  return fieldThemes.map(theme => ({ ...worlds.find(s => s.themeId === theme.theme), id: theme.id,
    structure: 'field-journey', chapterName: theme.title, subtitle: theme.subtitle, story: theme.story }));
}

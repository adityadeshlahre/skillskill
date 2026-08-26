import * as os from 'os';
import * as path from 'path';
import { SkillProfile } from './interfaces/config.interface.js';

export const DEFAULT_PROFILES: SkillProfile[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    paths: ['~/.agents/skills', '~/.config/opencode/skills', '~/.cache/opencode/packages'],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    paths: ['~/.claude/skills', '~/.claude/commands'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    paths: ['~/.cursor/rules'],
  },
];

export const PROTECTED_PATHS: string[] = [
  os.homedir(),
  path.join(os.homedir(), '.zshrc'),
  path.join(os.homedir(), '.bashrc'),
  path.join(os.homedir(), '.profile'),
  path.join(os.homedir(), '.zprofile'),
];

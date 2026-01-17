#!/usr/bin/env node

const lines = [
  'Funnel Plan Intake (answer in order)',
  '',
  '1) Goal (final outcome)',
  '2) Panel design',
  '   - Entry channel(s)',
  '   - Registration step',
  '   - Segments (new/existing/paid/etc.)',
  '   - Branching rules (if/then)',
  '   - Routes per branch (what to send)',
  '   - Final node (purchase/participation)',
  '3) Phases (names in order)',
  '4) Schedule',
  '   - Display period (start/end)',
  '   - Sales period (start/end + days)',
  '   - Segment order (top to bottom)',
  '   - Key deliveries per day/segment',
  '',
  'Reply with the answers in order. I will summarize, confirm, then apply.'
];

process.stdout.write(lines.join('\n') + '\n');

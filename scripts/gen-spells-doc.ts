// Generates SPELLS.md from the spell registry, so the documentation can never
// drift from the implementation. Run: npm run docs:spells
import { writeFileSync } from 'node:fs';
import { CATEGORY_ORDER, REMOVED_SPELLS, SKIPPED_PROPOSALS, SPELL_LIST, SPELLS } from '../src/engine';

const lines: string[] = [];
lines.push('# Mana Chess – spellek');
lines.push('');
lines.push('> Ez a fájl generált (`npm run docs:spells`), a forrása a `src/engine/spells/definitions.ts`.');
lines.push('');
lines.push('Időtartamok: „e kör végéig” = a varázsló saját körének végéig; „az ellenfél következő körének végéig” = a varázsló következő körének kezdetéig.');
lines.push('');
lines.push(`## Mind a(z) ${SPELL_LIST.length} spell`);
lines.push('');
lines.push('| # | Spell | Mana | Kategória | Célpont | Hatás (megvalósítva) |');
lines.push('|---|-------|------|-----------|---------|----------------------|');
for (const s of SPELL_LIST) {
  const target = s.steps.length ? s.steps.map((x) => x.prompt).join(' → ') : '—';
  const cost =
    s.costLabel ??
    (s.change?.originalCost
      ? `${s.manaCost} (eredetileg ${s.change.originalCost})`
      : s.added?.proposalCost !== undefined
        ? `${s.manaCost} (javaslat: ${s.added.proposalCost})`
        : String(s.manaCost));
  const mark = (s.added ? ' 🆕' : '') + (s.change ? ' ✱' : '');
  const awake = s.awakened ? ` **${s.awakened.name}:** ${s.awakened.description}` : '';
  lines.push(`| ${s.number} | ${s.icon} **${s.name}**${mark} | ${cost} | ${s.category} | ${target} | ${s.description}${awake} |`);
}
lines.push('');
lines.push('🆕 = új spell, ✱ = módosítva (a specifikációhoz vagy a bevezetéséhez képest – lásd lent az indoklással).');
lines.push('');
lines.push('## Új és kivett spellek');
lines.push('');
for (const s of SPELL_LIST.filter((x) => x.added)) {
  const a = s.added!;
  const proposal = a.proposal ? ` Javaslat: „${a.proposal}”${a.proposalCost !== undefined ? ` (${a.proposalCost} mana)` : ''}.` : '';
  const awake = s.awakened ? ` **${s.awakened.name}:** ${s.awakened.description}` : '';
  lines.push(`- 🆕 **${s.icon} ${s.name}** (${s.costLabel ?? s.manaCost} mana): ${s.description}${awake} *${a.reason}*${proposal}`);
}
for (const r of REMOVED_SPELLS) {
  lines.push(`- ✖ **${r.number}. ${r.name}**: ${r.reason} Mentett paklikban automatikusan erre cserélődik: ${SPELLS[r.replacement as keyof typeof SPELLS].name}.`);
}
lines.push('');
lines.push('## Kihagyott javaslatok');
lines.push('');
lines.push('Az 50 spellből álló javaslatlistából ezek nem kerültek be (a többi – módosított áron vagy pontosítva – a fenti táblázatban van):');
lines.push('');
for (const p of SKIPPED_PROPOSALS) lines.push(`- ${p.number}. **${p.name}** (${p.cost} mana): ${p.reason}`);
lines.push('');
lines.push('## Módosított spellek és indoklás');
lines.push('');
lines.push('A feladat kérése szerint: ha egy spell eredeti formájában technikailag vagy játékmenet szempontjából problémás volt, minimálisan átalakítottam, hogy a játék stabil és játszható maradjon. Ide kerültek a kérésre végzett balansz-módosítások és az egyensúly-teszt ([BALANCE.md](BALANCE.md)) alapján hangolt lapok is.');
lines.push('');
for (const s of SPELL_LIST.filter((x) => x.change)) {
  lines.push(`### ${s.number}. ${s.icon} ${s.name}${s.change!.originalCost ? ` (${s.change!.originalCost} → ${s.manaCost} mana)` : ''}`);
  lines.push('');
  lines.push(`- **Eredeti:** ${s.change!.original}`);
  lines.push(`- **Most:** ${s.description}`);
  lines.push(`- **Miért:** ${s.change!.reason}`);
  lines.push('');
}
lines.push('## Kategóriák');
lines.push('');
for (const c of CATEGORY_ORDER) {
  const list = SPELL_LIST.filter((s) => s.category === c);
  lines.push(`- **${c}** (${list.length}): ${list.map((s) => s.name).join(', ')}`);
}
lines.push('');
writeFileSync(new URL('../SPELLS.md', import.meta.url), lines.join('\n'));
console.log('SPELLS.md written');

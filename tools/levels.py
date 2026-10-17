# Builds azhar/js/levels.js from a library of hand-made rooms (10 cells x 3 rows each).
# A level is a grid of room names; '~name' is the room mirrored left-right, '.' is solid rock,
# 'name:x' fills the room's plate/gate placeholders with plate letter x (a,b,d,e,f -> gate 1..5).
# Run: python tools/levels.py
import json, os
GATE = {'a': '1', 'b': '2', 'd': '3', 'e': '4', 'f': '5'}
R = {
  # bottom-row corridors (enter left on row 2, leave right on row 2)
  'start2':  ['##########', '##########', '#P__t_____'],
  'hall2':   ['##########', '#  ___t   ', '__t_______'],
  'low2':    ['##########', '##########', '_t_____t__'],
  'spk2':    ['##########', '##########', '__^__^^___'],
  'blade2':  ['##########', '##########', '__t_c__c__'],
  'blades3': ['##########', '##########', '_c__c__c__'],
  'pot2':    ['##########', '#####  ###', '__t__h____'],
  'potH':    ['##########', '####  ####', '__t_H_____'],
  'sword2':  ['##########', '##########', '__t__S____'],
  'guard2':  ['##########', '#   _t_   ', '______G___'],
  'twoGuards': ['##########', '#   _t_   ', '___h___G__'],  # one guard at a time, as in the original
  'gate2':   ['##########', '##########', '_{p}___t_{g}__'],
  'plate2':  ['##########', '##########', '___{p}______'],
  'gateo2':  ['##########', '##########', '__t___{g}___'],
  'exit2':   ['##########', '##########', '__X___t_E#'],
  'exitQ':   ['##########', '##########', '___t____Q#'],
  # bottom room-row only: gaps here drop into the abyss
  'pitB2':   ['##########', '##########', '___  _____'],
  'chasm':   ['##########', '##########', '__  ___  _'],
  # middle-row corridors (row 1), with a lower floor beneath
  'hall1':   ['##########', '__t_____t_', '##########'],
  'gap1':    ['##########', '___  ___t_', '#__^^^^__#'],
  'gap1s':   ['##########', '____ ____t', '#___~____#'],
  'loose1':  ['##########', '__~~~~~~__', '#__t_____#'],
  'blade1':  ['##########', '_t_c__c_t_', '##########'],
  'spk1':    ['##########', '__^_^^__t_', '##########'],
  # changing rows
  'up21':    ['##########', '#    _t___', '_t___#####'],
  'dn12':    ['##########', '___t_    #', '#####___t_'],
  # going down a room-row: drop2's hole (col 7) lands in land_L or land_R7 below
  'drop2':   ['##########', '##########', '__t____ ##'],
  'looseDrop': ['##########', '##########', '__t____~##'],
  'land_L':  ['##### __##', '#### _####', '__t______#'],
  'land_R7': ['#######_ #', '########_ ', '#########_'],
  # going up a room-row: climb from rise_bot (col 7) into rise_top / rise_topL above
  'rise_bot':  ['##### __##', '#  ___ ###', '______####'],
  'rise_top':  ['##########', '##########', '####### __'],
  'rise_topL': ['##########', '##########', '_______ ##'],
  '.':       ['##########'] * 3,
}


def room(spec):
  name, _, p = spec.partition(':')
  mirror = name.startswith('~')
  name = name.lstrip('~')
  rows = [r.replace('{p}', p or 'a').replace('{g}', GATE[p or 'a']) for r in R[name]]
  for r in rows:
    assert len(r) == 10, (name, r)
  return [r[::-1] for r in rows] if mirror else rows


def level(grid):
  out = []
  for line in grid:
    rooms = [room(s) for s in line.split()]
    for k in range(3):
      out.append(''.join(rm[k] for rm in rooms))
  assert len(set(map(len, out))) == 1, grid
  return out


LEVELS = [
  dict(name='Τα Μπουντρούμια', theme='dungeon', skill=0.25, guardHp=3, guardColor=0,
       intro='Βρες το σπαθί. Στο τέλος, πάτα την πλάκα για να ανοίξει η έξοδος.', grid=[
    'start2 low2 hall2 sword2 hall2 drop2',
    '~drop2 ~pot2 ~hall2 ~guard2 ~low2 land_L',
    '~land_L spk2 up21 gap1s dn12 exit2']),
  dict(name='Ο Διάδρομος των Λεπίδων', theme='dungeon', skill=0.35, guardHp=3, guardColor=1,
       intro='Η πλάκα κρατά την πύλη ανοιχτή λίγα δευτερόλεπτα. Τρέξε!', grid=[
    'start2 blade2 plate2:a gateo2:a low2 drop2',
    '~drop2 ~guard2 ~blade2 ~pot2 ~hall2 land_L',
    '~land_L up21 blade1 gap1 dn12 exit2']),
  dict(name='Ο Πύργος της Φρουράς', theme='dungeon', skill=0.42, guardHp=3, guardColor=2,
       intro='Η έξοδος είναι ψηλά. Σκαρφάλωσε.', grid=[
    '~rise_topL low2 spk2 plate2:a gateo2:a exit2',
    '~rise_bot ~hall2 ~blade2 ~pot2 ~guard2 rise_topL',
    'start2 hall2 spk2 guard2 low2 rise_bot']),
  dict(name='Οι Κρύπτες', theme='dungeon', skill=0.48, guardHp=4, guardColor=0,
       intro='Τα πατώματα που τρέμουν δεν κρατάνε πολύ.', grid=[
    'start2 up21 loose1 gap1 dn12 looseDrop',
    '~drop2 ~guard2 ~spk2 ~potH ~blade2 land_L',
    '~land_L chasm pot2 guard2 pitB2 exit2']),
  dict(name='Η Αυλή του Παλατιού', theme='palace', skill=0.52, guardHp=4, guardColor=1,
       intro='Βγήκες από τα μπουντρούμια. Οι φρουροί εδώ είναι πιο πολλοί.', grid=[
    'start2 hall2 guard2 up21 gap1 dn12 drop2',
    '~drop2 ~blade2 ~gate2:a ~guard2 ~pot2 ~spk2 land_L',
    '~land_L plate2:b gateo2:b blade2 twoGuards pot2 exit2']),
  dict(name='Οι Κήποι με τις Παγίδες', theme='palace', skill=0.56, guardHp=4, guardColor=2,
       intro='Ανέβα στις ταράτσες των κήπων.', grid=[
    '~rise_topL hall2 plate2:a gateo2:a guard2 spk2 exit2',
    '~rise_bot ~guard2 ~dn12 ~loose1 ~gap1 ~up21 rise_topL',
    'start2 spk2 blade2 guard2 hall2 pot2 rise_bot']),
  dict(name='Η Βιβλιοθήκη του Βεζίρη', theme='palace', skill=0.6, guardHp=4, guardColor=3,
       intro='Ανάμεσα στα βιβλία κρύβονται λεπίδες.', grid=[
    'start2 blades3 blade2 spk2 guard2 low2 drop2',
    '~drop2 ~guard2 ~dn12 ~gap1 ~blade1 ~up21 land_L',
    '~land_L chasm plate2:a gateo2:a potH twoGuards exit2']),
  dict(name='Τα Λαγούμια', theme='dungeon', skill=0.64, guardHp=5, guardColor=0,
       intro='Βαθιά κάτω από το παλάτι. Κάθε βήμα μετράει.', grid=[
    'start2 spk2 guard2 blade2 pot2 drop2',
    '~drop2 ~gate2:a ~guard2 ~spk2 ~hall2 land_L',
    '~land_L up21 loose1 gap1 dn12 drop2',
    '~exit2 ~chasm ~twoGuards ~pot2 ~pitB2 land_L']),
  dict(name='Η Φυλακή των Σκιών', theme='dungeon', skill=0.68, guardHp=5, guardColor=1,
       intro='Από το πιο σκοτεινό κελί, προς τα πάνω.', grid=[
    '~exit2 ~blade2 ~pot2 ~guard2 ~spk2 rise_topL',
    '~rise_topL plate2:a gateo2:a twoGuards hall2 rise_bot',
    '~rise_bot ~guard2 ~dn12 ~gap1 ~up21 rise_topL',
    'start2 blade2 guard2 spk2 pot2 rise_bot']),
  dict(name='Τα Δωμάτια των Φρουρών', theme='palace', skill=0.72, guardHp=5, guardColor=2,
       intro='Οι καλύτεροι φρουροί του Βεζίρη σε περιμένουν.', grid=[
    'start2 guard2 blade2 twoGuards pot2 drop2',
    '~drop2 ~twoGuards ~dn12 ~blade1 ~up21 land_L',
    '~land_L gate2:a guard2 spk2 potH drop2',
    '~exit2 ~twoGuards ~chasm ~blade2 ~guard2 land_L']),
  dict(name='Η Σκάλα προς τον Πύργο', theme='palace', skill=0.76, guardHp=5, guardColor=3,
       intro='Ο πύργος της πριγκίπισσας είναι από πάνω σου.', grid=[
    '~exit2 ~guard2 ~spk2 ~blade2 ~pot2 rise_topL',
    '~rise_topL guard2 plate2:a gateo2:a twoGuards rise_bot',
    '~rise_bot ~dn12 ~blade1 ~gap1 ~up21 rise_topL',
    'start2 spk2 twoGuards blade2 pot2 rise_bot']),
  dict(name='Το Παλάτι του Βεζίρη', theme='palace', skill=0.8, guardHp=5, guardColor=3,
       intro='Η πριγκίπισσα σε περιμένει. Ο αρχιφύλακας όχι.', grid=[
    'start2 twoGuards up21 gap1 dn12 drop2',
    '~drop2 ~guard2 ~gate2:a ~blade2 ~pot2 land_L',
    '~land_L up21 blade1 loose1 dn12 drop2',
    '~exitQ ~twoGuards ~chasm ~guard2 ~blades3 land_L']),
]

here = os.path.dirname(os.path.abspath(__file__))
lines = ['// Generated by tools/levels.py from its room library. Edit there, then run: python tools/levels.py',
         '// Each room is 10 cells x 3 rows; see the tile legend in data.js.', 'const LEVELS = [']
for lv in LEVELS:
  m = level(lv['grid'])
  meta = {k: v for k, v in lv.items() if k != 'grid'}
  lines.append('  ' + json.dumps(meta, ensure_ascii=False)[:-1] + ', "map": [')
  lines += ['    ' + json.dumps(r) + ',' for r in m]
  lines.append('  ] },')
lines.append('];')
with open(os.path.join(here, '..', 'azhar', 'js', 'levels.js'), 'w', encoding='utf8') as f:
  f.write('\n'.join(lines) + '\n')
print('wrote', len(LEVELS), 'levels:', ', '.join('%dx%d' % (len(level(l['grid'])[0]) // 10, len(level(l['grid'])) // 3) for l in LEVELS))

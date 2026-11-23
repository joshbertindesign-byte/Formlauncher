# 0.44.5: the pilot's terminal forms, compact with panels; the shift and hour forms keep the on-screen keyboard up.
import sys
p = sys.argv[1]; s = open(p).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old[:80], s.count(old))
    s = s.replace(old, new)

# ---- start shift
rep("""  title: 'Start shift', sites: ALL, launchable: true, saveLabel: 'Start the shift', savedMessage: 'Shift started',""",
"""  title: 'Start shift', sites: ALL, launchable: true, saveLabel: 'Start the shift', savedMessage: 'Shift started',
  density: 'compact', keyboard: 'always',""")
rep("""    layout: [
      ['noNeeds 12'], ['need 12'], ['needFrom 12'], ['material 12'], ['otherProfile 6', 'otherColor 6'], ['runsWhat 12'],
      ['partialInfo 8', 'adopt 4'],
      ['weatherStrip 3', 'wsStrands 3', 'wsColor 3', 'wsSize 3'],
      { section: 'Saved with the run', fold: 'closed',""", """    layout: [
      { panels: [
        { panel: 'What it makes', rows: [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['otherProfile 7', 'otherColor 5'], ['runsWhat 12']] },
        { panel: 'Material and extras', width: 'half', rows: [['material 12'], ['partialInfo 12'], ['adopt 12'], ['weatherStrip 12'], ['wsStrands 4', 'wsColor 4', 'wsSize 4']] },
      ] },
      { section: 'Saved with the run', fold: 'closed',""")
rep("""  layout: [['me 4', 'crew 4', 'hours 4'], ['startAt 6', 'endAt 6'], ['lineList 12'], ['caliper 6', 'shiftId 6'], ['lineRunsBtn 12']],""",
"""  layout: [
    { panels: [
      { panel: 'Your shift', width: 'half', rows: [['me 6', 'crew 6'], ['startAt 6', 'endAt 6'], ['hours 12'], ['shiftId 12']] },
      { panel: 'Your lines', rows: [['lineList 12'], ['caliper 12'], ['lineRunsBtn 12']] },
    ] },
  ],""")

# ---- hourly
rep("""  title: 'Hourly check', sites: ALL, launchable: true, refresh: 1, savedMessage: 'Check saved',""",
"""  title: 'Hourly check', sites: ALL, launchable: true, refresh: 1, savedMessage: 'Check saved',
  density: 'compact', keyboard: 'always',""")
rep("""  layout: [
    ['yourLines 12'], ['everyLine 4'],
    ['run 6', 'runs 6'], ['slot 4', 'upToDate 8'],
    ['lineStatus 12'],
    ['lengthAct 4', 'nominal 4', 'lengthDev 4'],
    ['surface 4', 'colorCheck 4', 'gaugeCheck 4'],
    ['speed 4', 'lastSpeed 4', 'weight 4'],
    ['checkNote 12'],
    { section: 'Saved with the check', fold: 'closed', rows: [['surfaceBad 4', 'colorBad 4', 'by 4'], ['cpLine 3', 'cpPart 3', 'cpProfile 3', 'cpColor 3']] },
    ['history 12'],
  ],""", """  layout: [
    { panels: [
      { width: 'narrow', rows: [['everyLine 12'], ['yourLines 12'],
        { section: 'Saved with the check', fold: 'closed', rows: [['surfaceBad 6', 'colorBad 6'], ['by 6', 'cpLine 6'], ['cpPart 6', 'cpProfile 6'], ['cpColor 6']] }] },
      { rows: [['run 6', 'slot 6'], ['runs 6', 'upToDate 6'], ['lineStatus 12'], ['lengthAct 4', 'nominal 4', 'lengthDev 4'],
        ['surface 4', 'colorCheck 4', 'gaugeCheck 4'], ['speed 4', 'lastSpeed 4', 'weight 4'], ['checkNote 12']] },
    ] },
    { section: 'This run\'s checks', fold: 'closed', rows: [['history 12']] },
  ],""")

# ---- rack (scanned: the terminal's own keyboard setting)
rep("""  title: 'Rack', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save rack', savedMessage: 'Rack saved',""",
"""  title: 'Rack', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save rack', savedMessage: 'Rack saved',
  density: 'compact',""")
rep("""  layout: [
    ['yourLines 12'], ['everyLine 4'],
    ['run 6', 'runs 6'],
    ['rackId 6', 'pieces 6'],
    ['partialNote 12'], ['needProgress 12'], ['notes 12'],
    { section: 'Saved with the rack',""", """  layout: [
    { panels: [
      { width: 'narrow', rows: [['everyLine 12'], ['yourLines 12']] },
      { panel: 'This rack', rows: [['run 6', 'runs 6'], ['rackId 6', 'pieces 6'], ['needProgress 12'], ['partialNote 12'], ['notes 12']] },
    ] },
    { section: 'Saved with the rack',""")

# ---- changeover
rep("""  title: 'Changeover', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save the changeover', savedMessage: 'Changeover saved',""",
"""  title: 'Changeover', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save the changeover', savedMessage: 'Changeover saved',
  density: 'compact', keyboard: 'always',""")
rep("""  layout: [
    ['yourLines 12'], ['everyLine 4'],
    ['run 6', 'runs 6'],
    { section: 'Ending this run', rows: [['partialLeft 4', 'location 4', 'scrapFt 4']] },
    ['next 12'],
    { section: 'The next run', when: NEXT, rows: [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['material 12'], ['otherProfile 6', 'otherColor 6'], ['runsWhat 12'], ['partialInfo 8', 'adopt 4'], ['weatherStrip 3', 'wsStrands 3', 'wsColor 3', 'wsSize 3']] },""",
"""  layout: [
    { panels: [
      { panel: 'Ending this run', rows: [['everyLine 12'], ['yourLines 12'], ['run 6', 'runs 6'], ['partialLeft 6', 'scrapFt 6'], ['location 12'], ['next 12']] },
      { panel: 'The next run', width: 'half', when: NEXT, rows: [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['otherProfile 7', 'otherColor 5'], ['runsWhat 12'], ['material 12'],
        ['partialInfo 12'], ['adopt 12'], ['weatherStrip 12'], ['wsStrands 4', 'wsColor 4', 'wsSize 4']] },
    ] },""")

# ---- end shift
rep("""  title: 'End shift', sites: ALL, launchable: true, saveLabel: 'End the shift', savedMessage: 'Shift ended',""",
"""  title: 'End shift', sites: ALL, launchable: true, saveLabel: 'End the shift', savedMessage: 'Shift ended',
  density: 'compact', keyboard: 'always',""")
rep("""    { name: 'scrap', control: 'table', label: 'Scrap on each line', rowsFrom: 'mine', rowLabel: 'Run', empty: 'No runs of this shift are still open',""",
"""    { name: 'scrap', control: 'table', label: 'Scrap on each line', rowsFrom: 'mine', rowLabel: 'Run', empty: 'No runs of this shift are still open', pinHeader: true, visibleRows: 6,""")
rep("""  layout: [['shiftPick 12'], ['scrap 12'], ['endNow 4', 'endReason 4', 'caliperOff 4'], ['missed 6', 'endedAt 6']],""",
"""  layout: [
    { panels: [
      { panel: 'Ending the shift', width: 'third', rows: [['shiftPick 12'], ['endNow 12'], ['endReason 12'], ['caliperOff 12'], ['missed 6', 'endedAt 6']] },
      { rows: [['scrap 12']] },
    ] },
  ],""")

# ---- needs board (read only)
rep("""  title: 'Needs board', sites: ALL, launchable: true, refresh: 1, buttons: [],""",
"""  title: 'Needs board', sites: ALL, launchable: true, refresh: 1, buttons: [], density: 'compact',""")
open(p, 'w').write(s)
print('relaid out')

import os
import tempfile
import json
from jar_data import JarData


def test_init_and_set_and_totals():
    j = JarData()
    j.init_users(['travis', 'david'])
    j.set_entry('2025-10-05', 'travis', 'done')
    j.set_entry('2025-10-05', 'david', 'missed')
    totals = j.totals()
    assert totals['travis'] == 0
    assert totals['david'] == 1


def test_close_day_marks_missing():
    j = JarData()
    j.init_users(['travis', 'david', 'cara'])
    j.set_entry('2025-10-06', 'travis', 'done')
    changed = j.close_day('2025-10-06')
    assert changed == 2
    totals = j.totals()
    assert totals['travis'] == 0
    assert totals['david'] == 1
    assert totals['cara'] == 1


def test_save_and_load(tmp_path):
    p = tmp_path / 'db.json'
    j = JarData()
    j.init_users(['a'])
    j.set_entry('2025-10-07', 'a', 'missed')
    j.save(str(p))
    j2 = JarData.load(str(p))
    assert j2.users() == ['a']
    assert j2.totals()['a'] == 1

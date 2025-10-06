"""Data storage and operations for the LeetCode Jar tracker."""
import json
import os
from typing import Dict, List

DEFAULT_DB_PATH = ".jar_data.json"


class JarData:
    def __init__(self):
        # users: list of usernames
        self._users: List[str] = []
        # entries: dict date -> user -> status ('done'|'missed')
        self.entries = {}

    @classmethod
    def load(cls, path=DEFAULT_DB_PATH):
        j = cls()
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            j._users = data.get('users', [])
            j.entries = data.get('entries', {})
        return j

    def save(self, path=DEFAULT_DB_PATH):
        data = {'users': self._users, 'entries': self.entries}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def init_users(self, users: List[str]):
        self._users = users

    def users(self) -> List[str]:
        return list(self._users)

    def set_entry(self, date: str, user: str, status: str):
        if user not in self._users:
            raise KeyError(f"Unknown user: {user}")
        self.entries.setdefault(date, {})[user] = status

    def get_entries_for_date(self, date: str) -> Dict[str, str]:
        return dict(self.entries.get(date, {}))

    def close_day(self, date: str) -> int:
        """Mark missing users as 'missed' for date and return number changed."""
        changed = 0
        day = self.entries.setdefault(date, {})
        for u in self._users:
            if u not in day:
                day[u] = 'missed'
                changed += 1
        return changed

    def history(self) -> List[Dict]:
        out = []
        for d in sorted(self.entries.keys()):
            for u, s in self.entries[d].items():
                out.append({'date': d, 'user': u, 'status': s})
        return out

    def totals(self) -> Dict[str, int]:
        totals = {u: 0 for u in self._users}
        for d, day in self.entries.items():
            for u, s in day.items():
                if s == 'missed':
                    totals[u] += 1
        return totals

    def export_csv(self, path: str):
        import csv
        rows = self.history()
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['date', 'user', 'status'])
            for r in rows:
                w.writerow([r['date'], r['user'], r['status']])

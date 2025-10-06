#!/usr/bin/env python3
"""LeetCode Jar tracker CLI

Usage: python jar.py <command> [options]

Commands:
    init --users travis david    Initialize the jar with users
  mark USER done|missed     Mark today's status for USER
  mark USER done|missed --date YYYY-MM-DD  Mark for specific date
  close-day [--date DATE]   Close a date: set missing entries to missed
  status [--date DATE]      Show status for a date (defaults to today)
  totals                    Show totals per user and jar balance
  history [--user USER]     Show history of entries
  export-csv PATH           Export history CSV

This app stores data in .jar_data.json in the current directory.
"""
import argparse
import datetime
import sys
from jar_data import JarData, DEFAULT_DB_PATH


def parse_args():
    p = argparse.ArgumentParser(description="LeetCode Jar tracker CLI")
    sub = p.add_subparsers(dest="cmd")

    p_init = sub.add_parser("init", help="Initialize jar data with users")
    p_init.add_argument("--users", nargs='+', required=True, help="List of users")

    p_mark = sub.add_parser("mark", help="Mark a user's day done or missed")
    p_mark.add_argument("user", help="User name")
    p_mark.add_argument("status", choices=["done", "missed"], help="Status")
    p_mark.add_argument("--date", help="Date YYYY-MM-DD (default today)")

    p_close = sub.add_parser("close-day", help="Close a date: mark missing as missed and update totals")
    p_close.add_argument("--date", help="Date YYYY-MM-DD (default today)")

    p_status = sub.add_parser("status", help="Show status for a date")
    p_status.add_argument("--date", help="Date YYYY-MM-DD (default today)")

    sub.add_parser("totals", help="Show totals per user and jar balance")

    p_hist = sub.add_parser("history", help="Show history of entries")
    p_hist.add_argument("--user", help="Filter by user")

    p_export = sub.add_parser("export-csv", help="Export history CSV")
    p_export.add_argument("path", help="Destination CSV file path")

    return p.parse_args()


def main():
    args = parse_args()
    jar = JarData.load(DEFAULT_DB_PATH)

    if args.cmd == "init":
        jar.init_users(args.users)
        jar.save(DEFAULT_DB_PATH)
        print(f"Initialized users: {', '.join(args.users)}")
        return

    if args.cmd == "mark":
        date = args.date or datetime.date.today().isoformat()
        jar.set_entry(date, args.user, args.status)
        jar.save(DEFAULT_DB_PATH)
        print(f"Marked {args.user} as {args.status} on {date}")
        return

    if args.cmd == "close-day":
        date = args.date or datetime.date.today().isoformat()
        changed = jar.close_day(date)
        jar.save(DEFAULT_DB_PATH)
        print(f"Closed {date}. Applied {changed} missing -> missed updates.")
        return

    if args.cmd == "status":
        date = args.date or datetime.date.today().isoformat()
        entries = jar.get_entries_for_date(date)
        print(f"Status for {date}:")
        for u in jar.users():
            print(f"  {u}: {entries.get(u, 'none')}")
        return

    if args.cmd == "totals":
        totals = jar.totals()
        print("Totals (missed days -> $1 each):")
        for u, v in totals.items():
            print(f"  {u}: ${v}")
        print(f"Jar balance: ${sum(totals.values())}")
        return

    if args.cmd == "history":
        rows = jar.history()
        if args.user:
            rows = [r for r in rows if r['user'] == args.user]
        for r in rows:
            print(f"{r['date']}  {r['user']}: {r['status']}")
        return

    if args.cmd == "export-csv":
        jar.export_csv(args.path)
        print(f"Exported CSV to {args.path}")
        return

    print("No command provided. Use --help.")


if __name__ == '__main__':
    main()

#!/usr/bin/env python3

import json
import os
import sys

FILE_PATH = "/lib/mozilla/native-messaging-hosts/pywalfox.json"
NEW_EXTENSION = "re-fox@adior.org"


def main():
    if not os.path.exists(FILE_PATH):
        print(f"[ERROR] File not found: {FILE_PATH}")
        sys.exit(1)

    try:
        with open(FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON: {e}")
        sys.exit(1)

    if "allowed_extensions" not in data:
        print("[ERROR] Missing 'allowed_extensions' field")
        sys.exit(1)

    if NEW_EXTENSION not in data["allowed_extensions"]:
        data["allowed_extensions"].append(NEW_EXTENSION)
        print(f"[INFO] Added {NEW_EXTENSION}")
    else:
        print(f"[INFO] {NEW_EXTENSION} already present")

    try:
        with open(FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    except PermissionError:
        print("[ERROR] Permission denied. Try running with sudo.")
        sys.exit(1)

    print("[SUCCESS] pywalfox native messaging host updated")


if __name__ == "__main__":
    main()

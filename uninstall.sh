#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}[INFO] Starting Re:fox Uninstallation...${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}[INFO] Root privileges required. Elevating with sudo...${NC}"
    exec sudo bash "$0" "$@"
fi

ACTUAL_USER="${SUDO_USER:-$USER}"

remove_refox_tag() {
    local file="$1"
    if [ -f "$file" ]; then
        python3 -c "
import json, sys
path = sys.argv[1]
try:
    with open(path, 'r') as f:
        data = json.load(f)
    if 'allowed_extensions' in data and 're-fox@adior.org' in data['allowed_extensions']:
        data['allowed_extensions'].remove('re-fox@adior.org')
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        print(f'Removed re-fox@adior.org from {path}')
except Exception as e:
    print(f'Error updating {path}: {e}')
" "$file"
    fi
}

SYSTEM_MANIFEST="/lib/mozilla/native-messaging-hosts/pywalfox.json"
USER_HOME=$(eval echo "~$ACTUAL_USER")
USER_MANIFEST="$USER_HOME/.mozilla/native-messaging-hosts/pywalfox.json"

remove_refox_tag "$SYSTEM_MANIFEST"
remove_refox_tag "$USER_MANIFEST"

read -r -p "Do you also want to remove the python-pywalfox package and full manifest? [y/N]: " answer
case "$answer" in
    [Yy]*)
        if [ -f "$SYSTEM_MANIFEST" ]; then
            rm -f "$SYSTEM_MANIFEST"
            echo -e "${GREEN}[INFO] Removed system manifest: $SYSTEM_MANIFEST${NC}"
        fi
        if [ -f "$USER_MANIFEST" ]; then
            rm -f "$USER_MANIFEST"
            echo -e "${GREEN}[INFO] Removed user manifest: $USER_MANIFEST${NC}"
        fi

        if pacman -Qi python-pywalfox &>/dev/null; then
            echo -e "${BLUE}[INFO] Removing python-pywalfox package...${NC}"
            pacman -Rns --noconfirm python-pywalfox || true
            echo -e "${GREEN}[INFO] Uninstalled python-pywalfox package.${NC}"
        fi
        ;;
esac

echo -e "${GREEN}[SUCCESS] Re:fox uninstalled successfully.${NC}"

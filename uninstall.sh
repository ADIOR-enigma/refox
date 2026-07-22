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
USER_HOME=$(eval echo "~$ACTUAL_USER")
REFOX_DIR="$USER_HOME/.config/refox"
CONFIG_FILE="$REFOX_DIR/install.conf"

detect_browser_name() {
    local path_lower="${1,,}"
    if [[ "$path_lower" =~ /(zen|\.zen)/ || "$path_lower" =~ zen ]]; then
        echo "Zen Browser"
    elif [[ "$path_lower" =~ /(librewolf|\.librewolf)/ || "$path_lower" =~ librewolf ]]; then
        echo "LibreWolf"
    elif [[ "$path_lower" =~ /(floorp|\.floorp)/ || "$path_lower" =~ floorp ]]; then
        echo "Floorp"
    elif [[ "$path_lower" =~ /(mercury|\.mercury)/ || "$path_lower" =~ mercury ]]; then
        echo "Mercury"
    elif [[ "$path_lower" =~ /(mozilla|firefox|\.mozilla)/ || "$path_lower" =~ firefox ]]; then
        echo "Firefox"
    else
        echo "Browser"
    fi
}

GECKO_PROFILES=()
SETUP_ZEN="false"
ZEN_PROFILE_DIR=""
ZEN_APP_DIR=""

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo -e "${GREEN}[INFO] Loaded configuration from $CONFIG_FILE${NC}"
fi

remove_refox_tag() {
    local file="$1"
    if [ -f "$file" ]; then
        python3 -c "
import json, sys
path = sys.argv[1]
try:
    with open(path, 'r') as f:
        data = json.load(f)
    if 'allowed_extensions' in data:
        modified = False
        for tag in ['re-fox@adior.org', 'refox@adior.org']:
            if tag in data['allowed_extensions']:
                data['allowed_extensions'].remove(tag)
                modified = True
        if modified:
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
                f.write('\n')
            print(f'Removed Re:fox extensions from {path}')
except Exception as e:
    print(f'Error updating {path}: {e}')
" "$file"
    fi
}

SYSTEM_MANIFEST="/lib/mozilla/native-messaging-hosts/pywalfox.json"
remove_refox_tag "$SYSTEM_MANIFEST"

# Profile Templates Cleanup
read -r -p "Do you want to remove Re:fox templates/scripts from configured browser profiles? [Y/n]: " rm_profiles
case "$rm_profiles" in
[Nn]*)
    echo -e "${YELLOW}[INFO] Preserving profile templates.${NC}"
    ;;
*)
    for prof in "${GECKO_PROFILES[@]}"; do
        if [ -d "$prof/chrome" ]; then
            b_name=$(detect_browser_name "$prof")
            echo -e "${BLUE}[INFO] Removing Re:fox templates from $b_name profile ($prof/chrome) ...${NC}"
            rm -f "$prof/chrome/userChrome.css" "$prof/chrome/userContent.css"
            rm -rf "$prof/chrome/websites"
            rmdir --ignore-fail-on-non-empty "$prof/chrome" 2>/dev/null || true
            echo -e "${GREEN}[INFO] Cleaned templates in $b_name profile ($prof).${NC}"
        fi
    done

    if [ "$SETUP_ZEN" = "true" ] || [ -n "$ZEN_PROFILE_DIR" ]; then
        if [ -n "$ZEN_PROFILE_DIR" ] && [ -d "$ZEN_PROFILE_DIR/chrome" ]; then
            echo -e "${BLUE}[INFO] Removing Re:fox scripts & templates from Zen Browser profile ($ZEN_PROFILE_DIR/chrome) ...${NC}"
            rm -f "$ZEN_PROFILE_DIR/chrome/userContent.css"
            rm -rf "$ZEN_PROFILE_DIR/chrome/websites"
            rm -f "$ZEN_PROFILE_DIR/chrome/JS/refox_accent_watch.uc.js"
            rmdir --ignore-fail-on-non-empty "$ZEN_PROFILE_DIR/chrome/JS" 2>/dev/null || true
            for uf in boot.sys.mjs chrome.manifest fs.sys.mjs module_loader.mjs uc_api.sys.mjs utils.sys.mjs; do
                rm -f "$ZEN_PROFILE_DIR/chrome/utils/$uf"
            done
            rmdir --ignore-fail-on-non-empty "$ZEN_PROFILE_DIR/chrome/utils" 2>/dev/null || true
            rmdir --ignore-fail-on-non-empty "$ZEN_PROFILE_DIR/chrome" 2>/dev/null || true
            echo -e "${GREEN}[INFO] Cleaned Zen Browser profile scripts ($ZEN_PROFILE_DIR).${NC}"
        fi

        if [ -n "$ZEN_APP_DIR" ] && [ -d "$ZEN_APP_DIR" ]; then
            echo -e "${BLUE}[INFO] Removing config.js and preferences from Zen Browser application directory ($ZEN_APP_DIR) ...${NC}"
            rm -f "$ZEN_APP_DIR/config.js" "$ZEN_APP_DIR/defaults/pref/config-prefs.js"
            rmdir --ignore-fail-on-non-empty "$ZEN_APP_DIR/defaults/pref" 2>/dev/null || true
            rmdir --ignore-fail-on-non-empty "$ZEN_APP_DIR/defaults" 2>/dev/null || true
            echo -e "${GREEN}[INFO] Cleaned Zen Browser application directory scripts ($ZEN_APP_DIR).${NC}"
        fi
    fi
    ;;
esac

read -r -p "Do you also want to remove the python-pywalfox package and full pywalfox manifests? [y/N]: " answer
case "$answer" in
[Yy]*)
    if [ -f "$SYSTEM_MANIFEST" ]; then
        rm -f "$SYSTEM_MANIFEST"
        echo -e "${GREEN}[INFO] Removed system manifest: $SYSTEM_MANIFEST${NC}"
    fi
    for browser_dir in "$USER_HOME/.config/mozilla" "$USER_HOME/.mozilla" "$USER_HOME/.config/librewolf" "$USER_HOME/.librewolf" "$USER_HOME/.config/zen" "$USER_HOME/.zen" "$USER_HOME/.config/floorp" "$USER_HOME/.floorp"; do
        rm -f "$browser_dir/native-messaging-hosts/pywalfox.json" 2>/dev/null || true
    done

    if pacman -Qi python-pywalfox &>/dev/null; then
        echo -e "${BLUE}[INFO] Removing python-pywalfox package...${NC}"
        pacman -Rns --noconfirm python-pywalfox || true
        echo -e "${GREEN}[INFO] Uninstalled python-pywalfox package.${NC}"
    fi
    ;;
esac

read -r -p "Do you want to remove the Re:fox configuration and repository ($REFOX_DIR)? [y/N]: " rm_repo
case "$rm_repo" in
[Yy]*)
    if [ -d "$REFOX_DIR" ]; then
        rm -rf "$REFOX_DIR"
        echo -e "${GREEN}[INFO] Removed repository and configuration: $REFOX_DIR${NC}"
    fi
    ;;
esac

echo -e "${GREEN}[SUCCESS] Re:fox uninstalled successfully.${NC}"

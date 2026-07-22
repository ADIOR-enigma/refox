#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}[INFO] Starting Re:fox Setup & Native Messaging Host Installation...${NC}"

# Detect actual user and home before elevation
if [ "$EUID" -ne 0 ]; then
    ACTUAL_USER="$USER"
    USER_HOME="$HOME"
else
    ACTUAL_USER="${SUDO_USER:-$USER}"
    USER_HOME=$(eval echo "~$ACTUAL_USER")
fi

REFOX_CONFIG_DIR="$USER_HOME/.config/refox"
mkdir -p "$REFOX_CONFIG_DIR"
if [ "$ACTUAL_USER" != "root" ] && [ -n "$ACTUAL_USER" ]; then
    chown "$ACTUAL_USER" "$REFOX_CONFIG_DIR" 2>/dev/null || true
fi

# Determine if running from a local repository containing template/ and zen/
SCRIPT_PATH=$(realpath "$0" 2>/dev/null || echo "")
if [ -n "$SCRIPT_PATH" ] && [ -f "$SCRIPT_PATH" ] && [ -d "$(dirname "$SCRIPT_PATH")/template" ]; then
    REPO_DIR="$(dirname "$SCRIPT_PATH")"
else
    # Running via pipe (curl | bash) or outside repository -> ensure canonical repo exists
    REPO_DIR="$REFOX_CONFIG_DIR"
    if [ ! -d "$REPO_DIR/.git" ]; then
        echo -e "${BLUE}[INFO] Cloning Re:fox repository into canonical directory ($REPO_DIR)...${NC}"
        if ! command -v git &>/dev/null; then
            echo -e "${YELLOW}[WARNING] git not found. Elevating to install git...${NC}"
            if [ "$EUID" -ne 0 ]; then
                exec sudo bash "$0" "$@"
            else
                if command -v pacman &>/dev/null; then
                    pacman -Sy --needed --noconfirm git
                fi
            fi
        fi
        if [ "$EUID" -eq 0 ] && [ "$ACTUAL_USER" != "root" ]; then
            sudo -u "$ACTUAL_USER" git clone https://github.com/ADIOR-enigma/refox.git "$REPO_DIR"
        else
            git clone https://github.com/ADIOR-enigma/refox.git "$REPO_DIR"
        fi
    else
        echo -e "${BLUE}[INFO] Pulling latest changes in canonical directory ($REPO_DIR)...${NC}"
        if [ "$EUID" -eq 0 ] && [ "$ACTUAL_USER" != "root" ]; then
            sudo -u "$ACTUAL_USER" git -C "$REPO_DIR" pull --ff-only || sudo -u "$ACTUAL_USER" git -C "$REPO_DIR" pull
        else
            git -C "$REPO_DIR" pull --ff-only || git -C "$REPO_DIR" pull
        fi
    fi
    SCRIPT_PATH="$REPO_DIR/install.sh"
fi

# Elevate privileges if needed
if [ ! -f /etc/arch-release ] && ! command -v pacman &>/dev/null; then
    echo -e "${YELLOW}[WARNING] This installer is optimized for Arch Linux and Arch-based distributions.${NC}"
fi

if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}[INFO] Root privileges required. Elevating with sudo...${NC}"
    exec sudo bash "$SCRIPT_PATH" "$@"
fi

cd "$REPO_DIR"

if [ "$ACTUAL_USER" = "root" ]; then
    echo -e "${YELLOW}[WARNING] Running as root without SUDO_USER. AUR building may require a regular user account.${NC}"
fi

# Ensure standard input connects to user terminal for prompts (critical if launched via pipe or sudo)
if [ -r /dev/tty ]; then
    exec </dev/tty
fi

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

# Configuration Management
CONFIG_FILE="$REFOX_CONFIG_DIR/install.conf"
GECKO_PROFILES=()
SETUP_ZEN="false"
ZEN_PROFILE_DIR=""
ZEN_APP_DIR=""

RUN_PROMPT=true
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo -e "${GREEN}[INFO] Loaded saved configuration from $CONFIG_FILE${NC}"
    if [ ${#GECKO_PROFILES[@]} -gt 0 ] || ([ "$SETUP_ZEN" = "true" ] && [ -n "$ZEN_PROFILE_DIR" ]); then
        echo -e "${BLUE}Configured browser profiles:${NC}"
        for p in "${GECKO_PROFILES[@]}"; do
            b_name=$(detect_browser_name "$p")
            echo "  - $b_name: $p"
        done
        if [ "$SETUP_ZEN" = "true" ] && [ -n "$ZEN_PROFILE_DIR" ]; then
            echo "  - Zen Browser: $ZEN_PROFILE_DIR"
            if [ -n "$ZEN_APP_DIR" ]; then
                echo "  - Zen Application Directory: $ZEN_APP_DIR"
            fi
        fi
    fi

    read -r -p "Do you want to add another browser profile or modify configuration? [y/N]: " modify_conf
    if [[ ! "$modify_conf" =~ ^[Yy] ]]; then
        RUN_PROMPT=false
        echo -e "${BLUE}[INFO] Proceeding to update Re:fox across configured profiles...${NC}"
    fi
fi

if [ "$RUN_PROMPT" = true ]; then
    echo -e "\n${BLUE}======================================================${NC}"
    echo -e "${BLUE}           Profile & Browser Configuration            ${NC}"
    echo -e "${BLUE}======================================================${NC}"

    while true; do
        while true; do
            if [ ${#GECKO_PROFILES[@]} -eq 0 ] && [ -z "$ZEN_PROFILE_DIR" ]; then
                read -r -e -p "Enter Profile Directory path from your browser's about:support page (Firefox, LibreWolf, Floorp, Mercury, Zen): " pasted_path
            else
                read -r -e -p "Enter additional Profile Directory path from about:support: " pasted_path
            fi
            pasted_path="${pasted_path/#\~/$USER_HOME}"
            if [ -z "$pasted_path" ]; then
                echo -e "${RED}[ERROR] Directory path cannot be empty. Please enter a valid Profile Directory path.${NC}"
            elif [ ! -d "$pasted_path" ]; then
                echo -e "${RED}[ERROR] Directory does not exist or is invalid: $pasted_path. Please enter a valid Profile Directory path.${NC}"
            else
                b_name=$(detect_browser_name "$pasted_path")
                if [ "$b_name" = "Zen Browser" ]; then
                    ZEN_PROFILE_DIR="$pasted_path"
                    SETUP_ZEN="true"
                    echo -e "${GREEN}[SUCCESS] Detected and set Zen Browser profile: $pasted_path${NC}"
                else
                    exists=false
                    for p in "${GECKO_PROFILES[@]}"; do
                        if [ "$p" = "$pasted_path" ]; then
                            exists=true
                            break
                        fi
                    done
                    if [ "$exists" = false ]; then
                        GECKO_PROFILES+=("$pasted_path")
                        echo -e "${GREEN}[SUCCESS] Added $b_name profile: $pasted_path${NC}"
                    else
                        echo -e "${YELLOW}[INFO] $b_name profile already added: $pasted_path${NC}"
                    fi
                fi
                break
            fi
        done

        read -r -p "Do you want to add another browser profile directory? [y/N]: " add_more
        if [[ ! "$add_more" =~ ^[Yy] ]]; then
            break
        fi
    done

    # --- Zen Browser Setup ---
    if [ "$SETUP_ZEN" = "true" ] && [ -n "$ZEN_PROFILE_DIR" ] && [ -d "$ZEN_PROFILE_DIR" ]; then
        echo -e "\n${GREEN}[INFO] Using detected Zen Browser profile for Matugen UI & page theming: $ZEN_PROFILE_DIR${NC}"
    else
        echo -e "\n${YELLOW}Do you want to set up Matugen UI & page theming for Zen Browser? [y/N]: ${NC}"
        read -r -p "> " zen_ans
        if [[ "$zen_ans" =~ ^[Yy] ]]; then
            SETUP_ZEN="true"
            while true; do
                read -r -e -p "Paste Zen Profile Directory from Zen's about:support page: " pasted_zen_p
                pasted_zen_p="${pasted_zen_p/#\~/$USER_HOME}"
                if [ -z "$pasted_zen_p" ]; then
                    echo -e "${RED}[ERROR] Zen Profile Directory path cannot be empty. Please enter a valid path.${NC}"
                elif [ -d "$pasted_zen_p" ]; then
                    ZEN_PROFILE_DIR="$pasted_zen_p"
                    echo -e "${GREEN}[SUCCESS] Set Zen Browser profile: $ZEN_PROFILE_DIR${NC}"
                    break
                else
                    echo -e "${RED}[ERROR] Directory does not exist or is invalid: $pasted_zen_p. Please enter a valid path.${NC}"
                fi
            done
        else
            SETUP_ZEN="false"
        fi
    fi

    if [ "$SETUP_ZEN" = "true" ]; then
        if [ -n "$ZEN_APP_DIR" ]; then
            while true; do
                read -r -e -p "Enter Zen Application Directory (where zen-bin resides) [$ZEN_APP_DIR]: " new_zen_a
                if [ -z "$new_zen_a" ]; then
                    break
                fi
                new_zen_a="${new_zen_a/#\~/$USER_HOME}"
                if [ -d "$new_zen_a" ] && ([ -f "$new_zen_a/zen-bin" ] || [ -f "$new_zen_a/zen" ] || [ -d "$new_zen_a" ]); then
                    ZEN_APP_DIR="$new_zen_a"
                    echo -e "${GREEN}[SUCCESS] Set Zen application directory: $ZEN_APP_DIR${NC}"
                    break
                else
                    echo -e "${RED}[ERROR] Directory or binary not found in: $new_zen_a. Please enter a valid directory.${NC}"
                fi
            done
        else
            while true; do
                read -r -e -p "Enter Zen Application Directory (where zen-bin resides, e.g. /opt/zen-browser-bin): " pasted_zen_a
                pasted_zen_a="${pasted_zen_a/#\~/$USER_HOME}"
                if [ -z "$pasted_zen_a" ]; then
                    if [ -f "/opt/zen-browser-bin/zen-bin" ] || [ -f "/opt/zen-browser-bin/zen" ] || [ -d "/opt/zen-browser-bin" ]; then
                        ZEN_APP_DIR="/opt/zen-browser-bin"
                        echo -e "${GREEN}[SUCCESS] Auto-detected Zen application directory: $ZEN_APP_DIR${NC}"
                        break
                    elif [ -f "/opt/zen-browser/zen-bin" ] || [ -f "/opt/zen-browser/zen" ] || [ -d "/opt/zen-browser" ]; then
                        ZEN_APP_DIR="/opt/zen-browser"
                        echo -e "${GREEN}[SUCCESS] Auto-detected Zen application directory: $ZEN_APP_DIR${NC}"
                        break
                    elif [ -f "/usr/lib/zen-browser/zen-bin" ] || [ -f "/usr/lib/zen-browser/zen" ] || [ -d "/usr/lib/zen-browser" ]; then
                        ZEN_APP_DIR="/usr/lib/zen-browser"
                        echo -e "${GREEN}[SUCCESS] Auto-detected Zen application directory: $ZEN_APP_DIR${NC}"
                        break
                    else
                        echo -e "${RED}[ERROR] Zen Application Directory cannot be empty and auto-detection failed. Please enter the directory where zen-bin resides.${NC}"
                    fi
                elif [ -d "$pasted_zen_a" ] && ([ -f "$pasted_zen_a/zen-bin" ] || [ -f "$pasted_zen_a/zen" ] || [ -d "$pasted_zen_a" ]); then
                    ZEN_APP_DIR="$pasted_zen_a"
                    echo -e "${GREEN}[SUCCESS] Set Zen application directory: $ZEN_APP_DIR${NC}"
                    break
                else
                    echo -e "${RED}[ERROR] Directory or binary not found in: $pasted_zen_a. Please enter a valid directory where zen-bin resides.${NC}"
                fi
            done
        fi
    fi

    # Save settings to config file
    echo -e "${BLUE}[INFO] Saving configuration to $CONFIG_FILE...${NC}"
    cat <<EOF >"$CONFIG_FILE"
GECKO_PROFILES=(
EOF
    for p in "${GECKO_PROFILES[@]}"; do
        echo "  \"$p\"" >>"$CONFIG_FILE"
    done
    cat <<EOF >>"$CONFIG_FILE"
)
SETUP_ZEN="$SETUP_ZEN"
ZEN_PROFILE_DIR="$ZEN_PROFILE_DIR"
ZEN_APP_DIR="$ZEN_APP_DIR"
EOF
    if [ "$ACTUAL_USER" != "root" ] && [ -n "$ACTUAL_USER" ]; then
        chown "$ACTUAL_USER" "$CONFIG_FILE" 2>/dev/null || true
    fi
    chmod 644 "$CONFIG_FILE"
fi

# --- AUR Package & Native Host Setup ---
install_aur_package() {
    local PKG="python-pywalfox"

    if pacman -Qi "$PKG" &>/dev/null; then
        echo -e "${GREEN}[INFO] $PKG is already installed.${NC}"
        return 0
    fi

    echo -e "${BLUE}[INFO] Installing $PKG from AUR...${NC}"

    if command -v paru &>/dev/null && [ "$ACTUAL_USER" != "root" ]; then
        sudo -u "$ACTUAL_USER" paru -S --noconfirm "$PKG"
    elif command -v yay &>/dev/null && [ "$ACTUAL_USER" != "root" ]; then
        sudo -u "$ACTUAL_USER" yay -S --noconfirm "$PKG"
    else
        echo -e "${BLUE}[INFO] No AUR helper found. Building $PKG with makepkg...${NC}"
        pacman -S --needed --noconfirm base-devel git python

        BUILD_DIR=$(mktemp -d /tmp/pywalfox-aur.XXXXXX)
        chown "$ACTUAL_USER" "$BUILD_DIR"

        sudo -u "$ACTUAL_USER" git clone https://aur.archlinux.org/python-pywalfox.git "$BUILD_DIR/python-pywalfox"
        cd "$BUILD_DIR/python-pywalfox"
        sudo -u "$ACTUAL_USER" makepkg -si --noconfirm
        cd "$REPO_DIR"
        rm -rf "$BUILD_DIR"
    fi
}

install_aur_package

MAIN_SH_PATH=$(python3 -c "import pywalfox, os; print(os.path.join(os.path.dirname(pywalfox.__file__), 'bin', 'main.sh'))")

update_manifest() {
    local target_file="$1"
    mkdir -p "$(dirname "$target_file")"
    cat <<EOF >"$target_file"
{
  "name": "pywalfox",
  "description": "Automatically theme your browser using the colors generated by Pywal",
  "path": "$MAIN_SH_PATH",
  "type": "stdio",
  "allowed_extensions": [
    "pywalfox@frewacom.org",
    "re-fox@adior.org"
  ]
}
EOF
    chmod 644 "$target_file"
}

# System native messaging manifest
MANIFEST_SYSTEM="/lib/mozilla/native-messaging-hosts/pywalfox.json"
update_manifest "$MANIFEST_SYSTEM"

ACTION_VERB_ING="Installing"
ACTION_VERB_ED="Installed"
ACTION_PREP="into"
ACTION_TITLE="setup and native messaging host installation"
if [ "$RUN_PROMPT" = false ]; then
    ACTION_VERB_ING="Updating"
    ACTION_VERB_ED="Updated"
    ACTION_PREP="in"
    ACTION_TITLE="update"
fi

# --- Firefox / Gecko Profiles Setup ---
for prof in "${GECKO_PROFILES[@]}"; do
    if [ -d "$prof" ]; then
        b_name=$(detect_browser_name "$prof")
        echo -e "${BLUE}[INFO] ${ACTION_VERB_ING} Re:fox templates ${ACTION_PREP} $b_name profile ($prof/chrome) ...${NC}"
        mkdir -p "$prof/chrome"
        cp -r "$REPO_DIR/template/userChrome.css" "$REPO_DIR/template/userContent.css" "$REPO_DIR/template/websites" "$prof/chrome/"
        if [ "$ACTUAL_USER" != "root" ] && [ -n "$ACTUAL_USER" ]; then
            chown -R "$ACTUAL_USER" "$prof/chrome" 2>/dev/null || true
        fi
        echo -e "${GREEN}[SUCCESS] ${ACTION_VERB_ED} Re:fox templates ${ACTION_PREP} $b_name profile ($prof/chrome)${NC}"
    else
        echo -e "${YELLOW}[WARNING] Configured profile directory not found: $prof${NC}"
    fi
done

# --- Zen Browser Setup ---
if [ "$SETUP_ZEN" = "true" ]; then
    if [ -n "$ZEN_PROFILE_DIR" ] && [ -d "$ZEN_PROFILE_DIR" ]; then
        echo -e "${BLUE}[INFO] ${ACTION_VERB_ING} Zen Browser userChromeJS & templates ${ACTION_PREP} profile ($ZEN_PROFILE_DIR/chrome) ...${NC}"
        mkdir -p "$ZEN_PROFILE_DIR/chrome"
        cp -r "$REPO_DIR/zen/chrome/JS" "$REPO_DIR/zen/chrome/utils" "$REPO_DIR/template/userContent.css" "$REPO_DIR/template/websites" "$ZEN_PROFILE_DIR/chrome/"

        # Dynamically replace hardcoded colors.json path in refox_accent_watch.uc.js
        WATCH_FILE="$ZEN_PROFILE_DIR/chrome/JS/refox_accent_watch.uc.js"
        if [ -f "$WATCH_FILE" ]; then
            CACHE_PATH="$USER_HOME/.cache/wal/colors.json"
            sed -i "s|const PATH = .*|const PATH = \"$CACHE_PATH\";|g" "$WATCH_FILE"
            echo -e "${GREEN}[INFO] Updated watch script target to $CACHE_PATH${NC}"
        fi
        if [ "$ACTUAL_USER" != "root" ] && [ -n "$ACTUAL_USER" ]; then
            chown -R "$ACTUAL_USER" "$ZEN_PROFILE_DIR/chrome" 2>/dev/null || true
        fi
        echo -e "${GREEN}[SUCCESS] ${ACTION_VERB_ED} Zen Browser chrome scripts ${ACTION_PREP} profile ($ZEN_PROFILE_DIR/chrome)${NC}"
    else
        echo -e "${YELLOW}[WARNING] Zen Browser profile directory not found: $ZEN_PROFILE_DIR${NC}"
    fi

    if [ -n "$ZEN_APP_DIR" ] && [ -d "$ZEN_APP_DIR" ]; then
        echo -e "${BLUE}[INFO] ${ACTION_VERB_ING} Zen program configuration ${ACTION_PREP} application directory: $ZEN_APP_DIR ...${NC}"
        cp "$REPO_DIR/zen/program/config.js" "$ZEN_APP_DIR/"
        mkdir -p "$ZEN_APP_DIR/defaults/pref"
        cp "$REPO_DIR/zen/program/defaults/pref/config-prefs.js" "$ZEN_APP_DIR/defaults/pref/"
        chmod 644 "$ZEN_APP_DIR/config.js" "$ZEN_APP_DIR/defaults/pref/config-prefs.js"
        echo -e "${GREEN}[SUCCESS] ${ACTION_VERB_ED} config.js and defaults/pref/config-prefs.js ${ACTION_PREP} $ZEN_APP_DIR${NC}"
    else
        echo -e "${YELLOW}[WARNING] Zen application directory not found: $ZEN_APP_DIR${NC}"
    fi
fi

echo -e "\n${GREEN}[SUCCESS] Re:fox ${ACTION_TITLE} completed successfully!${NC}"
echo -e "${GREEN}[SUCCESS] Supported browsers: Firefox, LibreWolf, Floorp, Mercury, Zen.${NC}"
echo -e "${YELLOW}[NOTE] Remember to open about:config in your browser and verify toolkit.legacyUserProfileCustomizations.stylesheets is set to true!${NC}"

> [!Note]
> The Website templates are in WIP.
<h1 align="center">
  <a name="logo"><img src="images/refox_animated_logo.gif" alt="Pywalfox icon" width="150"></a>
  <br>
  Re:fox
</h1>
<h4 align="center">🎨 Dynamic theming of Firefox 🦊 using your Native color scheme generator, [A fork of Pywalfox]</h4>


## What's new?

Pywalfox does a great job theming the Firefox UI ~ toolbar, tabs, the works. But the moment you load a website, you're back to whatever colors that site decided on. This fork fixes that by pushing your Color palette into websites too, via CSS custom properties injected at page load. And since it hot reloads, running pywalfox update updates every open tab on the spot ~ no explicit tab refresh needed.

https://github.com/user-attachments/assets/a50f4e77-ea29-446f-a3f9-175781ec95bc


## ⏺ Installation

1. Get the latest add-on from [Releases Page](https://github.com/ADIOR-enigma/refox/releases/tag/v3.0.6) and pin it to toolbar for a surprise.
   > - It does autoupdate 😅
1. Install the [native messaging application](https://github.com/Frewacom/pywalfox-native) ([PyPI](https://pypi.org/project/pywalfox/)) using your preferred method, with e.g. `pip` or `pipx`:
   ```sh
   pipx install pywalfox
   ```
   > Don't have `pipx`? Install it first, then re-run the command above:
   > - **Arch Linux:** `pacman -S python-pipx` 
   > - **Ubuntu:** `apt install pipx`
   > - **macOS:** `brew install pipx`
   > - **Windows:** `winget install Python.Python.3.14`, then `pip install pywalfox` instead
1. Run `pywalfox install` in your terminal.
   - Firefox forks (e.g. LibreWolf) require [extra arguments](#firefox-forks). Flatpaks require [extra steps](#flatpaks).
1. Run `sudo python setup.py` to make this extension compatible with pywalfox-native.
   > - It is currently tested on Arch/CachyOS only, u guys can post PRs/Issues if it works on ur system.
1. Restart Firefox.
1. Generate a theme with [Matugen](https://github.com/InioX/matugen) or equivalent. You may refer to there guide.
1. Click the Refox icon in the Firefox UI and then "Fetch Native colors". 
<!--(or use the [AUR package](https://aur.archlinux.org/packages/python-pywalfox/))-->

This should apply a theme with your Native colors!

> [!NOTE]
> If you have problems: please review the Troubleshooting section below before opening a Github issue.

## ⏺ Usage

### Update the theme through your terminal
Run `pywalfox update` in your terminal to trigger an update of the browser theme.
This command can integrate Refox into e.g. system theming scripts, and is functionally equivalent to clicking "Fetch Native colors" in the add-on settings GUI (accessible from your toolbar).

### Customization
The add-on settings GUI comes with extensive customization options divided into the following sections:

<details>
<summary>
<b>
💧 Palette (click for details)
</b>
</summary>

<table><tr><td>

The palette in the "Palette" section is used to temporarily customize one or more colors from the Native color generated palette.
You can use one of the generated colors, or choose any color from a colorwheel.

> **Warning** <br>
> Changes to the palette will be reset when you click "Fetch Native colors" and when you run `pywalfox update`.

</td></tr></table>

</details>

<details>
<summary>
<b>
📝 Palette template (click for details)
</b>
</summary>

<table><tr><td>

If you want your palette customizations to be persistent (unlike the regular palette) you must save your current palette as a *palette template*:

1. Click "Fetch Native colors" in the add-on settings GUI or run `pywalfox update`
2. Customize the colors to your liking in the "Palette" section
   - ❗ *Colors from outside the Native color generated palette (i.e. from the colorwheel) cannot be used in a template*.
3. Click "Load from current" in the "Palette template" section below.
   - ❗ *The colors can also be set directly in the "Palette template" section using Native color indices.*
4. Click "Save palette"

Your custom palette will now be applied whenever you update the browser theme.

</td></tr></table>

</details>

<details>
<summary>
<b>
🗂 ️Theme template (click for details)
</b>
</summary>

<table><tr><td>

The theme template assigns colors (from your palette template) to different browser elements.

To create a palette template, go through the items in the "Theme template" section and assign a color to each item.
The colors are identified by their names as seen in the "Palette template" section.

</td></tr></table>

</details>


### Theme modes
There are three different theme modes: "Dark" (❨), "Light" (𖤓) and "Auto" (👁)️. Selecting "Auto" will automatically switch between the other two modes based on a time interval found in the "General" section of the add-on settings GUI.

> [!Note]
> The dark and light modes have *separate* theme and palette templates. You will always modifiy the template for the currently selected mode.

### Further theming with the included userChrome.css and userContent.css in Firefox

Some browser elements (e.g. the context menus) are not available through the [Theme API](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/theme). Refox includes two custom CSS stylesheets (for Firefox) which apply your theme to some of these browser elements.

<table><tr><td>
Before you enable the custom CSS sheets in the add-on settings GUI you must navigate to <code>about:config</code> and set <code>toolkit.legacyUserProfileCustomizations.stylesheets</code> to <code>true</code>.
</td></tr></table>

## ⏺ Uninstall
To uninstall Pywalfox from your system, run
```bash
pywalfox uninstall # Removes the manifest from native-messaging-hosts
```
and then
```bash
pipx uninstall pywalfox # if you installed with pipx
```
or
```bash
paru -R python-pywalfox # if you installed with paru (only Arch Linux)
```
depending on your chosen installation method.

## 🔧 Troubleshooting
This section lists some common problems and how to (hopefully) fix them.
This [troubleshooting guide from Mozilla](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Native_messaging#Troubleshooting) may be of use if you encounter an error that is not listed here.
First of all:
- Check the log in the Debugging section at the bottom of the Refox settings page for any errors.
- Verify that `~/.cache/wal/colors` exists and contains colors generated by Your Native color scheme generator.
- Verify that `path` in `~/<native-messaging-hosts-folder>/pywalfox.json` is a valid path.

### Firefox forks

Forks may require custom paths to the manifest and profile directory during installation:
```sh
pywalfox install --manifest-path ~/.mozilla/native-messaging-hosts \
                 --profile-path  ~/.config/librewolf/librewolf
```
The above example is for LibreWolf (non-Flatpak version). Paths vary across forks.

### Flatpaks

Flatpak sandboxing prevents direct access to host binaries, so a wrapper script is needed. 
The steps below use the LibreWolf Flatpak as an example. 
You may need to adapt the instructions for your particular browser.

1. Create a wrapper script at `~/.var/app/io.gitlab.librewolf-community/pywalfox-wrapper.sh`:
   ```sh
   #!/bin/sh
   flatpak-spawn --host ~/.local/bin/pywalfox "$@"
   ```
1. Make the wrapper script executable: 
   ```sh
   chmod +x ~/.var/app/io.gitlab.librewolf-community/pywalfox-wrapper.sh
   ```
1. Install the native messaging host with additional arguments for your particular paths, e.g. 
   ```sh
   pywalfox install \
   --manifest-path ~/.var/app/io.gitlab.librewolf-community/.librewolf/native-messaging-hosts \
   --profile-path  ~/.var/app/io.gitlab.librewolf-community/.librewolf/
   ```
1. Edit the manifest in `~/.var/app/io.gitlab.librewolf-community/.librewolf/native-messaging-hosts/pywalfox.json`) and point its `path` to the wrapper script. Use an absolute path as below, replacing `<USER>` with your username.
   ```sh
   {
     "name": "pywalfox",
     "description": "Automatically theme your browser using the colors generated by Pywal",
     "path": "/home/<USER>/.var/app/io.gitlab.librewolf-community/pywalfox-wrapper.sh",
     "type": "stdio",
     "allowed_extensions": [ "pywalfox@frewacom.org", "refox@adior.org" ]
   }
   ```
1. Grant Talk permissions:
   ```sh
   flatpak override --user \
     --talk-name=org.freedesktop.Flatpak \
     --talk-name=org.freedesktop.portal.Flatpak \
     --system-talk-name=org.freedesktop.Flatpak \
     io.gitlab.librewolf-community
   ```
   Verify that the correct permission have been granted, i.e.
   ```sh
   flatpak override --user --talk-name=org.freedesktop.Flatpak io.gitlab.librewolf-community
   ```
   should output
   ```sh
   [Session Bus Policy]
   org.freedesktop.Flatpak=talk
   org.freedesktop.portal.Flatpak=talk
   
   [System Bus Policy]
   org.freedesktop.Flatpak=talk
   ```
1. Restart the browser. Fetching Pywal colors should now work.

### Common errors in the browser console
It is a good idea to check the Firefox browser console (`Tools > Web developer > Browser console`) for errors.
Common errors include:

<details><summary>
<b><code>ExtensionError: No such native application refox</code></b>
</summary>

<table><tr><td>

   The manifest is not installed properly. Try installing the manifest manually by following the instructions [here](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Native_manifests.).

   The manifest is located at `<path-to-python-site-packages>/refox/assets/manifest.json`.

   After you have copied over the manifest to the correct path, make sure to also update the `path` property in the copied manifest. The `path` should point to `<path-to-python-site-packages>/pywalfox/bin/main.sh` (or `win.bat` if you are on Windows).

   If it still does not work, you can try to reinstall Firefox, see [#14](https://github.com/Frewacom/pywalfox/issues/14).

</td></tr></table>
</details>

<details><summary>
<b><code>stderr output from native app refox: <installation-path>/main.sh: line 3: pywalfox: command not found</code></b>
</summary>

<table><tr><td>

  Refox assumes that the `pywalfox` executable is in your `PATH`.

  If you can not run `pywalfox` from the command line (without specifying an absolute path), you must either add the path to the execuatable to your `PATH` variable, or move the executable to a path that already is in your `PATH`.

</td></tr></table>
</details>

<br>

> [!IMPORTANT]
> The errors in the browser console are not limited to just Refox!

## 🚧 Development setup
Do you want to hack on the Refox add-on? Start here:
```bash
git clone https://github.com/ADIOR-enigma/refox.git # or use your own fork
cd refox
yarn install # or npm if you do not have yarn installed
yarn run debug
```

To build the extension into a zip:
```bash
yarn run build
```

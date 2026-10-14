# OS1 Dev

OS1 Dev is an experimental codebase containing a native iOS client and a progressive web app with a local Node.js server/proxy. It is provided as-is; unfinished features and known bugs may remain.

## Components

- `ios-native/` contains the Swift client, bridge and voice controller, XcodeGen project configuration, and UI test source.
- `pwa/` contains the browser client, local server/proxy, theme files, and a theme contrast checker. The package declares Node.js 18 or newer and no runtime npm dependencies.

## Run the PWA

From `pwa/`, run:

```sh
npm start
```

Set local environment values before starting when using authenticated or external-provider features. For example, replace these placeholders in your shell:

```sh
export OPENAI_API_KEY='replace-with-a-local-provider-key'
export OS1_ACCESS_TOKEN='replace-with-a-local-access-token'
```

`PORT` can select the listening port. Optional host integrations may require additional local tools or external credentials. The included theme check can be run with `npm run check:themes`.

## Prepare the iOS project

On macOS, install Xcode and XcodeGen. Copy `ios-native/Config/Local.xcconfig.example` to `ios-native/Config/Local.xcconfig`, then set the local server URL, access token, and Apple development team value. Replace the reserved example bundle identifiers in `ios-native/project.yml` with identifiers you control before signing. From `ios-native/`, run `./scripts/generate-project.sh` to generate the Xcode project.

## Limitations

This snapshot is experimental and has not been built or run as part of sanitation. Browser, iOS build, device, external-service, and optional host-integration behavior remain unverified. Product tests and demos were not run.
## Local configuration notes

The PWA reads provider and voice settings from environment variables. For the ORGO backend, set `ORGO_BASE`, `ORGO_API_KEY`, and `ORGO_COMPUTER_ID`; `ORGO_BASE` uses a reserved example URL until configured. The optional Cockpit link reads `OPSPOT_COCKPIT_URL`. `RG_BIN` and `ORGO_CLI` can select local executables resolved through `PATH`.

Set `OS1_CONTEXT_FILES` to an explicit path list for local context search; local data output uses `OS1_DATA_DIR` or a home-directory default. Optional Hermes integration runs `hermes` from `PATH` by default. Set `HERMES_BIN` to select another executable, `LOCAL_HERMES_HOME` to select the local tool home, or `HERMES_WORKDIR` to select its working directory; the working directory defaults to the current directory. The optional CLI hook setting is `HERMES_ACCEPT_HOOKS`.

The iOS helpers require Xcode and XcodeGen on `PATH`, plus locally supplied `Config/Local.xcconfig` and `Config/GeneratedBridgeConfig.swift`. Only `Local.xcconfig.example` is included; fill its placeholders locally. Build and device behavior remain unverified.

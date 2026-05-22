# Older changes
## 1.6.0 (2026-01-07)

- LowBattery flag added

## 1.5.0 (2025-09-25)

- added "save jsonData.json" & set string to "---" if "false" received
- json filenames in lowerCamelCase format
- new translations
- removed duplicate "save oilUsage.json"

## 1.4.7 (2025-09-19)

- More explicit function names
- If received boolean instead number, set it to 0

## 1.4.6 (2025-09-14)

- Axios dependency updated

## 1.4.5 (2025-08-29)

- Depends updated

## 1.4.4 (2025-06-21)

- README.md & README-de.md corrected

## 1.4.3 (2025-06-21)

- io-package.json > admin set to >=7.4.10

## 1.4.2 (2025-06-17)

- Bug fix jsonConfig.json : xs,sm, md, ...

## 1.4.1 (2025-06-17)

- Bug fix jsonConfig.json : size removed

## 1.4.0 (2025-06-17)

- OilUsage (Oil consumption per month) added

## 1.3.5 (2024-08-08)

js-controller dependency updated

## 1.3.3 (2024-06-04)

Fix: no error if CalculatedRemaining is empty and mqtt is active

## 1.3.2 (2024-06-04)

Error intercepted for:
- RemainsUntilCombined no data found
- CalculatedRemaining is empty

## 1.3.1 (2024-03-24)

- CalculatedRemaining json data point for eCharts added

## 1.3.0 (2024-03-24)

- New README.md
- CalculatedRemaining data points removed

## 1.2.0 (2024-03-16)

- CalculatedRemaining data points renamed to "Today+XXXX Days"
- Limited to 52 data points
- Option for save CalculatedRemaining json

## 1.1.0 (2024-03-09)

- Superfluous logging function removed

## 1.0.1-alpha.0 (2024-03-08)

- Repo new triggering

## 1.0.0 (2024-03-08)

- Initial release for tests

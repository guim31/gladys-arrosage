# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-14

### Added

- One device per garden zone (up to four): water to bring (mm), advised
  watering time (minutes), soil water balance (mm), yesterday's and today's
  ET0, rain forecast today.
- Daily FAO-56 water balance from Open-Meteo (no account): rain minus Kc × ET0,
  capped by a soil reserve, kept across restarts, missed days caught up.
- Zone types with their crop coefficient (lawn, vegetable garden, flower beds,
  hedges and shrubs) or a typed Kc; rate in mm/h or flow and area.
- Rain threshold that cancels the watering when rain is forecast.
- Scene trigger "Watering advised", once a day at the computation hour, and
  scene action "Zone watered" to count a watering.
- Dashboard widget "Irrigation advice" with a "watered" button per zone.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-arrosage/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-arrosage/releases/tag/v1.0.0

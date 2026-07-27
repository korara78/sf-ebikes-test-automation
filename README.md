# Salesforce E-Bikes Test Automation

Playwright-based test automation suite targeting the [E-Bikes LWC](https://github.com/trailheadapps/ebikes-lwc) sample application (Salesforce, Lightning Web Components + Experience Cloud), deployed to a personal Salesforce Developer Edition org.

## Contents

- `/guides` — step-by-step documentation of environment setup, Salesforce org configuration, application deployment, and test automation strategy
- `/tests` — Playwright test suite

## Guides

1. [Environment & Tool Installation](guides/01-environment-setup.md)

## About This Project

This project demonstrates two things end-to-end:
1. Standing up a real Salesforce environment from source — CLI tooling, org configuration, metadata deployment, and troubleshooting real deployment issues.
2. Building automated test coverage against that environment using Playwright.

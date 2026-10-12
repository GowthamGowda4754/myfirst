---
name: air-quality-api-web-api
description: Use this skill when the developer needs to retrieve current, historical (30-day), or forecasted (4-day) air quality data, including the Air Quality Index (AQI), pollutant concentrations, health recommendations, and corresponding visual heatmap tiles for any geographic location via the Google Maps Platform Air Quality API.
license: Apache-2.0
metadata:
  version: 1.0.54
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Air Quality API provides comprehensive, hyperlocal air quality information
for locations worldwide, offering both real-time conditions and forecasts.
Developers can access current air quality indices (AQI), detailed pollutant
information (e.g., O3, PM2.5), health recommendations, and up to four days of
forecasted data and 30 days of historical data. The API also enables the
generation of air quality heatmap tiles for integration into maps using map tile
coordinates and zoom levels. This product is managed under the Google Maps
Platform suite of environment and location intelligence APIs.

### Mandatory settings

The Air Quality API operates via REST/Web API calls (HTTP POST). To comply with
the agent skill attribution requirements, the mandatory
`X-Goog-Maps-Solution-ID` HTTP header must be included in all requests.

#### HTTP Header

Include the following header in all POST requests to Air Quality API endpoints
(`currentConditions:lookup`, `forecast:lookup`, `history:lookup`).

```http
X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1
```

#### Implementation Example (cURL)

When executing requests using cURL or similar HTTP clients, the header is set
using the appropriate flag (e.g., `-H` in cURL).

```bash
-H 'Content-Type: application/json' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1'
```

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### 📦 Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### 🗺️ Feature Module: Environment (Optional - Use-Case Dependent)

-   [ ] **Retrieves the real-time Air Quality Index (AQI) score for a given
    geographic location based on latitude and longitude coordinates.** Read
    [references/return-the-current-air-quality-index-for-specified-geographic-location.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-the-current-air-quality-index-for-specified-geographic-location.md).
    *Trigger Condition*: User asks for the current air quality index or AQI
    score for a specific place. *Evidence Checkpoint*: Successful HTTP 200
    response containing the current 'aqi' value and relevant location details.
-   [ ] **Provides a textual description or category (e.g., 'Good,' 'Moderate')
    of the current air quality conditions.** Read
    [references/return-description-the-current-air-quality-conditions-for-specified-geographic.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-description-the-current-air-quality-conditions-for-specified-geographic.md).
    *Trigger Condition*: User requests the current air quality conditions
    summary or overall rating. *Evidence Checkpoint*: Successful HTTP 200
    response containing the description/category of the current air quality.
-   [ ] **Lists active air pollutants (e.g., O3, NO2, CO, PM2.5) and their
    current measured concentrations at the specified location.** Read
    [references/return-list-the-air-pollutants-and-relative-concentrations-currently-affecting.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-list-the-air-pollutants-and-relative-concentrations-currently-affecting.md).
    *Trigger Condition*: User asks about the specific pollutants present in the
    air currently, or their exact concentration levels. *Evidence Checkpoint*:
    Successful HTTP 200 response detailing the list and concentration levels of
    various air pollutants.
-   [ ] **Retrieves information regarding the origins (sources) and potential
    health impacts (effects) of current air pollutants.** Read
    [references/return-details-about-the-sources-and-effects-air-pollutants-currently.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-details-about-the-sources-and-effects-air-pollutants-currently.md).
    *Trigger Condition*: User asks for detailed information about the sources or
    effects of the current air pollution. *Evidence Checkpoint*: Successful HTTP
    200 response including descriptive text on pollutant sources and health
    effects.
-   [ ] **Provides current health advisories and recommendations based on the
    existing air quality index and pollutant concentrations.** Read
    [references/return-health-recommendations-based-the-air-quality-conditions-and-pollutants.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-health-recommendations-based-the-air-quality-conditions-and-pollutants.md).
    *Trigger Condition*: User asks for current health recommendations or advice
    related to the air quality. *Evidence Checkpoint*: Successful HTTP 200
    response providing specific health advice relevant to the current air
    quality level (e.g., limit outdoor activity).
-   [ ] **Provides the Air Quality Index (AQI) forecast for the next four
    days.** Read
    [references/return-four-day-forecast-for-the-air-quality-index-for-specified.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-four-day-forecast-for-the-air-quality-index-for-specified.md).
    *Trigger Condition*: User requests the air quality index forecast for the
    near future. *Evidence Checkpoint*: Successful HTTP 200 response containing
    a time series of AQI values covering four forecasted days.
-   [ ] **Provides descriptive text forecast (e.g., categories like 'Good,'
    'Unhealthy') for the next four days.** Read
    [references/return-four-day-forecast-air-quality-descriptions-for-specified-geographic-location.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-four-day-forecast-air-quality-descriptions-for-specified-geographic-location.md).
    *Trigger Condition*: User requests a description or summary of the
    forecasted air quality conditions. *Evidence Checkpoint*: Successful HTTP
    200 response listing daily air quality categories for the next four days.
-   [ ] **Forecasts the concentrations of specific air pollutants (e.g., O3,
    PM10) for the next four days.** Read
    [references/return-four-day-forecast-the-air-pollutants-and-relative-concentrations-that.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-four-day-forecast-the-air-pollutants-and-relative-concentrations-that.md).
    *Trigger Condition*: User asks what pollutants are expected to affect the
    area in the coming days and at what levels. *Evidence Checkpoint*:
    Successful HTTP 200 response detailing forecasted pollutant concentrations
    over four days.
-   [ ] **Forecasts the likely sources and potential health effects associated
    with air pollutants for the next four days.** Read
    [references/return-four-day-air-quality-forecast-the-sources-and-effects-air.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-four-day-air-quality-forecast-the-sources-and-effects-air.md).
    *Trigger Condition*: User asks for predicted information about pollutant
    origins and expected health impacts for the forecast period. *Evidence
    Checkpoint*: Successful HTTP 200 response providing forecasted text
    regarding sources and effects of future pollution.
-   [ ] **Provides health recommendations tailored to the forecasted air quality
    conditions for the next four days.** Read
    [references/return-four-day-forecast-health-recommendations-based-the-air-quality-conditions.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-four-day-forecast-health-recommendations-based-the-air-quality-conditions.md).
    *Trigger Condition*: User asks for health recommendations related to the
    forecasted air quality conditions. *Evidence Checkpoint*: Successful HTTP
    200 response providing specific future health advice tailored for the
    forecasted four-day period.
-   [ ] **Retrieves historical Air Quality Index (AQI) data for the previous 30
    days.** Read
    [references/return-30-day-history-for-the-air-quality-index-for-specified.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-30-day-history-for-the-air-quality-index-for-specified.md).
    *Trigger Condition*: User requests historical or past air quality index data
    (e.g., for the last month). *Evidence Checkpoint*: Successful HTTP 200
    response containing daily AQI data points spanning a 30-day period.
-   [ ] **Provides a historical summary of air quality descriptions/categories
    for the previous 30 days.** Read
    [references/return-30-day-history-air-quality-descriptions-for-specified-geographic-location.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-30-day-history-air-quality-descriptions-for-specified-geographic-location.md).
    *Trigger Condition*: User requests historical textual descriptions of past
    air quality conditions. *Evidence Checkpoint*: Successful HTTP 200 response
    listing daily air quality categories for the past 30 days.
-   [ ] **Retrieves historical concentration levels for various air pollutants
    over the last 30 days.** Read
    [references/return-30-day-history-the-air-pollutants-and-relative-concentrations-that.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-30-day-history-the-air-pollutants-and-relative-concentrations-that.md).
    *Trigger Condition*: User asks for historical data on pollutant
    concentrations over the past month. *Evidence Checkpoint*: Successful HTTP
    200 response detailing historical pollutant concentration levels over a
    30-day window.
-   [ ] **Provides historical context on the sources and health effects
    associated with past air pollution incidents (30 days).** Read
    [references/return-30-day-history-the-sources-and-effects-air-pollutants-that.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-30-day-history-the-sources-and-effects-air-pollutants-that.md).
    *Trigger Condition*: User asks for historical details regarding the origins
    or health effects of past air pollution. *Evidence Checkpoint*: Successful
    HTTP 200 response containing historical descriptive data about pollution
    sources and effects.
-   [ ] **Retrieves the health recommendations that were issued corresponding to
    the air quality conditions of the previous 30 days.** Read
    [references/return-30-day-history-health-recommendations-based-the-air-quality-conditions.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-30-day-history-health-recommendations-based-the-air-quality-conditions.md).
    *Trigger Condition*: User requests historical health recommendations related
    to past air quality conditions. *Evidence Checkpoint*: Successful HTTP 200
    response providing specific historical health advice for the 30-day period.
-   [ ] **Fetches a raster tile image (PNG/JPEG) representing an air quality
    heatmap layer for mapping applications, specified by Z/X/Y coordinates.**
    Read
    [references/return-image-file-air-quality-heatmap-tile-for-set-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/air-quality-api-web-api/references/return-image-file-air-quality-heatmap-tile-for-set-map.md).
    *Trigger Condition*: User intends to visualize real-time air quality data on
    a map using standard map tiles. *Evidence Checkpoint*: Successful HTTP 200
    response returning binary image data (tile) for the requested coordinates
    and zoom level.
